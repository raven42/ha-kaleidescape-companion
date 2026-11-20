"""Run offline browser, provider, integration and frontend tests."""

import argparse

from scripts.src import tasks


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    group = parser.add_mutually_exclusive_group()
    group.add_argument(
        "--providers-only",
        action="store_true",
        help="Independent provider suite; no HA or virtual environment needed",
    )
    group.add_argument(
        "--browser-only",
        action="store_true",
        help="Standalone server browser tests, using only Python",
    )
    group.add_argument(
        "--live-player-only",
        action="store_true",
        help="Standalone LivePlayer tests with the bundled pyk and no Home Assistant",
    )
    group.add_argument("--python-only", action="store_true", help="All Python suites")
    group.add_argument(
        "--frontend-only",
        action="store_true",
        help="Frontend security and component suites",
    )
    parser.add_argument(
        "-v", "--verbose", action="store_true", help="Verbose unittest results"
    )
    args = parser.parse_args()
    unittest_args = ["-v"] if args.verbose else []
    if args.live_player_only:
        tasks.live_player_tests(unittest_args)
        return
    if args.browser_only:
        tasks.browser_tests(unittest_args)
        return
    if args.providers_only:
        tasks.provider_tests(unittest_args)
        return
    if not args.frontend_only:
        tasks.verify_pyk()
        tasks.provider_tests(unittest_args)
        tasks.browser_tests(unittest_args)
        tasks.live_player_tests(unittest_args)
        tasks.integration_tests(unittest_args)
    if not args.python_only:
        tasks.frontend_tests()


if __name__ == "__main__":
    raise SystemExit(tasks.cli(main))
