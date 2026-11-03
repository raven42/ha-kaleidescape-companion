"""Expected fault logs must not hide other test failures or log messages."""

import logging
import unittest

from _expected_logs import expected_log

LOGGER = "companion_test.expected"
OTHER_LOGGER = "companion_test.other"


class ExpectedLogsTest(unittest.IsolatedAsyncioTestCase):
    async def test_expected_message_is_captured_but_other_loggers_remain_visible(self):
        @expected_log(LOGGER, "Expected failure")
        async def operation(case):
            logging.getLogger(LOGGER).error("Expected failure after test injection")
            logging.getLogger(OTHER_LOGGER).warning("Unexpected elsewhere")

        with self.assertLogs(OTHER_LOGGER, level="WARNING") as logs:
            await operation(self)
        self.assertIn("Unexpected elsewhere", logs.output[0])

    async def test_unexpected_message_from_target_logger_fails_the_test(self):
        @expected_log(LOGGER, "Expected failure")
        async def operation(case):
            logging.getLogger(LOGGER).error("A different failure")

        with self.assertRaisesRegex(AssertionError, "Unexpected log record"):
            await operation(self)
