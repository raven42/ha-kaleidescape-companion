"""Wait for the main-branch CI run for the exact commit being released."""

import json
import os
import sys
import time
from urllib.parse import urlencode
from urllib.request import Request, urlopen

TIMEOUT = 15 * 60
INTERVAL = 15


def check_runs(runs, sha):
    """Return pending, success, or failure for the newest matching CI run."""
    matches = [
        run
        for run in runs
        if run.get("head_sha") == sha
        and run.get("head_branch") == "main"
        and run.get("event") == "push"
    ]
    if not matches:
        return "pending"
    latest = max(matches, key=lambda run: run["id"])
    if latest["status"] != "completed":
        return "pending"
    return "success" if latest.get("conclusion") == "success" else "failure"


def main():
    repository = os.environ["RELEASE_REPOSITORY"]
    sha = os.environ["RELEASE_SHA"]
    query = urlencode({"head_sha": sha, "branch": "main", "event": "push"})
    url = (
        f"https://api.github.com/repos/{repository}/actions/workflows/ci.yml/runs"
        f"?{query}"
    )
    request = Request(
        url,
        headers={
            "Authorization": f"Bearer {os.environ['GH_TOKEN']}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        },
    )
    deadline = time.monotonic() + TIMEOUT
    while time.monotonic() < deadline:
        with urlopen(request, timeout=30) as response:
            result = check_runs(json.load(response)["workflow_runs"], sha)
        if result == "success":
            print(f"Main CI passed for {sha}.")
            return
        if result == "failure":
            sys.exit(f"Main CI failed or was cancelled for {sha}.")
        print(f"Waiting for main CI on {sha}...", flush=True)
        time.sleep(INTERVAL)
    sys.exit(f"Timed out waiting for main CI on {sha}.")


if __name__ == "__main__":
    main()
