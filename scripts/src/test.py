"""Run offline provider, integration and frontend suites, or a focused group."""

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
        "--python-only", action="store_true", help="Provider and integration suites"
    )
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
    if args.providers_only:
        tasks.provider_tests(unittest_args)
        return
    if not args.frontend_only:
        tasks.verify_pyk()
        tasks.provider_tests(unittest_args)
        tasks.integration_tests(unittest_args)
    if not args.python_only:
        tasks.frontend_tests()


if __name__ == "__main__":
    raise SystemExit(tasks.cli(main))
