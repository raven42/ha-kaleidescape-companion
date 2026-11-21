"""Failures raised by the local server browser."""


class BrowserError(Exception):
    """Base error for local browser operations."""


class LibraryFormatError(BrowserError):
    """A local browser page was incomplete or had an unsupported layout."""


class BrowserResponseError(BrowserError):
    """A browser response was too large, malformed, or outside the allowed routes."""


class BrowserOutcomeUnknownError(BrowserError):
    """A collection POST may have reached the server without a known result."""
