"""The release gate accepts only successful CI for the tagged commit."""

import unittest
from io import BytesIO
from unittest.mock import patch

from scripts.src import release_ci
from scripts.src.release_ci import check_runs


def run(run_id=1, sha="abc", branch="main", event="push", **values):
    return {
        "id": run_id,
        "head_sha": sha,
        "head_branch": branch,
        "event": event,
        "status": values.get("status", "completed"),
        "conclusion": values.get("conclusion", "success"),
    }


class ReleaseCITest(unittest.TestCase):
    def test_requires_exact_commit_main_and_push(self):
        self.assertEqual(
            check_runs(
                [run(sha="different"), run(branch="other"), run(event="pull_request")],
                "abc",
            ),
            "pending",
        )
        self.assertEqual(check_runs([run()], "abc"), "success")

    def test_latest_run_controls_release(self):
        self.assertEqual(
            check_runs([run(), run(2, status="in_progress")], "abc"), "pending"
        )
        for conclusion in ("failure", "cancelled", "skipped", "timed_out"):
            with self.subTest(conclusion=conclusion):
                self.assertEqual(
                    check_runs([run(), run(2, conclusion=conclusion)], "abc"),
                    "failure",
                )
        self.assertEqual(
            check_runs([run(conclusion="failure"), run(2)], "abc"), "success"
        )

    def test_gate_waits_for_a_matching_success(self):
        responses = [
            BytesIO(b'{"workflow_runs": []}'),
            BytesIO(
                b'{"workflow_runs": [{"id": 1, "head_sha": "abc",'
                b'"head_branch": "main", "event": "push",'
                b'"status": "completed", "conclusion": "success"}]}'
            ),
        ]
        with (
            patch.dict(
                "os.environ",
                {
                    "RELEASE_REPOSITORY": "owner/repo",
                    "RELEASE_SHA": "abc",
                    "GH_TOKEN": "test-token",
                },
            ),
            patch.object(release_ci, "urlopen", side_effect=responses) as fetch,
            patch.object(release_ci.time, "sleep") as sleep,
        ):
            release_ci.main()
        self.assertEqual(fetch.call_count, 2)
        self.assertIn(
            "/actions/workflows/ci.yml/runs?", fetch.call_args.args[0].full_url
        )
        sleep.assert_called_once_with(release_ci.INTERVAL)
