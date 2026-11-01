# Interface research and capability limits

This is a retained summary of the October 2026 design research, not a current
compatibility certification. Household addresses, entity names, titles, IDs, and
raw library snapshots are deliberately excluded. Revalidate source behavior on
the selected supported HA/firmware release before relying on a new capability.
No device test or deployment is authorized by this document.

## Evidence and scope

The source review used HA's built-in Kaleidescape component at
[revision 9337c039ca18](https://github.com/home-assistant/core/tree/9337c039ca181612aa14354f068ea9b42758d8d1/homeassistant/components/kaleidescape)
and an upstream Python client snapshot
[pykaleidescape 1.2.0](https://github.com/SteveEasley/pykaleidescape/tree/50df2869349667d1e68d429b9b619e32ede9879b).
The installed HA 2026.10.4 manifest/runtime checked on October 30 instead uses
pykaleidescape 1.1.6; do not treat an upstream snapshot as HA's dependency pin.
Read-only browser-interface observations from October 20–22 used firmware assets
identified as `26.1.2-27147`. Those observations describe one source interface,
not a guarantee for other firmware or password-protected configurations.
Temporary research downloads are not a documentation dependency or public test
fixture.

The
[System Control Protocol reference](https://www.kaleidescape.com/wp-content/uploads/Kaleidescape-System-Control-Protocol-Reference-Manual.pdf)
and pinned source establish available interfaces; they do not establish that an
operator's installed integration exposes identical behavior. The journal
observes HA entities. The optional [library connector](library.md) now
implements restricted read-only browser GETs. The separately opted-in
[Companion controls](playback-controls.md#companion-setup-and-use) now consume
the independent API; the
[standalone protocol harness](playback-controls.md#standalone-protocol-proof-of-concept)
now permits explicit operator playback tests, without HA registration or
database changes. Local tests establish emulator behavior, not live-device
compatibility. Separately, operator-supplied output from October 30 establishes
one successful selected-title launch and STOP sequence; its
[scope and remaining limits](playback-controls.md#operator-validation--2026-10-30)
do not establish exact-edition or general firmware compatibility. The
[independent API project](https://pypi.org/project/kaleidescape-api/) now
implements the current Rev 17 request catalog and isolated experimental launch.
Expanded discovery, events, binary and music/disc capabilities are
emulator-tested; hardware validation remains separate.

## Existing HA entities

The reviewed
[media-player source](https://github.com/home-assistant/core/blob/9337c039ca181612aa14354f068ea9b42758d8d1/homeassistant/components/kaleidescape/media_player.py)
exposes title, raw content ID, duration, artwork, and optional
position/timestamp. Generic `playing` includes forward/reverse scans, and a zero
position can be omitted by a truthiness check. Validate position freshness and
zero handling on the installed release; missing position does not prevent
journal recording. Movie playback may have content type `stream`, so filtering
only `movie` would exclude valid observations.

Dedicated
[sensors](https://github.com/home-assistant/core/blob/9337c039ca181612aa14354f068ea9b42758d8d1/homeassistant/components/kaleidescape/sensor.py)
provide exact play status and media location. These are the implemented timing
inputs. Content location alone can include menus/extras, so credits evidence and
manual correction remain necessary; the rule does not prove complete-film
coverage.

The reviewed player supports power/play/pause/stop/next/previous, with no
`async_play_media` or `PLAY_MEDIA` capability. The
[remote source](https://github.com/home-assistant/core/blob/9337c039ca181612aa14354f068ea9b42758d8d1/homeassistant/components/kaleidescape/remote.py)
accepts an allowlist of navigation commands. Neither private integration runtime
objects nor a general protocol transport is an approved extension interface.

## Optional local library browser

| Observed route                                | Evidence and intended use                                                                               |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `/movies`                                     | Rows contain selection handles/groups, title, genre, rating, director, year, type, and version metadata |
| `/movies?collection=Played&sort=2`            | Editable source Played membership, with no dated viewing history                                        |
| `/movies?collection=New&sort=2`               | Source New membership, separate from journal status                                                     |
| `/movies?collection=Paused&sort=2`            | Source label, not a saved position; an empty count may be `No`                                          |
| Built-in `Scenes` menu                        | Opens scene management without a Movies listing/count; excluded from movie-collection discovery         |
| `/details?id=<handle>&callback=true`          | Details, group/version identifiers, synopsis/cast/genres/runtime, collection and artwork references     |
| `/KaleidescapeMovies.csv`                     | Title/genre/rating/lead actor/director/year/type/minute runtime; lacks stable IDs and memberships       |
| `/webcovers/...jpg`, `/webcoverslarge/...jpg` | Artwork references used by the opt-in restricted backend cache                                          |

Pages declared ISO-8859-1, with HTML-escaped attributes and embedded version
data. The CSV cannot be the sole identity/membership source. The interface
restricted framing and sent no-cache headers; build a native panel with
explicitly timestamped application caching instead of embedding vendor pages.
Referenced JavaScript updater routes were not selected as an API dependency. The
structural parser is implemented. Keep fixtures reduced and fictional or
sanitized; raw household pages remain outside the repository.

Scope is the observed local/downloaded library, not every cloud purchase. Played
and New are editable labels. They cannot establish dates, completed viewings,
rewatches, or saved positions. Preserve source-scoped selection groups/versions;
one observed resemblance between playback and browser IDs does not justify
universal prefix stripping, title matching, or automatic edition merging.

## Collection editing evidence (2026-10-28)

Read-only HTML/static-script inspection identified a multipart Movies POST for
adding selected handles to an existing collection. No POST was sent; removal and
writability semantics were not verified. The
[implemented add contract](library-collections.md) records observed field names,
unknowns, capability/authorization boundaries, preflight/read-back requirements,
and uncertain-result handling. Sync remains GET-only.

The same source listing contained `Multiple` summary rows followed by concrete
format rows, sometimes repeating the summary handle. The parser now retains
those concrete formats on the exact handle. No raw page or source script belongs
in fixtures, documentation, or the runtime bundle.

## Protocol and control gates

The published text protocol uses TCP port 10000. `GET_PLAY_STATUS` and
`GET_MOVIE_LOCATION` expose playback and content/intermission/credits state;
`GET_CONTENT_DETAILS` exposes metadata. `PLAY` operates on current/highlighted
content, not an arbitrary movie handle. `PERFORM_ACTION` documents music
handles; it is not evidence of movie launch. See the protocol reference,
especially its play-status/location/content-details and play/action sections.

The reviewed
[Python device implementation](https://github.com/SteveEasley/pykaleidescape/blob/50df2869349667d1e68d429b9b619e32ede9879b/kaleidescape/device.py)
and
[message parser](https://github.com/SteveEasley/pykaleidescape/blob/50df2869349667d1e68d429b9b619e32ede9879b/kaleidescape/message.py)
provide transport/navigation and content details. Pause uses toggle-style
semantics, so the control UI requires fresh state, serialization, and no blind
retry. No general public movie-by-handle launch, independent dated-history API,
or saved movie-offset query was identified in that review. The October 30
[selected-title playback investigation](playback-controls.md) adds concrete
third-party evidence for an undocumented `PLAY_MOVIE` command and documented
player enumeration. This changes launch from an unidentified interface to an
experimental implementation candidate; it does not establish vendor support,
target-firmware compatibility, saved resume, or exact-edition confirmation.

| Desired capability                | Required evidence before implementation                                          |
| --------------------------------- | -------------------------------------------------------------------------------- |
| Live progress                     | Reliable position/timestamp across play, pause, scan, zero, and restart          |
| Automatic catalog links           | Multiple exact source/player/version examples and recorded alias provenance      |
| Active transport                  | Installed HA feature flags, entity permissions, fresh identity, observed results |
| Selected-title play/resume        | Supported identifier and independently verified launch/saved-resume semantics    |
| Seek/start-over/edition selection | Explicit adapter capability with proven semantics                                |
| Historical import                 | A dated source with counts/rewatches, not just a Played label                    |

Keep independent capability gates: unresolved selected-title launch must not
block recording, browsing, or supported active transport. An onscreen navigation
macro or vendor-app handoff is a separate design choice, not an implicit
substitute.
