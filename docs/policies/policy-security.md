# Security policy and hardening

This policy describes current boundaries and development expectations, reviewed
2026-11-04. It is not a claim of isolation from Home Assistant itself. The
patched-pyk PoC and release gates are described in the
[pyk migration plan](../plans/plan-pykaliedescape-migration.md). A documentation
change does not remove a guard enforced by the current code.

## Trust model and HA ownership

Companion runs inside HA Core with HA's privileges. The HA administrator,
configuration directory, installed integrations, host and backup operators are
trusted. Other code in that process can read household data and credentials;
Companion is not a tenant boundary or encrypted vault. HA owns login, sessions,
user management, entity permissions, TLS at its frontend, calendar services,
logging and backup infrastructure. Follow HA's
[secure integration guidance](https://contributors.home-assistant.io/security/guides/integrations/).

Companion uses HA's authenticated HTTP and WebSocket interfaces rather than
introducing its own authentication server. It must still validate scope,
permissions, destinations and input, and project only fields allowed for the
caller. Runtime data belongs to the config entry, and cleanup follows HA's
lifecycle. No global logger, HTTP connector or built-in integration state may be
reconfigured to enforce a Companion-only policy.

Household deployment is supported by the development tooling; isolation is a
recommendation for development and destructive/recovery testing, not a runtime
requirement. Operators choose the HA host and backup/access controls. No extra
permission ceremony is required for ordinary enabled household actions.

## Access boundaries

| Caller                        | Allowed scope                                                                                                                                                                 |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Anonymous or inactive account | No Companion household data or controls                                                                                                                                       |
| Active HA user                | Shared journal summary, enabled Library/artwork, own preferences, permitted HA Now Playing state and explicitly enabled player controls                                       |
| Active HA administrator       | Shared configuration, discovery/default player, journal/database edits and exports/imports, metadata review, collection changes, calendar management and uncertainty recovery |

The Basic/Advanced UI switch changes presentation, not authorization. The
backend derives actor identity from HA, validates entry/dataset/runtime scope,
and must recheck authorization across awaited work. The purchase action also
checks the current actor and runtime before returning its private response. User
role changes clear browser state and suppress late private responses. Requests
cannot select another user's preference owner or receipt. Accepted external
actions cannot be recalled by closing a dialog or revoking access after
transmission.

The shared fuzzy-search setting is readable by all active household readers in
the public UI defaults; only administrators can change it through the validated
native options flow. Previous per-user search preferences remain isolated and
are ignored by the UI. Library and purchase summaries in Settings remain
administrator-only, and purchase totals retain their backend authorization.

The administrator settings form returns bounded entity suggestions (at most 500
media players and 500 sensors, with friendly names capped at 255 characters) and
a boolean indicating a stored TMDB credential. Suggestions contain entity IDs
and names, never states or attributes; saved credentials are never returned.
Permission/scope changes clear drafts and suppress late form/history responses.
Blueprint history is rendered as text from the bounded bundled template. Its
review does not grant write authority: installation and replacement still use
administrator checks and the existing revision guard for replacements.

Household summaries exclude private notes, raw source/player identities,
purchase prices/orders/store references and recorder diagnostics. Purchase dates
and shared viewing/movie facts are visible where the feature permits them. The
Library's group viewing summaries include completion times for household
readers, matching the shared calendar's viewing facts. Now Playing also respects
source entity read permission. Administrators and HA backups can access the full
stored dataset; tombstones are not secure erasure. The Watch Soon indicator,
like Favorite, exposes source collection membership for available movie groups
even when that collection name is hidden from lists. The consolidated Movie
status filter can also select those memberships and the reader-visible Recently
Added classification. Movie status also exposes membership in New, Played or
Paused even when those collection names are hidden; the personal label
preference changes only naming. Separate personal audio and video badge toggles
change presentation only and do not restrict Library data access. The Recently
Added badge also reveals whether a movie has a linked purchase within the
administrator-configured window; all Library readers see the badge. Library list
and version responses include a per-movie missing-metadata/artwork flag, which
exposes the same classification already available through the reader-accessible
filter. The corresponding warning overlay remains administrator-only. Movie
purchase history and Journal editing controls are shown only to administrators
in Advanced mode, including in dialogs opened from Journal. Backend
authorization remains the enforcement boundary. After a completed Library sync,
the Home Assistant persistent notification for missing metadata or artwork
exposes affected movie titles and their missing categories to users who can read
HA notifications. It contains no private purchase details, and titles are
rendered as text.

Library searches and selected filters are stored in the panel URL, not saved as
new user preferences. Their text can be exposed through browser history, shared
links and HTTP access logs. URL parameters are bounded and do not grant access;
the purchase-information filter remains administrator-only on the backend.

Companion's HA configuration switches and sync buttons can be operated by users
and automations allowed to control those entities by Home Assistant. They
validate the same integration settings and invoke the same background sync
operations as the administrator panel. Enabling calendar publishing can expose
movie information to the configured calendar's users. Restrict entity control
permissions accordingly.

The `import_purchase_email` action accepts private purchase data from HA
automations with no user context or active administrators. It validates and
bounds the input, saves unmatched purchases with no Library link, and applies
unambiguous, nonconflicting matches in one transaction. The receipt automation
fetches the HTML part for backend parsing; missing or unusable HTML is not
imported and is reported for review. Its administrator-selected fields control
what is stored; title and Store link are always extracted. An empty field
selection is rejected. A missing unselected or unavailable purchase date remains
null rather than being invented. Existing populated values are not overwritten;
conflicts are returned for review. Possible receipt duplicates are held without
being saved for administrator review; the heuristic is not proof of identity and
does not repair existing duplicates. The administrator-only import review shows
up to five possible existing invoices and their Library associations; it does
not select a possible duplicate for import automatically, even after a Library
match is chosen. Unique proposed matches are applied without human review and
are not proof of identity. An administrator can reconcile saved unmatched
purchases while recording remains active; choices are actor- and revision-bound
and require an available scanned Library entry. Match results include only
cached artwork keys; cover images use the existing authenticated Library artwork
endpoint. HA automation traces and action responses may contain private invoice
data and need appropriate access controls. Public store refresh may fill a
missing retail price, but never a purchase price. The missing purchase
information sensor exposes its count and bounded movie names to HA entity
readers. Its Library filter and purchase editing are limited to administrators.
The administrator's Advanced movie details include bounded group-wide purchase
history and row tokens. Reader version responses contain neither those records
nor their tokens. A purchase linked to one group member is not proof of a
particular format. The group editor validates the administrator, group snapshot,
receipt ownership and actor-bound request ID. Receipt corrections use the
revision-bound repair workflow and atomically include matching manual group
values and unavailable flags in reversible evidence. Group-only changes use the
same snapshot and retry safeguards. Store links accept only recognized official
Store hosts and paths, use HTTPS and `noopener noreferrer`, and are never
fetched automatically.

When HA automations are available, Companion installs missing packaged
blueprints through HA's blueprint manager. It does not create or enable an
automation or automatically replace existing files. A status check compares
normalized contents with known versions; unrecognized files are treated as
modified. Known outdated files trigger a startup warning and an HA persistent
notification. Administrators can explicitly replace a reviewed blueprint; its
revision and administrator access are checked again before HA writes it and
reloads dependent automations. HA is notified after an update, including when a
write may have succeeded but the reload could not be confirmed. Blueprint checks
do not log file contents. The library and calendar sync actions accept trusted
automation calls without a user context or active administrators; the calendar
action uses the same dedicated calendar and reconciliation checks as its button.
The purchase-email blueprint filters a selected IMAP entry and can filter sender
text, which does not authenticate the sender. Receipt values and action
responses can appear in HA automation traces. The receipt parser strips email
quote markers and, for a forward without an explicit purchase date, requires a
date adjacent to a Kaleidescape Store sender header instead of using the forward
date. That header is not authentication; forwarded receipts without a usable
original date are saved with an unknown date and reported for review. The
blueprint fetches the HTML part of the same IMAP message when available. Import
uses bounded decoding, reads visible table rows without loading external assets,
and associates movie links only with their own row and approved Store hosts.
Crossed-out prices are treated as retail and a single unmarked row price as the
purchase price; multiple unmarked prices remain ambiguous. Set rows can include
movie rows sequentially or nested inside the set row. When item and subtotal
markers exist, rows outside that region are excluded. Unmarked, headerless
layouts can still contain unrelated movie links, so they require careful review.
Plain-text item parsing is not used. HTML structural complexity is bounded
before receipt extraction. A missing retail price is never invented. Receipt
content may appear in HA logs under the diagnostic exception below. The metadata
refresh action accepts known provider names and only contacts enabled providers.
Calendar Full Sync remains restricted to an explicitly acknowledged dedicated
calendar, with its existing snapshot, grace and uncertainty checks. Its optional
automation requests the second check; no in-process schedule performs it.

## Storage, imports and rendering

Companion keeps its private data under HA's configuration directory. Its owned
private directories/files use `0700`/`0600`; symlink and hard-link checks
protect owned storage operations. This is not a requirement to recursively
change HA's configuration permissions. Installed integration code uses normal
readable `0755` directories and `0644` files. SQLite and artwork are not
encrypted by Companion. HA config-entry secrets and full backups require normal
HA protection.

One worker serializes SQLite access and transactions. Application edits use
validated fields, revisions, actor-bound request IDs and durable outcomes.
Database All mode fetches bounded, revision-checked inspection batches, reduces
batch size for oversized responses, and renders a window of compact row
summaries. Loaded identities/tokens occupy browser memory until refresh or
navigation, while selection and mutation limits remain enforced. Detail reads
are revision- and token-checked before editing. Database condition search
compiles a restricted grammar with bound parameters; it does not accept
arbitrary SQL. Imports are size/time/row bounded, reviewed before applying, and
cannot introduce network configuration or executable data. Raw database files
are opened defensively; application writes never execute SQL from an import. A
SQLite snapshot with the current purchase ledger takes invoice records from that
ledger rather than inferring them from flat Library prices. Database purchase
correction, void and reversal require an administrator-bound review, row token,
dataset revision and durable request ID. The group purchase editor uses the same
correction checks when saving its form. Full before/after invoice and
association evidence is private and append-only; prior identities are reserved
against silent replay. Similarity hints do not prove identity. Full SQLite
backups retain this evidence and the barriers; JSON exports and SQLite merge
imports do not transfer them, so they are not a full restore. Purchase-only
reconciliation can run while recording is active: the server validates that the
uploaded bundle contains only purchases and binds subsequent review and apply
operations to that validated plan. General imports still require recording
disabled. The [data-management design](../design/design-data-management.md) owns
field rules, limits and import/restore procedures.

Downloads are authenticated, bounded and marked private/no-store; private
exports include data omitted from normal household views. Full database restore
requires HA stopped. Backups and exports can consume space outside the database
cap. There is no automatic history retention, filesystem-wide quota or guarantee
against host disk exhaustion.

Frontend rendering treats titles, notes, provider metadata and device responses
as untrusted text. Do not use dynamic HTML, executable templates, remote scripts
or arbitrary asset URLs. Cached artwork passes format/signature/size validation
and authenticated serving; browser object URLs are bounded and revoked on scope
changes. Settings transfer excludes secrets. Development tokens stay in memory
and never enter bundles or browser persistent storage.

Collection changes remain separately opted in and administrator-only. The queue
persists actor-bound requests and permits at most ten active items. Accepted
requests are reauthorized before a single validated POST; complete collection
readback and a subsequent scan determine completion. New/Played moves validate
both collections, and Paused may only be removed. A possible send without
confirmed readback is durable uncertainty, never an automatic retry. Queued work
interrupted by restart is not replayed. Queue status and title identifiers are
private administrator data retained in SQLite backups; portable merge imports do
not execute queued work.

An administrator may explicitly refresh one version's collections using the
device's bounded details page. The title, source revision, explicit membership
field and cached collection names are checked before changing that version's
cache; an incomplete or unrecognized field fails closed. Refresh does not send a
device write or resolve an uncertain receipt. Administrators may dismiss
finished queue notices; active or uncertain work and its durable receipts cannot
be dismissed through that operation.

## Network boundaries

Network features are independently opted in. Disabled Library, metadata or
control work must remain inactive. Viewing cached data does not authorize a
scan, scrape, wake, launch or write. Keep application destination policy
separate from pyk's general-purpose hostname/custom-port support.

| Feature         | Current boundary                                                                                                                                                                                                     | Owning design                                     |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| Local Library   | Configured HTTP(S) origin on standard ports, eligible private LAN destination pinned for the request, fixed routes, no redirects/cookies/environment proxy, bounded HTML/images                                      | [Library](../design/design-library.md)            |
| Device controls | Configured seed, fixed TCP 10000, private address validation including rejection of mixed public/private DNS answers, selected player identity/capability verification, no subnet scan or arbitrary command endpoint | [Controls](../design/design-playback-controls.md) |
| Public metadata | Explicit provider enablement, approved HTTPS hosts/routes, public DNS checks and pinned connection, TLS verification, no redirects/account cookies, shared rate/body/time budgets                                    | [Metadata](../design/design-metadata.md)          |
| Calendar        | Configured HA calendar and HA service interfaces; no independent provider credentials or direct calendar service client                                                                                              | [Calendar](../design/design-calendar.md)          |

The local Library resolver selects an eligible private address; the control
resolver has its own stricter mixed-answer rejection. These are not identical
policies. Retain destination pinning and correct TLS hostname verification when
refactoring networking. Use HA HTTP/session/SSL helpers where compatible, with
owned sessions only for feature-specific state and connection policy.

The device's plain TCP interface supplies no Companion authentication or TLS. HA
access controls do not prevent another LAN host from reaching it. Public
metadata providers can observe the queried movie and outbound host address; they
do not receive journal history or private invoice data. Scraping private
accounts is outside scope. Automatic Store lookup accepts fixed public movie
slug and numeric receipt-detail routes. Numeric pages must map the requested
package ID to the returned edition and match the scanned title and year. When a
usable link is missing, automatic lookup may use the same fixed, bounded public
search routes as manual review. It accepts exactly one result with matching
cleaned title, year, scanned directors and four scanned actors, even on a full
search page. Additional results beyond that page may contain another match.
Missing credits, no match or multiple matches require review; the original
scanned credit evidence is rechecked before saving. The automatic search scope
does not enable Store image previews or other review-only routes. Store search
reads at most fifteen validated movie pages per query; administrator review
presents at most eight candidates and does not automatically select one.

An administrator's per-title Refresh searches the chosen public provider even
when a match is cached. Unique or explicitly selected results are downloaded
into that provider's cache; zero results record only a check time. With
auto-save disabled, these updates and image edits are staged until a single
snapshot-checked commit. Browser requests cannot submit provider metadata
directly. Field-source choices and image resets remain administrator-only,
snapshot-checked Library writes. Provider match links use validated HTTPS movie
routes and open without a referrer; arbitrary URLs from scraped metadata are not
rendered. When artwork sync is enabled, a metadata pass may request TMDB's fixed
movie image-list route and validated artwork to fill an empty selection,
including an automatic cover fallback when no selected cover exists.

Store quality facts are limited to recognized, available package labels from the
already validated public movie response. Automatic badges require compatible
local resolution and nonconflicting Store variants; a higher Store edition never
establishes audio for a locally lower-quality version. Explicit administrator
badge overrides are allowlisted, snapshot-checked and stored per version without
rewriting scanned data. Restoring server formats disables Store inference for
that version until automatic matching is selected again.

## External mutations and recovery

HA authentication alone cannot make a device or calendar mutation atomic with
SQLite. Playback and collection writes reserve durable intent before sending,
send once, and preserve uncertainty after a possible send without a confirmed
outcome. Exact request retries retrieve the recorded result instead of sending
again. Calendar publishing/reconciliation has provider-specific evidence and
uncertainty rules. See each feature design for recovery and operator controls.

Backup/unload barriers stop new work and drain accepted operations before
storage closes. Control reads are owned and cancelled or drained before their
clients are closed; accepted control writes retain their outcome handling. A
failed observation after acknowledgement does not turn the command into an
unsent failure. Reconnect must not replay user writes. Protocol ACKs do not
prove physical outcome or exact movie edition.

The PoC's persistent pyk workflow includes ordinary initialization, local
events, version identification and automatic reconnect. These are compatible
with an opt-in connection and must not be prohibited by a blanket “no connection
writes” policy. Optional upstream logging/syslog changes require owner
agreement; Companion does not impose its household policy on all pyk callers.

## Logging, diagnostics and dependency review

[Logging and diagnostics](../design/design-logging.md) is the authoritative
logging mechanism and privacy policy. Use native module loggers and safe
exception summaries at owned boundaries. Setup and backup hooks suppress raw
exception chains in framework-facing errors after attempting cleanup. Receipt
import is an explicit temporary diagnostic exception: failed or incomplete
imports log the bounded full receipt, extracted results and reasons at warning;
successful imports log them at debug. Unexpected failures also include their
tracebacks. These logs can contain titles, prices, order IDs, addresses, local
paths and other email contents. Protect HA log access and remove this exception
once diagnostics are no longer needed. Outside receipt import, no raw
credentials, household content, protocol frames or request bodies belong in
Companion logs at any severity. Its diagnostic projection is bounded operational
metadata, not a database export. This policy does not guarantee that unrelated
HA or dependency logs are content-free.

Run dependency audits for the candidate Python and frontend lock/pin set; record
versions, exposure, mitigations and review decisions. Reconcile updates with
HA's constraints rather than force-installing incompatible versions. Historical
advisory totals are not current release evidence. Keep current findings and
dispositions in [dated audit reports](../../audit/README.md); a policy update
alone does not resolve a dependency finding.

## Development, deployment and reporting

Normal tests are offline and use fictional data. Real-device control tests,
network-provider qualification, deployment and restart require the operator's
explicit action/authorization. An inventory of owned hardware is not that
authorization. Use the [development guide](../guides/guide-development.md) and
[deployment guide](../guides/guide-deployment.md) for the actual workflow.

Deployment uses operator-controlled SSH configuration, known host keys and key
or agent authentication without agent forwarding. The configured HA path may
resolve through an existing alias; managed installation/staging directories must
not be links. Replacement affects only Companion's runtime directory. It does
not make a database backup, automatically restart HA or provide crash-atomic
rollback. Compatible backups and schema checks matter when downgrading.

The project has no published supported-release matrix or private reporting
channel yet. Send findings to the owner through an established private channel;
do not publish credentials, household logs or databases. Before distribution,
complete release metadata and a reporting path. Changes to these boundaries must
update the owning design and add focused regression coverage.
