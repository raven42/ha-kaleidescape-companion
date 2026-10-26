import { expect, it, vi } from "vitest";
import {
  ApiError,
  JournalClient,
  MAX_DOWNLOAD_BYTES,
  errorMessage,
} from "../src/api";
import { FixtureTransport, info } from "./fixture";

it("takes only entry/dataset identifiers from metadata and freezes retry input", async () => {
  const transport = new FixtureTransport(),
    client = transport.client();
  await client.list(info);
  await client.get(info, transport.records[0].id);
  expect(transport.calls[0]).toEqual({
    type: "kaleidescape_companion/journal/list",
    entry_id: info.entry_id,
    dataset_id: info.dataset_id,
    query: "",
    limit: 25,
  });
  const data = { title: "Initial title" };
  const request = client.prepare(info, "create", {
    data,
    request_id: "forged",
    dataset_id: "forged",
  });
  data.title = "Changed after preparation";
  expect(request.message.data).toEqual({ title: "Initial title" });
  expect(request.message.dataset_id).toBe(info.dataset_id);
  expect(request.message.request_id).not.toBe("forged");
});
it("bounds requests and treats a timeout as an unconfirmed result", async () => {
  vi.useFakeTimers();
  try {
    const client = new JournalClient({
      callWS: () => new Promise(() => {}),
      fetchWithAuth: vi.fn(),
    });
    const promise = expect(client.info()).rejects.toMatchObject({
      code: "connection_lost",
    });
    await vi.advanceTimersByTimeAsync(15001);
    await promise;
  } finally {
    vi.useRealTimers();
  }
});
it("uses authenticated, uncached exports and cancels readers above the browser limit", async () => {
  const reader = {
    read: vi.fn().mockResolvedValue({
      value: { byteLength: MAX_DOWNLOAD_BYTES + 1 },
      done: false,
    }),
    cancel: vi.fn().mockResolvedValue(undefined),
    releaseLock: vi.fn(),
  };
  const fetchWithAuth = vi
    .fn()
    .mockResolvedValue({ ok: true, body: { getReader: () => reader } });
  const client = new JournalClient({ callWS: vi.fn(), fetchWithAuth });
  const signal = new AbortController().signal;
  await expect(client.download(info, "json", signal)).rejects.toMatchObject({
    code: "export_too_large",
  });
  expect(fetchWithAuth).toHaveBeenCalledWith(
    expect.stringContaining("/export?format=json"),
    { signal, cache: "no-store", redirect: "error" },
  );
  expect(reader.cancel).toHaveBeenCalled();
  expect(reader.releaseLock).toHaveBeenCalled();
});
it("does not render error details or credentials supplied by the server", () => {
  expect(
    errorMessage({
      code: "invalid_request",
      message: "private-token <script>attack</script>",
    }),
  ).not.toContain("private-token");
  expect(errorMessage(new ApiError("unauthorized"))).toContain(
    "Access to this operation is denied",
  );
});
