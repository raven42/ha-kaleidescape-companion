"""Assert and capture logs from deliberately injected test failures."""

import sys
from functools import wraps


def expected_log(logger: str, prefix: str):
    """Capture only a specific logger and reject unexpected warning/error records."""

    def decorate(test):
        @wraps(test)
        async def run(self, *args, **kwargs):
            with self.assertLogs(logger, level="WARNING") as captured:
                try:
                    result = await test(self, *args, **kwargs)
                except BaseException:
                    for message in captured.output:
                        print(message, file=sys.stderr)
                    raise
            for record in captured.records:
                self.assertTrue(
                    record.getMessage().startswith(prefix),
                    f"Unexpected log record: {record.getMessage()}",
                )
            return result

        return run

    return decorate
