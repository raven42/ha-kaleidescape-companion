"""Persistent TCP sessions with explicit reconnect, correlation and bounded events."""

import asyncio
import re
from dataclasses import dataclass

from .codec import (
    Address,
    FrameDecoder,
    Response,
    device_address,
    encode_command,
    parse_response,
)
from .commands import CommandSpec
from .errors import (
    CommandUncertain,
    ConnectionClosed,
    EventOverflow,
    ProtocolError,
    Rejected,
    RequestTimeout,
)
from .logging import (
    Failure,
    Level,
    Operation,
    Outcome,
    Resource,
    SafeLogger,
    Subsystem,
    Trigger,
)

PORT = 10000
MAX_RESPONSE = 128 * 1024
MAX_MESSAGES = 256


@dataclass(frozen=True)
class Reply:
    command: str
    address: Address
    messages: tuple[Response, ...]

    @property
    def fields(self):
        return self.messages[0].fields


class _Collector:
    def __init__(self, spec, fields):
        self.spec, self.fields = spec, fields
        self.messages = []
        self.expected = 0
        self.indices = set()
        self.bytes = 0

    def add(self, message, size):
        self.bytes += size
        if self.bytes > MAX_RESPONSE or len(self.messages) >= MAX_MESSAGES:
            raise ProtocolError("Protocol response exceeds its resource budget")
        if not self.messages:
            if message.name != self.spec.response:
                raise ProtocolError("Unexpected response to protocol command")
            if self.spec.multipart:
                count_index = 0 if self.spec.multipart == "details" else 2
                handle_index = 1 if self.spec.multipart == "details" else 0
                values = message.fields
                if (
                    len(values) <= max(count_index, handle_index)
                    or values[handle_index] != self.fields[0]
                ):
                    raise ProtocolError("Multipart reply identifies another handle")
                count = values[count_index]
                if not count.isascii() or not count.isdigit() or len(count) > 3:
                    raise ProtocolError("Invalid multipart response count")
                limit = 128 if self.spec.multipart == "details" else 100
                if not 0 <= int(count) <= limit:
                    raise ProtocolError("Multipart response exceeds its row limit")
                self.expected = int(count)
                if self.spec.multipart == "browse":
                    window = self.fields[2].split("-")
                    if self.expected > int(window[1]) - int(window[0]) + 1:
                        raise ProtocolError("Browse reply exceeds the requested window")
        else:
            name = (
                "CONTENT_DETAILS"
                if self.spec.multipart == "details"
                else "BROWSE_RESULT"
            )
            if (
                message.name != name
                or not message.fields
                or not re.fullmatch(r"[0-9]{1,3}", message.fields[0])
            ):
                raise ProtocolError("Invalid multipart response line")
            index = int(message.fields[0])
            if not 1 <= index <= self.expected or index in self.indices:
                raise ProtocolError("Duplicate or invalid multipart response line")
            self.indices.add(index)
        self.messages.append(message)
        return not self.spec.multipart or len(self.messages) == self.expected + 1


class EventSubscription:
    """A bounded async iterator. Overflow is explicit; no silent event loss."""

    def __init__(self, owner, address, names, capacity):
        self.owner, self.address, self.names = owner, address, frozenset(names)
        self.queue = asyncio.Queue(capacity)
        self.closed = False
        self.error = None

    def publish(self, message):
        if (
            self.closed
            or (self.address is not None and message.address != self.address)
            or (self.names and message.name not in self.names)
        ):
            return
        if self.queue.full():
            self.owner.logger.emit(
                Subsystem.PROTOCOL,
                Operation.READ,
                Outcome.OVERFLOW,
                level=Level.ERROR,
                resource=(Resource.DEVICE, self.owner.host),
            )
            self.close(EventOverflow("Event buffer overflow; resynchronize explicitly"))
        else:
            self.queue.put_nowait(message)

    def close(self, error=None):
        if self.closed:
            return
        self.closed, self.error = True, error
        self.owner._subscriptions.discard(self)
        while not self.queue.empty():
            self.queue.get_nowait()
        self.queue.put_nowait(None)

    def __aiter__(self):
        return self

    async def __anext__(self):
        if self.closed and self.queue.empty():
            raise StopAsyncIteration
        message = await self.queue.get()
        if message is None:
            if self.error:
                raise self.error
            raise StopAsyncIteration
        return message

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        self.close()


class Transport:
    """One connection, one in-flight request, up to 32 queued callers.

    Sequence numbers are reused only after a complete reply. A timed-out or
    cancelled on-wire request closes the session, preventing late replies from
    acknowledging another command. Reconnect and event re-registration are
    always explicit. Neither connect nor close sends device commands.
    """

    def __init__(
        self, host: str, *, timeout: float = 5, logger: SafeLogger | None = None
    ):
        self.logger = logger or SafeLogger()
        self.host = device_address(host)
        if type(timeout) not in (float, int) or not 0 < timeout <= 15:
            raise ProtocolError("Timeout must be between zero and 15 seconds")
        self.timeout = timeout
        self._writer = None
        self._reader_task = None
        self._connected = False
        self._connect_lock = asyncio.Lock()
        self._request_lock = asyncio.Lock()
        self._waiting = 0
        self._sequence = 0
        self._pending = None
        self._subscriptions = set()
        self._generation = 0

    @property
    def connected(self):
        return self._connected

    async def connect(self):
        async with self._connect_lock:
            if self.connected:
                return
            await self.close()
            generation = self._generation
            self.logger.emit(
                Subsystem.TRANSPORT,
                Operation.CONNECT,
                Outcome.STARTED,
                resource=(Resource.DEVICE, self.host),
            )
            try:
                async with asyncio.timeout(self.timeout):
                    reader, writer = await asyncio.open_connection(self.host, PORT)
            except (OSError, TimeoutError) as error:
                self.logger.emit(
                    Subsystem.TRANSPORT,
                    Operation.CONNECT,
                    Outcome.FAILED,
                    level=Level.ERROR,
                    failure=Failure.TIMEOUT
                    if isinstance(error, TimeoutError)
                    else Failure.CONNECTION,
                    resource=(Resource.DEVICE, self.host),
                )
                raise ConnectionClosed("Cannot connect to protocol endpoint") from error
            if generation != self._generation:
                writer.close()
                try:
                    async with asyncio.timeout(1):
                        await writer.wait_closed()
                except (OSError, TimeoutError):
                    pass
                raise ConnectionClosed("Connection attempt was closed")
            self._writer = writer
            self._connected = True
            self.logger.emit(
                Subsystem.TRANSPORT,
                Operation.CONNECT,
                Outcome.SUCCEEDED,
                resource=(Resource.DEVICE, self.host),
            )
            # A persistent receiver must not inherit the request that opened it.
            with self.logger.context(inherit=False, trigger=Trigger.DEVICE_EVENT):
                self._reader_task = asyncio.create_task(self._receive(reader))

    def _disconnect(self, error):
        self._connected = False
        if self._writer:
            self._writer.close()
        if self._pending and not self._pending[2].done():
            self._pending[2].set_exception(error)
        for subscription in tuple(self._subscriptions):
            subscription.close(error)

    async def close(self):
        if self.connected:
            self.logger.emit(
                Subsystem.TRANSPORT,
                Operation.DISCONNECT,
                Outcome.SUCCEEDED,
                level=Level.DEBUG,
                resource=(Resource.DEVICE, self.host),
            )
        self._generation += 1
        self._disconnect(ConnectionClosed("Protocol session closed"))
        task, self._reader_task = self._reader_task, None
        if task and task is not asyncio.current_task():
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass
        writer, self._writer = self._writer, None
        if writer:
            try:
                async with asyncio.timeout(1):
                    await writer.wait_closed()
            except (OSError, TimeoutError):
                pass

    def subscribe(self, *, address: Address | None = None, names=(), capacity=64):
        if not self.connected:
            raise ConnectionClosed("Connect before subscribing to protocol events")
        if address is not None and not isinstance(address, Address):
            raise ProtocolError("Event filter requires a protocol Address")
        names = (names,) if isinstance(names, str) else tuple(names)
        if len(names) > 64 or any(
            not isinstance(name, str) or not re.fullmatch(r"[A-Z][A-Z0-9_]{0,63}", name)
            for name in names
        ):
            raise ProtocolError("Invalid event name filter")
        if (
            type(capacity) is not int
            or not 1 <= capacity <= 1024
            or len(self._subscriptions) >= 32
        ):
            raise ProtocolError("Event subscription limit exceeded")
        subscription = EventSubscription(self, address, names, capacity)
        self._subscriptions.add(subscription)
        return subscription

    async def _receive(self, reader):
        decoder, unmatched = FrameDecoder(), 0
        try:
            while chunk := await reader.read(1024):
                for frame in decoder.feed(chunk):
                    message = parse_response(frame)
                    if message.is_event:
                        for subscription in tuple(self._subscriptions):
                            subscription.publish(message)
                        continue
                    pending = self._pending
                    if (
                        pending
                        and message.address == pending[0]
                        and message.sequence == pending[1]
                        and not pending[2].done()
                    ):
                        unmatched = 0
                        if message.status:
                            pending[2].set_exception(
                                Rejected(message.status, pending[3].spec.name)
                            )
                        elif pending[3].add(message, len(frame)):
                            pending[2].set_result(tuple(pending[3].messages))
                    else:
                        unmatched += 1
                        if unmatched > MAX_MESSAGES or message.sequence == "?":
                            raise ProtocolError(
                                "Uncorrelated protocol response limit exceeded"
                            )
            raise ConnectionClosed("Component closed the protocol connection")
        except asyncio.CancelledError:
            self._disconnect(ConnectionClosed("Protocol reader cancelled"))
            raise
        except (OSError, ProtocolError) as error:
            self.logger.emit(
                Subsystem.TRANSPORT,
                Operation.READ,
                Outcome.FAILED,
                level=Level.ERROR,
                failure=Failure.CONNECTION
                if isinstance(error, OSError)
                else Failure.VALIDATION,
                resource=(Resource.DEVICE, self.host),
            )
            self._disconnect(
                error
                if isinstance(error, ProtocolError)
                else ConnectionClosed("Protocol connection failed")
            )

    async def request(
        self, spec: CommandSpec, values=(), *, address=Address()
    ) -> Reply:
        fields = spec.fields(values)
        from .commands import COMMANDS

        diagnostic_command = (
            spec.name if spec.name in {*COMMANDS, "PLAY_MOVIE"} else None
        )
        log_level = Level.DEBUG if spec.read_only else Level.INFO
        self.logger.emit(
            Subsystem.PROTOCOL,
            Operation.READ if spec.read_only else Operation.CONTROL,
            Outcome.STARTED,
            level=log_level,
            resource=(Resource.DEVICE, self.host + str(address)),
            command=diagnostic_command,
        )
        if not isinstance(address, Address) or (
            spec.local_only and address != Address()
        ):
            raise ProtocolError(
                "Session command must target the directly connected component"
            )
        if self._waiting >= 32:
            raise ProtocolError("Protocol request queue is full")
        sent, future = False, None
        self._waiting += 1
        try:
            async with asyncio.timeout(self.timeout):
                async with self._request_lock:
                    writer = self._writer
                    if not self.connected or writer is None:
                        raise ConnectionClosed(
                            "Connect before sending protocol commands"
                        )
                    self._sequence = self._sequence % 9 + 1
                    wire = encode_command(address, self._sequence, spec.name, fields)
                    future = asyncio.get_running_loop().create_future()
                    self._pending = (
                        address,
                        str(self._sequence),
                        future,
                        _Collector(spec, fields),
                    )
                    try:
                        sent = True  # A failing drain/write can still deliver bytes.
                        writer.write(wire)
                        await writer.drain()
                        messages = await future
                        self.logger.emit(
                            Subsystem.PROTOCOL,
                            Operation.READ if spec.read_only else Operation.CONTROL,
                            Outcome.SUCCEEDED,
                            level=log_level,
                            count=len(messages),
                            resource=(Resource.DEVICE, self.host + str(address)),
                            command=diagnostic_command,
                        )
                        return Reply(spec.name, address, messages)
                    finally:
                        self._pending = None
        except Rejected as error:
            self.logger.emit(
                Subsystem.PROTOCOL,
                Operation.REQUEST,
                Outcome.REJECTED,
                level=Level.WARNING,
                failure=Failure.REJECTED,
                status=error.status,
                resource=(Resource.DEVICE, self.host + str(address)),
                command=diagnostic_command,
            )
            raise
        except asyncio.CancelledError:
            if sent:
                self.logger.emit(
                    Subsystem.PROTOCOL,
                    Operation.REQUEST,
                    Outcome.UNCERTAIN if not spec.read_only else Outcome.UNAVAILABLE,
                    level=Level.WARNING,
                    failure=Failure.CANCELLED,
                    resource=(Resource.DEVICE, self.host + str(address)),
                    command=diagnostic_command,
                )
                self._disconnect(ConnectionClosed("On-wire request cancelled"))
            raise
        except (TimeoutError, OSError, ProtocolError) as error:
            self.logger.emit(
                Subsystem.PROTOCOL,
                Operation.REQUEST,
                Outcome.UNCERTAIN if sent and not spec.read_only else Outcome.FAILED,
                level=Level.ERROR,
                resource=(Resource.DEVICE, self.host + str(address)),
                command=diagnostic_command,
            )
            if sent:
                self._disconnect(ConnectionClosed("On-wire request failed"))
                if not spec.read_only:
                    raise CommandUncertain(
                        "Command may have reached the device; "
                        "inspect before repeating it"
                    ) from error
            if isinstance(error, TimeoutError):
                raise RequestTimeout("Protocol request deadline exceeded") from error
            if isinstance(error, OSError):
                raise ConnectionClosed("Protocol write failed") from error
            raise
        finally:
            self._waiting -= 1
            if future:
                if not future.done():
                    future.cancel()
                elif not future.cancelled():
                    # Consume failures even when the caller was cancelled.
                    future.exception()

    async def __aenter__(self):
        await self.connect()
        return self

    async def __aexit__(self, *args):
        await self.close()
