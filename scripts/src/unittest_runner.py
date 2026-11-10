"""Run unittest discovery with a practical asyncio slow-callback diagnostic."""

import runpy
import unittest

SLOW_CALLBACK_SECONDS = 0.25


def configure_asyncio_diagnostics() -> None:
    """Raise isolated-test slow-callback warnings without disabling debug checks."""
    setup = unittest.IsolatedAsyncioTestCase._setupAsyncioRunner
    if getattr(setup, "_companion_slow_callback_threshold", None) is not None:
        return

    def configure(case: unittest.IsolatedAsyncioTestCase) -> None:
        setup(case)
        case._asyncioRunner.get_loop().slow_callback_duration = SLOW_CALLBACK_SECONDS

    configure._companion_slow_callback_threshold = SLOW_CALLBACK_SECONDS
    unittest.IsolatedAsyncioTestCase._setupAsyncioRunner = configure


def main() -> None:
    configure_asyncio_diagnostics()
    runpy.run_module("unittest", run_name="__main__")


if __name__ == "__main__":
    main()
