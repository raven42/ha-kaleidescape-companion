"""Run integration tests with a less noisy asyncio debug threshold."""

import sys
import unittest
from unittest.mock import patch

# IsolatedAsyncioTestCase deliberately enables asyncio debug mode. Keep its
# normal runner and event-loop lifecycle, but allow more scheduling jitter in
# this large, offline fixture suite before reporting a slow callback.
SLOW_CALLBACK_SECONDS = 0.2
_ORIGINAL_SETUP = unittest.IsolatedAsyncioTestCase._setupAsyncioRunner


def _setup_asyncio_runner(case):
    _ORIGINAL_SETUP(case)
    case._asyncioRunner.get_loop().slow_callback_duration = SLOW_CALLBACK_SECONDS


def main():
    with patch.object(
        unittest.IsolatedAsyncioTestCase, "_setupAsyncioRunner", _setup_asyncio_runner
    ):
        unittest.main(
            module=None,
            argv=[sys.argv[0], "discover", "-s", "tests", *sys.argv[1:]],
        )


if __name__ == "__main__":
    main()
