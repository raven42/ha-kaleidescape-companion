"""Small privacy-preserving helpers for native operational logging.

For example, an ``OSError`` containing a private path and credential such as
``OSError('cannot read /config/journal.sqlite3; token=fictional-secret')``
could be rendered as
``OSError at custom_components.kaleidescape_companion.core.repository._open:142``.
The location is illustrative; the exception message and its chain are omitted.
"""


def safe_exception(error: BaseException) -> str:
    """Describe the exception and integration frames without its private arguments."""
    name = type(error).__name__
    if not name.isidentifier() or len(name) > 80:
        name = "Exception"
    frames = []
    traceback = error.__traceback__
    while traceback:
        frame = traceback.tb_frame
        module = frame.f_globals.get("__name__", "")
        function = frame.f_code.co_name
        if (
            isinstance(module, str)
            and module.startswith("custom_components.kaleidescape_companion")
            and all(part.isidentifier() for part in module.split("."))
            and function.isidentifier()
        ):
            frames.append(f"{module}.{function}:{traceback.tb_lineno}")
        traceback = traceback.tb_next
    return f"{name} at {', '.join(frames[-4:])}" if frames else name
