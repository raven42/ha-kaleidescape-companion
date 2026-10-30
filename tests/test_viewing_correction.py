"""Exact Library corrections preserve recorded observation facts."""

import json
import unittest
from types import SimpleNamespace
from unittest.mock import patch
from uuid import uuid4

import test_backend as backend
import test_library as library
import test_metadata as metadata
import test_repository as repository


class ViewingCorrectionTest(unittest.IsolatedAsyncioTestCase):
    asyncSetUp = repository.RepositoryTest.asyncSetUp
    assert_error = repository.RepositoryTest.assert_error
    seed = metadata.MetadataTest.seed

    async def create(self):
        return (
            await self.repository.async_create(
                str(uuid4()),
                {
                    "title": "Historical title",
                    "started_at": "2026-10-29T12:00:00Z",
                    "watched_seconds": 123.456,
                    "duration_seconds": 8000,
                    "source_id": "observed-source",
                    "player_id": "original-player",
                    "raw_content_id": "original-handle",
                    "notes": "Keep my history",
                },
            )
        )["viewing"]

    async def correct(self, row, values=None, **kwargs):
        return await self.repository.async_correct_viewing(
            kwargs.pop("request", str(uuid4())),
            row["id"],
            row["revision"],
            values
            if values is not None
            else {
                "library_title_id": library.title_id(library.SOURCE, metadata.HANDLE)
            },
            actor_id=kwargs.pop("actor", "admin"),
            source=library.SOURCE,
            **kwargs,
        )

    async def test_selection_changes_attribution_and_preserves_observation_facts(
        self,
    ):
        await self.seed()
        before = await self.create()
        result = await self.correct(before)
        after = result["viewing"]
        for key in (
            "started_at",
            "ended_at",
            "duration_seconds",
            "watched_seconds",
            "status",
            "notes",
            "source_id",
            "player_id",
            "raw_content_id",
        ):
            self.assertEqual(after[key], before[key], key)
        self.assertEqual(after["title"], metadata.ROWS[0]["title"])
        self.assertEqual(after["revision"], before["revision"] + 1)
        link = (
            await self.repository.async_viewing_library(library.SOURCE, before["id"])
        )["library"]
        self.assertEqual(
            link["title_id"], library.title_id(library.SOURCE, metadata.HANDLE)
        )
        row = (await self.repository.async_inspect("viewings"))["items"][0]
        self.assertEqual(
            json.loads(row["library_metadata"])["actors"], ["Fictional Actor"]
        )
        self.assertNotIn("library_metadata", after)
        self.assertEqual(
            len(
                (
                    await self.repository.async_list(
                        library_scope=(library.SOURCE, link["title_id"])
                    )
                )["items"]
            ),
            1,
        )
        self.assertEqual((await self.repository.async_inspect("sessions"))["items"], [])

    async def test_forged_fields_and_unavailable_or_cross_source_titles_are_rejected(
        self,
    ):
        await self.seed()
        row = await self.create()
        key = library.title_id(library.SOURCE, metadata.HANDLE)
        for values in (
            {"title": "Invented"},
            {"library_title_id": "bad"},
            {"library_title_id": "f" * 64},
            {"library_title_id": key, "title": "Forged"},
            {"library_title_id": key, "library_metadata": "{}"},
            {"library_title_id": key, "raw_content_id": "forged"},
        ):
            with self.subTest(values=values), self.assert_error("invalid_request"):
                await self.correct(row, values)
        with self.assert_error("invalid_request"):
            await self.repository.async_correct_viewing(
                str(uuid4()),
                row["id"],
                1,
                {"library_title_id": key},
                actor_id="admin",
                source="other",
            )
        self.assertEqual(await self.repository.async_get(row["id"]), row)
        await self.repository.async_library_catalog(library.ORIGIN, [], {})
        with self.assert_error("invalid_request"):
            await self.correct(row)
        # Historical corrections need no Library access or guessed title match.
        result = await self.repository.async_correct_viewing(
            str(uuid4()), row["id"], 1, {"notes": "Corrected"}, actor_id="admin"
        )
        self.assertEqual(result["viewing"]["title"], row["title"])

    async def test_exact_retries_conflicts_and_backup_protection(self):
        await self.seed()
        row = await self.create()
        await self.repository.async_pause()
        with self.assert_error("backup_in_progress"):
            await self.correct(row)
        await self.repository.async_resume()
        request = str(uuid4())
        result = await self.correct(row, request=request)
        with self.assert_error("conflict"):
            await self.correct(row)
        await self.repository.async_library_catalog(library.ORIGIN, [], {})
        self.assertEqual(await self.correct(row, request=request), result)
        with self.assert_error("conflict"):
            await self.correct(row, request=request, actor="other-admin")
        with self.assert_error("conflict"):
            await self.correct(row, {"library_title_id": "e" * 64}, request=request)

    async def test_failed_receipt_rolls_back_title_link_and_metadata_together(self):
        await self.seed()
        row = await self.create()

        def fail_receipt():
            self.repository._db().execute(
                "CREATE TRIGGER fail_correction BEFORE INSERT ON requests "
                "BEGIN SELECT RAISE(ABORT, 'fictional failure'); END"
            )

        await self.repository._call(fail_receipt)
        with self.assert_error("storage_error"):
            await self.correct(row)
        self.assertEqual(await self.repository.async_get(row["id"]), row)
        self.assertIsNone(
            (await self.repository.async_viewing_library(library.SOURCE, row["id"]))[
                "library"
            ]
        )


class ViewingCorrectionApiTest(unittest.IsolatedAsyncioTestCase):
    asyncSetUp = backend.BackendTest.asyncSetUp
    call = backend.BackendTest.call
    create = backend.BackendTest.create

    async def test_admin_library_requirement_and_post_await_opt_out(self):
        row = (await self.create())["result"]["viewing"]
        repo = self.entry.runtime_data.repository
        source = self.entry.runtime_data.library.source
        key = library.title_id(source, "fictional")
        fields = {
            **self.scope,
            "request_id": str(uuid4()),
            "viewing_id": row["id"],
            "expected_revision": row["revision"],
            "patch": {"title": "Forged"},
        }
        self.assertEqual(
            (await self.call("journal/update", **fields))["code"], "invalid_request"
        )
        fields["patch"] = {"library_title_id": key}
        reader = SimpleNamespace(id="reader", is_active=True, is_admin=False)
        self.assertEqual(
            (await self.call("journal/update", user=reader, **fields))["code"],
            "unauthorized",
        )
        original = repo.async_correct_viewing

        async def disabled(*args, **kwargs):
            result = await original(*args, **kwargs)
            object.__setattr__(
                self.entry, "data", {**self.entry.data, "library_enabled": False}
            )
            return result

        with patch.object(repo, "async_correct_viewing", disabled):
            self.assertEqual(
                (await self.call("journal/update", **fields))["code"],
                "library_disabled",
            )
        self.assertEqual(
            (await repo.async_get(row["id"]))["revision"], row["revision"] + 1
        )
        fields["request_id"] = str(uuid4())
        self.assertEqual(
            (await self.call("journal/update", **fields))["code"], "library_disabled"
        )
