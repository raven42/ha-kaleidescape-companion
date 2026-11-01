"""Fictional catalog/network fixtures; these tests never contact a device."""

import asyncio
import hashlib
import socket
import sqlite3
import unittest
from contextlib import closing
from html import escape
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch

import test_backend as backend_tests
import test_repository as repository_tests
from aiohttp import TCPConnector, web
from aiohttp.test_utils import make_mocked_request
from homeassistant.components.http import KEY_HASS

from custom_components.kaleidescape_companion import (
    async_setup_entry,
    async_unload_entry,
)
from custom_components.kaleidescape_companion.backup import (
    async_post_backup,
    async_pre_backup,
)
from custom_components.kaleidescape_companion.core.models import JournalError
from custom_components.kaleidescape_companion.core.repository import JournalRepository
from custom_components.kaleidescape_companion.library.config import (
    DEFAULTS,
    origin,
    validate,
)
from custom_components.kaleidescape_companion.library.parser import (
    artwork_path,
    catalog,
    details,
)
from custom_components.kaleidescape_companion.library.store import source_id, title_id
from custom_components.kaleidescape_companion.library.sync import LibrarySync
from custom_components.kaleidescape_companion.ui.http import LibraryArtworkView

ORIGIN = "http://fictional-cinema.local"
SOURCE = source_id(ORIGIN)
ROWS = [
    {
        "source_handle": "fixture-a",
        "source_group": "group-a",
        "title": "A Voyage to Europa",
        "rating": "PG",
        "year": 2025,
        "edition": "4K",
        "directors": ["A. Director"],
        "genres": ["Adventure"],
    },
    {
        "source_handle": "fixture-b",
        "source_group": "group-b",
        "title": "Midnight 100%_",
        "rating": "PG-13",
        "year": 2024,
        "edition": "HD",
        "directors": ["B. Director"],
        "genres": ["Drama"],
    },
    {
        "source_handle": "fixture-a2",
        "source_group": "group-a",
        "title": "A Voyage to Europa",
        "rating": "PG",
        "year": 2025,
        "edition": "HD",
        "directors": ["A. Director"],
        "genres": ["Adventure"],
    },
]


def listing(rows=ROWS, collections=("Played", "Paused", "Favorites"), expected=None):
    count = len({row["source_group"] for row in rows}) if expected is None else expected
    body = "".join(
        f'''<tr class="movie_container"
        selection_handle="{escape(row["source_handle"])}"
        selection_group="{escape(row["source_group"])}">
        <td class="movie_title"><a>{escape(row["title"])}</a></td>
        <td class="movie_rating">{escape(row["rating"])}</td>
        <td class="movie_year">{row["year"]}</td>
        <td class="movie_director">{escape(", ".join(row["directors"]))}</td>
        <td class="movie_genre">{escape(", ".join(row["genres"]))}</td>
        <td class="movie_media_type">{escape(row["edition"])}</td></tr>'''
        for row in rows
    )
    links = "".join(
        f'<a href="/movies?collection={escape(name)}&amp;sort=2">{escape(name)}</a>'
        for name in collections
    )
    return (
        f'<div id="collection_pulldown">{links}</div>'
        f'<span id="movie_count_str">{count or "No"}</span><table>{body}</table>'
    )


DETAIL = """<h1 id="movie_title">Fictional &amp; safe</h1>
    <div id="misc_text">Rated PG; 4K Digital, 2025, 123 min</div>
    <div id="cover_art"><img src="/webcovers/fixture.jpg"></div>
    <table><tr><th class="details_name">Cast</th>
    <td class="details_value">Fictional Actor, Zoë Example</td></tr>
    <tr><th class="details_name">Writer</th>
    <td class="details_value">A. Writer</td></tr>
    <tr><th class="details_name">Studio</th>
    <td class="details_value">Example Studio</td></tr>
    <tr><th class="details_name">Synopsis</th>
    <td class="details_value">A fictional voyage.</td></tr></table>"""


class LibraryParserTest(unittest.TestCase):
    def test_grouped_editions_unicode_and_escaped_text(self):
        rows, names = catalog(listing())
        self.assertEqual(len(rows), 3)
        self.assertEqual(rows[0]["source_group"], rows[2]["source_group"])
        self.assertNotEqual(rows[0]["source_handle"], rows[2]["source_handle"])
        self.assertEqual(names, ["Favorites", "Paused", "Played"])
        detail = details(DETAIL)
        self.assertEqual(detail["actors"], ["Fictional Actor", "Zoë Example"])
        self.assertEqual(detail["duration_seconds"], 7380)
        self.assertEqual(detail["writers"], ["A. Writer"])

    def test_empty_listing_requires_a_recognized_complete_page(self):
        self.assertEqual(catalog(listing([]))[0], [])
        for body in (
            "<h1>Login</h1>",
            listing(expected=99),
            listing().replace('id="movie_count_str"', 'id="unknown"'),
        ):
            with self.assertRaises(JournalError):
                catalog(body)
        self.assertIsNone(catalog(listing(collections=("Unrecognized",)))[1])

    def test_duplicate_version_rows_are_not_duplicate_movies(self):
        self.assertEqual(len(catalog(listing([ROWS[0], ROWS[0]]))[0]), 1)
        with self.assertRaises(JournalError):
            catalog(listing([ROWS[0], {**ROWS[0], "source_group": "other"}]))

    def test_scene_management_is_not_a_movie_collection(self):
        rows, names = catalog(
            listing(collections=("Played", "Paused", "Scenes", "Favorites"))
        )
        self.assertEqual(len(rows), 3)
        self.assertEqual(names, ["Favorites", "Paused", "Played"])
        # Continue to reject arbitrary non-listing HTML, including scene pages.
        with self.assertRaises(JournalError):
            catalog('<html><form id="scene_management">Scenes</form></html>')

    def test_scripts_and_external_or_traversing_artwork_are_not_used(self):
        for path in (
            "http://evil.invalid/a.jpg",
            "//evil.invalid/a.jpg",
            "/webcovers/../a.jpg",
            "/webcovers/%2e%2e/a.jpg",
            "/webcovers/a.jpg?token=secret",
            "/settings/a.jpg",
            "/webcovers/a.svg",
        ):
            self.assertIsNone(artwork_path(path))
        detail = details(
            DETAIL.replace("/webcovers/fixture.jpg", "http://evil.invalid/a.jpg")
            + '<script>throw new Error("never executed")</script>'
        )
        self.assertIsNone(detail["artwork_path"])
        self.assertEqual(details('<h1 id="movie_title">Example</h1>')["writers"], [])

    def test_host_validation_and_disabled_defaults(self):
        self.assertFalse(validate({}, {})["library_enabled"])
        self.assertEqual(origin(""), "http://my-kaleidescape.local")
        self.assertEqual(origin("fictional-cinema.local"), ORIGIN)
        for value in (
            "http://127.0.0.1",
            "http://169.254.169.254",
            "http://8.8.8.8",
            "http://user:pass@192.168.1.2",
            "http://192.168.1.2/path",
            "http://192.168.1.2?x=1",
            "http://192.168.1.2:8123",
            "file:///etc/passwd",
        ):
            with self.assertRaises(ValueError):
                origin(value)
        for key, value in (
            ("library_enabled", "false"),
            ("library_interval_hours", 0),
            ("library_interval_hours", float("nan")),
            ("library_artwork_cache_mb", 9000),
        ):
            with self.assertRaises(ValueError):
                validate({key: value}, {})


class LibraryStorageTest(unittest.IsolatedAsyncioTestCase):
    asyncSetUp = repository_tests.RepositoryTest.asyncSetUp
    assert_error = repository_tests.RepositoryTest.assert_error

    async def seed(self):
        await self.repository.async_library_catalog(
            ORIGIN,
            ROWS,
            {
                "Played": ["fixture-a", "fixture-b"],
                "Paused": ["fixture-b"],
                "Favorites": ["fixture-a"],
            },
        )
        await self.repository.async_library_details(
            SOURCE, title_id(SOURCE, "fixture-a"), details(DETAIL)
        )

    async def page(self, **filters):
        return await self.repository.async_library_list(SOURCE, filters)

    async def test_filters_status_priority_and_no_title_merging(self):
        await self.seed()
        self.assertEqual((await self.page())["total"], 3)
        self.assertEqual((await self.page(status="watched"))["total"], 1)
        self.assertEqual(
            (await self.page(status="in_progress"))["items"][0]["title"],
            "Midnight 100%_",
        )
        self.assertEqual((await self.page(status="unwatched"))["total"], 1)
        for key, value in (
            ("collection", "Favorites"),
            ("actor", "Zoë Example"),
            ("director", "A. Director"),
            ("rating", "PG"),
        ):
            self.assertGreater((await self.page(**{key: value}))["total"], 0)
        self.assertEqual((await self.page(query="100%_"))["total"], 1)
        self.assertEqual((await self.page(query="' OR 1=1 --"))["total"], 0)
        self.assertEqual((await self.repository.async_info())["viewing_count"], 0)
        row = (await self.page(actor="Zoë Example"))["items"][0]
        self.assertNotIn("source_handle", row)
        self.assertNotIn("artwork_path", row)

    async def test_first_seen_retained_and_complete_generations_mark_unavailable(self):
        await self.seed()
        first = (await self.page())["items"][0]["first_seen"]
        await self.repository.async_library_catalog(
            ORIGIN, [ROWS[0]], {"Played": ["fixture-a"]}
        )
        page = await self.page()
        self.assertEqual(page["total"], 1)
        self.assertEqual(page["items"][0]["first_seen"], first)
        raw = await self.repository.async_inspect("library")
        self.assertEqual(len(raw["items"]), 3)
        self.assertEqual(sum(row["available"] for row in raw["items"]), 1)

    async def test_multiselect_matches_any_value_within_and_all_facets_together(self):
        await self.seed()
        self.assertEqual(
            (await self.page(status=["watched", "in_progress"]))["total"], 2
        )
        self.assertEqual(
            (await self.page(collection=["Favorites", "Paused"]))["total"], 2
        )
        page = await self.page(
            collection=["Favorites", "Paused"], actor=["Missing", "Zoë Example"]
        )
        self.assertEqual(page["total"], 1)
        self.assertEqual(page["items"][0]["id"], title_id(SOURCE, "fixture-a"))
        self.assertEqual(
            (await self.page(rating=["PG", "PG-13"], director=["B. Director"]))[
                "total"
            ],
            1,
        )
        self.assertEqual((await self.page(collection=["' OR 1=1 --"]))["total"], 0)
        self.assertEqual((await self.page(actor=[]))["total"], 3)
        self.assertNotIn("writers", page["facets"])
        self.assertNotIn("studios", page["facets"])

    async def test_heading_sorts_are_stable_and_support_year_collections_and_added(
        self,
    ):
        await self.seed()
        self.assertEqual((await self.page(sort="year"))["items"][0]["year"], 2024)
        self.assertEqual(
            (await self.page(sort="year", descending=True))["items"][0]["year"], 2025
        )
        for sort in ("name", "year", "collection", "length", "watched", "added"):
            first = await self.page(sort=sort)
            self.assertEqual(await self.page(sort=sort), first)
            self.assertEqual(first["total"], 3)

    async def test_failed_generation_rolls_back_membership_and_availability(self):
        await self.seed()
        before = await self.page()
        with self.assert_error("library_changed"):
            await self.repository.async_library_catalog(
                ORIGIN, [ROWS[0]], {"Paused": ["missing-handle"]}
            )
        self.assertEqual(await self.page(), before)
        await self.repository.async_library_catalog(ORIGIN, ROWS, None)
        self.assertEqual((await self.page(status="in_progress"))["total"], 1)

    async def test_base_refresh_preserves_unchanged_enriched_credits(self):
        await self.seed()
        await self.repository.async_library_details(
            SOURCE,
            title_id(SOURCE, "fixture-a"),
            {"directors": ["A. Director", "Second Director"]},
            True,
        )
        await self.repository.async_library_catalog(ORIGIN, ROWS, None)
        self.assertEqual((await self.page(director="Second Director"))["total"], 1)

    async def test_failed_artwork_transaction_removes_orphan_and_preserves_prior_files(
        self,
    ):
        await self.seed()
        first = b"\xff\xd8\xfffirst"
        await self.repository.async_library_artwork_save(
            SOURCE, title_id(SOURCE, "fixture-a"), first, "image/jpeg", 20
        )
        key = hashlib.sha256(first).hexdigest()
        with closing(sqlite3.connect(self.path)) as db:
            db.execute(
                "CREATE TRIGGER fail_art BEFORE INSERT ON library_artwork "
                "BEGIN SELECT RAISE(ABORT,'fictional failure'); END"
            )
        with self.assert_error("storage_error"):
            await self.repository.async_library_artwork_save(
                SOURCE,
                title_id(SOURCE, "fixture-b"),
                b"\xff\xd8\xffsecond",
                "image/jpeg",
                10,
            )
        self.assertEqual(
            (await self.repository.async_library_artwork(SOURCE, key))[0], first
        )
        self.assertEqual(len(list((self.path.parent / "artwork").iterdir())), 1)

    async def test_unknown_status_until_collections_are_synced(self):
        await self.repository.async_library_catalog(ORIGIN, ROWS, None)
        self.assertEqual((await self.page(status="unknown"))["total"], 3)
        self.assertEqual((await self.page(status="unwatched"))["total"], 0)
        await self.seed()
        added = {**ROWS[0], "source_handle": "new-version", "source_group": "new-group"}
        await self.repository.async_library_catalog(ORIGIN, [*ROWS, added], None)
        self.assertEqual((await self.page(status="unknown"))["total"], 1)
        self.assertEqual((await self.page(status="unwatched"))["total"], 1)

    async def test_revision_bounds_invalid_sort_and_backup_barrier(self):
        await self.seed()
        for filters in (
            {"sort": "title;DROP TABLE viewings"},
            {"offset": True},
            {"offset": -1},
            {"status": "finished"},
            {"actor": ["x"] * 101},
            {"actor": [None]},
            {"status": ["watched", "finished"]},
            {"writer": "A. Writer"},
            {"studio": "Example Studio"},
            {"extra": "x"},
        ):
            with self.assert_error("invalid_request"):
                await self.repository.async_library_list(SOURCE, filters)
        with self.assert_error("refresh_required"):
            await self.page(revision=0)
        await self.repository.async_pause()
        with self.assert_error("backup_in_progress"):
            await self.repository.async_library_catalog(ORIGIN, [], {})
        self.assertEqual((await self.page())["total"], 3)
        await self.repository.async_resume()

    async def test_library_ceiling_preserves_space_and_write_access_for_recording(self):
        with patch(
            "custom_components.kaleidescape_companion.core.repository.MAX_LIBRARY_DATABASE_BYTES",
            1,
        ):
            with self.assert_error("library_storage_limit"):
                await self.repository.async_library_catalog(ORIGIN, ROWS, {})
        await self.repository.async_create(
            repository_tests.request_id(), repository_tests.viewing()
        )
        self.assertEqual((await self.repository.async_info())["viewing_count"], 1)

    async def test_length_and_status_sorts_are_local_and_bounded(self):
        rows = [
            {
                **ROWS[0],
                "source_handle": f"fictional-{n}",
                "source_group": f"group-{n}",
                "title": f"Film {n:03}",
            }
            for n in range(60)
        ]
        await self.repository.async_library_catalog(ORIGIN, rows, {})
        first = await self.page(sort="name")
        self.assertEqual(len(first["items"]), 50)
        self.assertTrue(first["has_more"])
        self.assertEqual(
            len((await self.page(offset=50, revision=first["revision"]))["items"]), 10
        )
        await self.repository.async_library_details(
            SOURCE, title_id(SOURCE, "fictional-0"), {"duration_seconds": 600}, True
        )
        self.assertEqual(
            (await self.page(sort="length", descending=True))["items"][0][
                "duration_seconds"
            ],
            600,
        )

    async def test_artwork_is_private_bounded_scoped_and_evicted(self):
        await self.seed()
        first = b"\xff\xd8\xff" + b"a" * 10
        second = b"\xff\xd8\xff" + b"b" * 10
        a, b = title_id(SOURCE, "fixture-a"), title_id(SOURCE, "fixture-b")
        await self.repository.async_library_artwork_save(
            SOURCE, a, first, "image/jpeg", 20
        )
        key = hashlib.sha256(first).hexdigest()
        self.assertEqual(
            (await self.repository.async_library_artwork(SOURCE, key))[0], first
        )
        path = self.path.parent / "artwork" / f"{key}.img"
        self.assertEqual(path.stat().st_mode & 0o777, 0o600)
        with self.assert_error("not_found"):
            await self.repository.async_library_artwork("other-source", key)
        await self.repository.async_library_artwork_save(
            SOURCE, b, second, "image/jpeg", 20
        )
        self.assertFalse(path.exists())
        self.assertLessEqual(
            (await self.repository.async_library_info(SOURCE))["artwork_bytes"], 20
        )
        self.assertEqual(
            (await self.page(actor="Zoë Example"))["items"][0]["artwork_key"], None
        )
        with self.assert_error("invalid_request"):
            await self.repository.async_library_artwork(SOURCE, "../../etc/passwd")
        with self.assert_error("library_artwork"):
            await self.repository.async_library_artwork_save(
                SOURCE, a, b"<svg></svg>", "image/jpeg", 20
            )

    async def test_artwork_missing_after_restore_is_repaired_on_open(self):
        await self.seed()
        image = b"\xff\xd8\xffpicture"
        await self.repository.async_library_artwork_save(
            SOURCE, title_id(SOURCE, "fixture-a"), image, "image/jpeg", 100
        )
        await self.repository.async_close()
        for path in (self.path.parent / "artwork").iterdir():
            path.unlink()
        self.repository = JournalRepository(self.path)
        self.addAsyncCleanup(self.repository.async_close)
        await self.repository.async_open()
        self.assertEqual(
            (await self.repository.async_library_info(SOURCE))["artwork_bytes"], 0
        )
        self.assertIsNone(
            (await self.page(actor="Zoë Example"))["items"][0]["artwork_key"]
        )

    async def test_artwork_rejects_linked_cache_files(self):
        await self.seed()
        image = b"\xff\xd8\xfffictional"
        await self.repository.async_library_artwork_save(
            SOURCE, title_id(SOURCE, "fixture-a"), image, "image/jpeg", 100
        )
        key = hashlib.sha256(image).hexdigest()
        path = self.path.parent / "artwork" / f"{key}.img"
        target = self.path.parent / "unrelated.txt"
        target.write_text("Unrelated private data")
        path.unlink()
        path.symlink_to(target)
        with self.assert_error("storage_error"):
            await self.repository.async_library_artwork(SOURCE, key)
        self.assertEqual(target.read_text(), "Unrelated private data")

    async def test_schema_five_upgrade_retains_journal_and_private_backup(self):
        created = await self.repository.async_create(
            repository_tests.request_id(), repository_tests.viewing()
        )
        await self.repository.async_close()
        with closing(sqlite3.connect(self.path)) as db:
            for table in (
                "database_audit",
                "settings",
                "library_collection_intents",
                "library_memberships",
                "library_collections",
                "library",
                "library_artwork",
                "library_sources",
            ):
                db.execute(f"DROP TABLE {table}")
            db.execute("DROP TABLE import_audit")
            from custom_components.kaleidescape_companion.core.migrations import (
                MIGRATIONS,
            )

            db.execute(MIGRATIONS[5][0])
            db.execute("ALTER TABLE schema_metadata DROP COLUMN settings_revision")
            db.execute("DROP TABLE calendar_sync_items")
            db.execute("DROP TABLE calendar_sync_jobs")
            db.execute("DROP TABLE calendar_publications")
            db.execute("DROP INDEX viewings_completed")
            db.execute("DROP INDEX viewings_library_title")
            db.execute("ALTER TABLE viewings DROP COLUMN library_title_id")
            db.execute("ALTER TABLE viewings DROP COLUMN library_metadata")
            db.execute("DROP TABLE playback_controls")
            db.execute("DROP TABLE calendar_managed_events")
            db.execute("DROP TABLE calendar_reconcile_candidates")
            db.execute("DROP TABLE calendar_reconcile_intents")
            db.execute("DROP TABLE IF EXISTS operation_logs")
            db.execute("DROP TABLE IF EXISTS log_state")
            db.execute("PRAGMA user_version=5")
            db.commit()
        self.repository = JournalRepository(self.path)
        self.addAsyncCleanup(self.repository.async_close)
        await self.repository.async_open()
        self.assertEqual((await self.repository.async_info())["schema_version"], 22)
        self.assertEqual(
            await self.repository.async_get(created["viewing"]["id"]),
            created["viewing"],
        )
        backup = next(self.path.parent.glob("journal.sqlite3.v5.*.bak"))
        self.assertEqual(backup.stat().st_mode & 0o777, 0o600)


class LibrarySyncTest(unittest.IsolatedAsyncioTestCase):
    asyncSetUp = LibraryStorageTest.asyncSetUp
    assert_error = LibraryStorageTest.assert_error
    seed = LibraryStorageTest.seed
    page = LibraryStorageTest.page

    async def connector(self, **config):
        async def executor(function, *args):
            return function(*args)

        hass = SimpleNamespace(async_add_executor_job=executor)
        sync = LibrarySync(
            hass, self.repository, {**DEFAULTS, "library_host": ORIGIN, **config}
        )
        sync._resolve = AsyncMock(return_value="192.168.50.10")
        return sync

    async def test_sync_toggles_skip_detail_artwork_and_collection_requests(self):
        sync = await self.connector(
            library_sync_details=False,
            library_sync_artwork=False,
            library_sync_collections=False,
        )
        sync._listing = AsyncMock(return_value=(ROWS, ["Played", "Paused"]))
        sync._get = AsyncMock()
        await sync._sync()
        sync._listing.assert_awaited_once_with("/movies")
        sync._get.assert_not_awaited()
        self.assertEqual((await self.page())["total"], 3)

    async def test_initial_collections_sync_skips_builtin_scene_management(self):
        sync = await self.connector(library_sync_details=False)
        pages = {
            "/movies": listing(collections=("Played", "Paused", "Scenes", "Favorites")),
            "/movies?collection=Favorites&sort=2": listing([ROWS[0]]),
            "/movies?collection=Paused&sort=2": listing([ROWS[1]]),
            "/movies?collection=Played&sort=2": listing([ROWS[0], ROWS[1]]),
        }
        sync._get = AsyncMock(side_effect=lambda path: pages[path])
        await sync._sync()
        self.assertIsNone(sync.error)
        self.assertEqual(
            (await self.repository.async_library_info(SOURCE))["collection_count"], 3
        )
        self.assertEqual((await self.page(collection="Favorites"))["total"], 1)
        self.assertEqual((await self.page(status="in_progress"))["total"], 1)
        self.assertFalse(
            any("Scenes" in call.args[0] for call in sync._get.await_args_list)
        )

    async def test_full_sync_uses_only_bounded_read_routes_and_caches_covers(self):
        sync = await self.connector(library_sync_artwork=True)
        sync._listing = AsyncMock(
            side_effect=[(ROWS, ["Played", "Paused"]), ([ROWS[0]], []), ([ROWS[1]], [])]
        )
        image = b"\xff\xd8\xfffictional-cover"
        sync._get = AsyncMock(
            side_effect=lambda path, **kw: (
                (image, "image/jpeg") if kw.get("image") else DETAIL
            )
        )
        await sync._sync()
        self.assertEqual((await self.page(status="in_progress"))["total"], 1)
        self.assertEqual((await self.page(actor="Zoë Example"))["total"], 3)
        self.assertGreater(
            (await self.repository.async_library_info(SOURCE))["artwork_bytes"], 0
        )
        for call in sync._get.await_args_list:
            self.assertTrue(call.args[0].startswith(("/details?id=", "/webcovers/")))

    async def test_collection_and_listing_failures_preserve_cache(
        self,
    ):
        await self.seed()
        sync = await self.connector(
            library_sync_details=False, library_sync_artwork=False
        )
        sync._listing = AsyncMock(
            side_effect=[
                (ROWS, ["Played"]),
                JournalError("library_format", "Bad format"),
            ]
        )
        await sync._sync()
        self.assertEqual((await self.page(status="in_progress"))["total"], 1)
        sync._listing = AsyncMock(
            side_effect=JournalError("library_unreachable", "Offline")
        )
        with self.assert_error("library_unreachable"):
            await sync._sync()
        self.assertEqual((await self.page())["total"], 3)

    async def test_dns_pinning_redirect_type_and_body_rejections(self):
        sync = await self.connector()
        # Exercise the real resolver with a mocked DNS response, never real DNS.
        del sync._resolve
        loop = asyncio.get_running_loop()
        with patch.object(
            loop,
            "getaddrinfo",
            AsyncMock(return_value=[(socket.AF_INET, 0, 0, "", ("127.0.0.1", 80))]),
        ):
            with self.assert_error("library_destination"):
                await sync._resolve()
        sync.address = "192.168.50.10"

        class Content:
            async def iter_chunked(self, size):
                yield b"<html></html>"

        response = SimpleNamespace(
            status=200,
            headers={},
            content_length=13,
            content_type="text/html",
            charset="utf-8",
            content=Content(),
        )

        class Context:
            async def __aenter__(self):
                return response

            async def __aexit__(self, *args):
                pass

        sync.session = SimpleNamespace(get=Mock(return_value=Context()))
        await sync._get("/movies")
        call = sync.session.get.call_args
        self.assertEqual(call.args[0].host, "192.168.50.10")
        self.assertFalse(call.kwargs["allow_redirects"])
        self.assertEqual(call.kwargs["headers"]["Host"], "fictional-cinema.local:80")
        for field, value in (
            ("status", 302),
            ("content_type", "application/javascript"),
            ("content_length", 9 * 1024 * 1024),
        ):
            prior = getattr(response, field)
            setattr(response, field, value)
            with self.assertRaises(JournalError):
                await sync._get("/movies")
            setattr(response, field, prior)
        response.headers["Content-Encoding"] = "gzip"
        with self.assert_error("library_response"):
            await sync._get("/movies")
        response.headers.clear()

        class Body:
            data = b"caf\xe9"

            async def iter_chunked(self, size):
                yield self.data

        response.content = Body()
        response.charset = None
        response.content_length = None
        self.assertEqual(await sync._get("/movies"), "café")
        response.content.data = b"x" * (8 * 1024 * 1024 + 1)
        with self.assert_error("library_too_large"):
            await sync._get("/movies")
        with self.assert_error("library_destination"):
            await sync._get("/settings")

    async def test_coalescing_pause_resume_and_unload_cancel_pending_work(self):
        sync = await self.connector()
        sync.hass.async_create_background_task = lambda coroutine, name: (
            asyncio.create_task(coroutine)
        )
        started = asyncio.Event()

        async def pending():
            started.set()
            await asyncio.Future()

        sync._sync = pending
        sync.request_sync()
        await started.wait()
        first = sync.task
        sync.request_sync()
        self.assertIs(sync.task, first)
        await sync.async_pause()
        self.assertTrue(first.cancelled())
        self.assertIsNone(sync.timer)
        with self.assert_error("not_ready"):
            sync.request_sync()
        await sync.async_resume()
        self.assertIsNotNone(sync.task)
        await sync.async_stop()
        self.assertIsNone(sync.task)
        self.assertIsNone(sync.timer)


class LibraryApiTest(unittest.IsolatedAsyncioTestCase):
    asyncSetUp = backend_tests.BackendTest.asyncSetUp
    call = backend_tests.BackendTest.call

    async def test_disabled_is_inert_and_readers_cannot_request_sync(self):
        self.assertIsNone(self.entry.runtime_data.library)
        for operation in ("library/info", "library/list", "library/sync"):
            result = await self.call(operation, **self.scope)
            self.assertEqual(result["code"], "library_disabled")
            reader = SimpleNamespace(
                id="fictional-reader", is_active=True, is_admin=False
            )
            result = await self.call(operation, user=reader, **self.scope)
            self.assertEqual(
                result["code"],
                "unauthorized" if operation == "library/sync" else "library_disabled",
            )

    async def test_enabled_lifecycle_and_read_projection(self):
        await async_unload_entry(self.hass, self.entry)
        object.__setattr__(self.entry, "data", {"library_enabled": True})
        with patch("custom_components.kaleidescape_companion.LibrarySync") as factory:
            sync = factory.return_value
            sync.async_start = AsyncMock()
            sync.async_stop = AsyncMock()
            sync.source = SOURCE
            sync.status.return_value = {"phase": "idle"}
            await async_setup_entry(self.hass, self.entry)
            sync.async_start.assert_awaited_once()
            await self.entry.runtime_data.repository.async_library_catalog(
                ORIGIN, ROWS, {}
            )
            result = await self.call("library/list", **self.scope)
            self.assertTrue(result["success"])
            self.assertEqual(result["result"]["total"], 3)
            await async_unload_entry(self.hass, self.entry)
            sync.async_stop.assert_awaited_once()

    async def test_active_readers_get_only_shared_library_fields_and_cached_artwork(
        self,
    ):
        object.__setattr__(self.entry, "data", {"library_enabled": True})
        runtime = self.entry.runtime_data
        runtime.library = SimpleNamespace(
            source=SOURCE, status=Mock(), async_stop=AsyncMock()
        )
        await runtime.repository.async_library_catalog(
            ORIGIN, ROWS, {"Played": [], "Paused": []}
        )
        reader = SimpleNamespace(id="fictional-reader", is_active=True, is_admin=False)
        info = (await self.call("info", user=reader))["result"]["entries"][0]
        self.assertTrue(info["library_enabled"])
        result = (await self.call("library/info", user=reader, **self.scope))["result"]
        self.assertEqual(
            set(result),
            {
                "title_count",
                "group_count",
                "status_counts",
                "name_count",
                "preferences_key",
                "collection_count",
                "revision",
                "last_synced_at",
                "collections_synced_at",
            },
        )
        runtime.library.status.assert_not_called()
        page = (await self.call("library/list", user=reader, **self.scope))["result"]
        self.assertEqual(page["total"], 3)
        for row in page["items"]:
            self.assertFalse(
                set(row)
                & {
                    "source_handle",
                    "source_group",
                    "source_id",
                    "origin",
                    "artwork_path",
                    "data",
                }
            )
        with patch.object(
            runtime.repository,
            "async_library_info",
            side_effect=AssertionError("Unauthorized storage read"),
        ):
            result = await self.call("library/sync", user=reader, **self.scope)
            self.assertEqual(result["code"], "unauthorized")
            reader.is_active = False
            for operation in ("library/list", "library/info"):
                result = await self.call(operation, user=reader, **self.scope)
                self.assertEqual(result["code"], "unauthorized")
        reader.is_active = True
        image = b"\xff\xd8\xfffictional-reader-cover"
        await runtime.repository.async_library_artwork_save(
            SOURCE, title_id(SOURCE, "fixture-a"), image, "image/jpeg", 100
        )
        key = hashlib.sha256(image).hexdigest()
        request = make_mocked_request(
            "GET", "/api/fictional", app={KEY_HASS: self.hass}
        )
        request["hass_user"] = reader
        view = LibraryArtworkView()
        self.assertEqual(
            (await view.get(request, **self.scope, cache_key=key)).body, image
        )
        original = runtime.repository.async_library_artwork

        async def deactivate(*args):
            result = await original(*args)
            reader.is_active = False
            return result

        with patch.object(runtime.repository, "async_library_artwork", deactivate):
            with self.assertRaises(web.HTTPForbidden):
                await view.get(request, **self.scope, cache_key=key)
        with patch.object(
            runtime.repository, "async_library_artwork", AsyncMock()
        ) as read:
            with self.assertRaises(web.HTTPForbidden):
                await view.get(request, **self.scope, cache_key=key)
            read.assert_not_awaited()
        reader.is_active = True
        original_list = runtime.repository.async_library_list

        async def deactivate_list(*args):
            result = await original_list(*args)
            reader.is_active = False
            return result

        with patch.object(runtime.repository, "async_library_list", deactivate_list):
            result = await self.call("library/list", user=reader, **self.scope)
            self.assertEqual(result["code"], "unauthorized")
            self.assertNotIn("Midnight", str(result))

    async def test_real_managed_session_lifecycle_without_any_device_requests(self):
        await async_unload_entry(self.hass, self.entry)
        object.__setattr__(self.entry, "data", {"library_enabled": True})
        connector = TCPConnector()
        self.addAsyncCleanup(connector.close)
        with (
            patch.object(LibrarySync, "_sync", AsyncMock()),
            patch(
                "homeassistant.helpers.aiohttp_client._async_get_connector",
                return_value=connector,
            ),
        ):
            await async_setup_entry(self.hass, self.entry)
            runtime = self.entry.runtime_data
            self.addAsyncCleanup(runtime.repository.async_close)
            self.assertIsNotNone(runtime.library.session)
            session = runtime.library.session
            await async_pre_backup(self.hass)
            self.assertTrue(
                (await runtime.repository.async_info())["backup_in_progress"]
            )
            await async_post_backup(self.hass)
            self.assertFalse(
                (await runtime.repository.async_info())["backup_in_progress"]
            )
            await async_unload_entry(self.hass, self.entry)
            self.assertIsNone(runtime.library.task)
            self.assertTrue(session.closed)
            self.assertIsNone(runtime.library.session)

    async def test_library_replies_and_cached_artwork_are_withheld_on_access_loss(self):
        object.__setattr__(self.entry, "data", {"library_enabled": True})
        repository = self.entry.runtime_data.repository
        self.entry.runtime_data.library = SimpleNamespace(
            source=SOURCE, status=lambda: {"phase": "idle"}, async_stop=AsyncMock()
        )
        await repository.async_library_catalog(ORIGIN, ROWS, {})
        image = b"\xff\xd8\xfffictional"
        await repository.async_library_artwork_save(
            SOURCE, title_id(SOURCE, "fixture-a"), image, "image/jpeg", 100
        )
        key = hashlib.sha256(image).hexdigest()
        view = LibraryArtworkView()
        request = make_mocked_request(
            "GET", f"/api/fictional/{key}", app={KEY_HASS: self.hass}
        )
        request["hass_user"] = self.admin
        response = await view.get(request, **self.scope, cache_key=key)
        self.assertEqual(response.body, image)
        self.assertEqual(response.headers["Cache-Control"], "no-store")
        original = repository.async_library_artwork

        async def revoke(*args):
            data = await original(*args)
            self.admin.is_active = False
            return data

        with patch.object(repository, "async_library_artwork", revoke):
            with self.assertRaises(web.HTTPForbidden):
                await view.get(request, **self.scope, cache_key=key)
        self.admin.is_active = True

        async def revoke_list(*args):
            self.admin.is_admin = False
            return {"items": [{"title": "Private fictional title"}]}

        with patch.object(repository, "async_library_list", revoke_list):
            result = await self.call("library/list", **self.scope)
            self.assertEqual(result["code"], "unauthorized")
            self.assertNotIn("Private fictional", str(result))

    async def test_opt_out_withholds_in_flight_results_before_reload(self):
        object.__setattr__(self.entry, "data", {"library_enabled": True})
        runtime = self.entry.runtime_data
        runtime.library = SimpleNamespace(source=SOURCE, async_stop=AsyncMock())

        async def opt_out(*args):
            object.__setattr__(self.entry, "data", {"library_enabled": False})
            return {"items": [{"title": "Private fictional result"}]}

        with patch.object(runtime.repository, "async_library_list", opt_out):
            result = await self.call("library/list", **self.scope)
            self.assertEqual(result["code"], "library_disabled")
            self.assertNotIn("Private fictional result", str(result))
