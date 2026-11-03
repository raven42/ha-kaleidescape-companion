"""Static usage/test guide generation; dashboard writes use HA's native API."""

from homeassistant.components.lovelace.const import LOVELACE_DATA, ConfigNotFound
from homeassistant.exceptions import HomeAssistantError
from homeassistant.util import yaml as yaml_util

from ..core.models import JournalError, identifier, text
from ..playback.control_config import host as control_host
from ..playback.now_playing import source_entity

MARKER = "kaleidescape_companion_test"


def dashboard_path(request_id):
    return f"companion-test-{identifier(request_id)}"


def guide(name, entry_id, player_ids, request_id, launch_enabled):
    """Build only fixed card types/options and static Markdown; no movie/device text."""

    def card(kind, **options):
        return {
            "type": f"custom:kaleidescape-{kind}-card",
            "entry_id": entry_id,
            **options,
        }

    def note(heading, body, config=None):
        code = "\n\n```yaml\n" + yaml_util.dump(config) + "```" if config else ""
        return {"type": "markdown", "content": f"## {heading}\n\n{body}{code}"}

    def case(heading, body, kind, **options):
        example = card(kind, **options)
        return {
            "type": "vertical-stack",
            "cards": [note(heading, body, example), example],
        }

    def view(title, path, cards, panel=False):
        return {
            "title": title,
            "path": path,
            **(
                {"type": "panel", "cards": [{"type": "vertical-stack", "cards": cards}]}
                if panel
                else {"cards": cards}
            ),
        }

    channel_a, channel_b = f"test-{request_id}-a", f"test-{request_id}-b"
    views = [
        view(
            "Start here",
            "guide",
            [
                note(
                    "Companion dashboard test guide",
                    "This is a separate, editable HA dashboard generated from "
                    "saved Companion settings. "
                    "Each view covers one feature. The YAML examples show the "
                    "exact card configuration. "
                    "No movie metadata, credentials, addresses or player serial"
                    " numbers are copied here. "
                    "Cards fetch current household data through your signed-in "
                    "HA account.\n\n"
                    "**Creating or opening this dashboard sends no player "
                    "commands, scans or scrapes.** "
                    "Remote and movie buttons act on real configured players "
                    "only when you press them. "
                    "Use a test player when checking those actions.\n\n"
                    "Check desktop, tablet and phone widths. Basic cards should"
                    " remain readable without "
                    "administrator tools. Repeat viewing as a standard user to "
                    "validate household access. "
                    "Remove this dashboard through HA dashboard settings when "
                    "finished.",
                )
            ],
        ),
        view(
            "Remote",
            "remote",
            [
                case(
                    "Default player remote",
                    "Expect a portrait remote with power, navigation/select and"
                    " transport buttons. "
                    "Transport stays disabled until the player is ready. Power "
                    "On may take time; "
                    "wait for readiness before testing playback. Choose Player "
                    "appears only when "
                    "multiple targets are configured. Choosing a target does "
                    "not change the household default. "
                    "Unconfirmed commands block further controls; review them "
                    "in Companion Advanced.",
                    "remote",
                ),
                *[
                    case(
                        f"Configured player {i + 1}",
                        "This card targets a specific opaque player ID. Compare"
                        " target selection with the "
                        "default remote; no commands are sent merely by loading"
                        " the card.",
                        "remote",
                        player_id=player,
                    )
                    for i, player in enumerate(player_ids[:2])
                ],
            ],
        ),
        view(
            "Now Playing",
            "now-playing",
            [
                case(
                    "Playback with controls",
                    "Expect the current title, authenticated cover, state and "
                    "runtime. When stopped, "
                    "expect No movie playing rather than stale artwork. If the "
                    "HA source is unavailable, "
                    "expect an unavailable message. While visible, snapshots "
                    "refresh about every five seconds. "
                    "Check standard-user artwork access too.",
                    "now-playing",
                    show_controls=True,
                ),
                case(
                    "Read-only playback display",
                    "The same playback data appears without the remote control "
                    "section.",
                    "now-playing",
                    show_controls=False,
                ),
            ],
        ),
        view(
            "Cover layouts",
            "covers",
            [
                case(
                    "Compact covers",
                    "Expect four covers per row and at most twelve per page. "
                    "There is no search toolbar, "
                    "title overlay, rating or statistics. Click a cover for "
                    "movie details. Pagination "
                    "appears only when more results exist. With fewer than "
                    "twelve titles, fewer covers is correct.",
                    "library-covers",
                    columns=4,
                    page_size=12,
                    show_titles=False,
                    show_format=False,
                    show_badges=False,
                    show_rating=False,
                    show_stats=False,
                ),
                case(
                    "Badges, titles and partial rows",
                    "Expect three covers per row and up to seven per page, "
                    "including a partial final row. "
                    "Title, highest video format, Library flags and rating "
                    "overlays are enabled. "
                    "Favorite is independent of New/Watched/In progress. "
                    "Missing ratings do not invent badges. "
                    "Footer totals remain global; pagination changes the "
                    "visible covers only.",
                    "library-covers",
                    columns=3,
                    page_size=7,
                    show_titles=True,
                    show_format=True,
                    show_badges=True,
                    show_rating=True,
                    show_stats=True,
                ),
            ],
        ),
    ]
    search_cards = [
        note(
            "Linked search and channel isolation",
            "Enter a known title or actor/director name in group A: only group "
            "A covers should change. "
            "Group B is independent. Partial names match by default; wrap a "
            "full name in double "
            "quotes for exact word matching. Clear restores that group's "
            "unfiltered list. "
            "Fuzzy behavior follows your personal global search preference. "
            "Searches do not replace "
            "your normal Companion Library preferences or navigate away from "
            "the dashboard.",
        )
    ]
    for label, channel in (("A", channel_a), ("B", channel_b)):
        search = card("library-search", channel=channel)
        covers = card("library-covers", channel=channel, columns=3, page_size=6)
        search_cards.append(
            {
                "type": "vertical-stack",
                "cards": [
                    note(
                        f"Search group {label}",
                        "These cards share this channel only.",
                        {"cards": [search, covers]},
                    ),
                    search,
                    covers,
                ],
            }
        )
    views.append(view("Linked search", "search", search_cards))
    launch = (
        "Movie Play follows player readiness and starts playback only when clicked."
        if launch_enabled
        else "Movie launch is disabled in saved settings; absence of Play is expected. "
        "Enable the separate launch opt-in in Companion if you want to test it."
    )
    views.append(
        view(
            "Full Library",
            "library",
            [
                case(
                    "Search at the top",
                    "This full-width Library has search, filters, sort and all "
                    "cover badges. "
                    "Use a filter and verify the blue Matches count, then clear"
                    " it. Person/detail links "
                    "replace search/filter criteria. " + launch,
                    "library",
                    columns=6,
                    page_size=18,
                    search_position="top",
                    show_filters=True,
                    show_sort=True,
                    show_rating=True,
                ),
                case(
                    "Search at the bottom",
                    "Search follows the covers. Filter/clear and sort controls "
                    "are hidden. Footer statistics and cover titles are hidden;"
                    " pagination still works.",
                    "library",
                    columns=5,
                    page_size=10,
                    search_position="bottom",
                    show_filters=False,
                    show_sort=False,
                    show_stats=False,
                    show_titles=False,
                ),
                case(
                    "Toolbar off / list layout",
                    "Expect a list with no search, filter or sort toolbar. "
                    "Movie details still open from entries. Changes in these "
                    "cards do not overwrite "
                    "personal Library display preferences.",
                    "library",
                    view="list",
                    page_size=10,
                    search_position="off",
                    show_filters=False,
                    show_sort=False,
                ),
            ],
            panel=True,
        )
    )
    views.append(
        view(
            "Journal calendar",
            "calendar",
            [
                case(
                    "Sized calendar",
                    "Use month arrows to reach a month containing Journal viewings. "
                    "Expect posters on start/completion days, overlapping "
                    "stacks for same-day movies, "
                    "and diagonal cuts for overnight viewings. Hover/focus "
                    "brings a rear poster forward. "
                    "Click a poster for viewing/movie details; "
                    "name/genre/year/rating links open Library. "
                    "The sticky footer shows all-time and selected-month "
                    "totals. Empty/loading/error "
                    "messages belong only in that footer. Month totals count "
                    "completion dates "
                    "(partial: start) once, assigning the whole recorded "
                    "watched time to that month.",
                    "journal-calendar",
                    calendar_size=100,
                    calendar_fit=False,
                ),
                case(
                    "Fit calendar to screen",
                    "Compare five- and six-week months and resize the window. "
                    "Day rows adapt to available height; very small screens may"
                    " still scroll. "
                    "Dashboard calendars do not publish to an HA calendar or "
                    "edit/delete Journal records.",
                    "journal-calendar",
                    calendar_size=100,
                    calendar_fit=True,
                ),
            ],
        )
    )
    config = {
        "title": name,
        MARKER: {"request_id": request_id, "entry_id": entry_id, "version": 1},
        "views": views,
    }
    return {
        "title": name,
        "url_path": dashboard_path(request_id),
        "config": config,
        "yaml": yaml_util.dump(config),
        "views": [v["title"] for v in views],
    }


async def prepare(hass, entry_id, runtime, name, request_id):
    name = text(name, 80).strip()
    request_id = identifier(request_id)
    if not name or any(ord(char) < 32 for char in name):
        raise JournalError(
            "invalid_request", "Enter a dashboard name of 1–80 characters"
        )
    entry = hass.config_entries.async_get_entry(entry_id)
    config = dict(entry.options or entry.data) if entry else {}
    missing = []

    def require(condition, message):
        if not condition:
            missing.append(message)

    require(
        LOVELACE_DATA in hass.data,
        "enable HA dashboards (Lovelace)",
    )
    if not config.get("library_enabled") or not runtime.library:
        require(False, "enable Library and run a successful sync")
    else:
        library = await runtime.repository.async_library_info(runtime.library.source)
        require(
            library["last_synced_at"] and library["group_count"],
            "sync at least one Library movie",
        )
    controls = runtime.controls
    require(
        config.get("control_enabled"),
        "enable playback controls",
    )
    require(
        controls is not None,
        "wait for the playback controls runtime to load",
    )
    try:
        control_host(config, config.get("library_host", ""))
    except ValueError:
        require(False, "correct the saved control hostname")
    require(
        config.get("control_player"),
        "select and save a default player",
    )
    entity = runtime.observer.entities.get("media_player") if runtime.observer else None
    if not entity and config.get("control_player"):
        entity = source_entity(hass, config["control_player"])
    require(
        entity and hass.states.get(entity) is not None,
        "configure an existing HA media-player source for Now Playing",
    )
    info = await runtime.repository.async_info()
    require(
        info["viewing_count"],
        "add or record at least one Journal viewing",
    )
    if missing:
        raise JournalError(
            "dashboard_prerequisites",
            "Before generating a test dashboard: "
            + "; ".join(missing)
            + ". Save settings first.",
        )
    players = [row["id"] for row in controls.players()]
    if not players:
        raise JournalError(
            "dashboard_prerequisites", "Configure a control player first"
        )
    return await hass.async_add_executor_job(
        guide,
        name,
        entry_id,
        players,
        request_id,
        bool(config.get("control_allow_launch")),
    )


async def verify(hass, entry_id, request_id):
    request_id = identifier(request_id)
    url_path = dashboard_path(request_id)
    data = hass.data.get(LOVELACE_DATA)
    dashboard = data.dashboards.get(url_path) if data else None
    if dashboard is None:
        raise JournalError(
            "dashboard_incomplete", "The test dashboard has not been created"
        )
    try:
        config = await dashboard.async_load(True)
    except ConfigNotFound as error:
        raise JournalError(
            "dashboard_incomplete",
            "The dashboard exists but its test configuration is not saved",
        ) from error
    except (HomeAssistantError, OSError, ValueError) as error:
        raise JournalError(
            "dashboard_unavailable",
            "HA could not read the test dashboard configuration; "
            "inspect it in Dashboards",
        ) from error
    if not isinstance(config, dict) or config.get(MARKER) != {
        "request_id": request_id,
        "entry_id": entry_id,
        "version": 1,
    }:
        raise JournalError(
            "dashboard_conflict",
            "Dashboard content no longer matches this generation request; it "
            "was not overwritten",
        )
    views = config.get("views")
    if not isinstance(views, list) or len(views) != 7:
        raise JournalError(
            "dashboard_conflict",
            "The test dashboard views changed; they were not overwritten",
        )
    return {"url_path": url_path, "views": len(views)}
