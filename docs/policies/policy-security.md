# Security policy and hardening

This policy describes current boundaries and development expectations, reviewed
2026-11-03. It is not a claim of isolation from Home Assistant itself. The
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

| Caller                        | Allowed scope                                                                                                                                                                   |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Anonymous or inactive account | No Companion household data or controls                                                                                                                                         |
| Active HA user                | Shared journal summary, enabled Library/artwork, own preferences, permitted HA Now Playing state and explicitly enabled player controls                                         |
| Active HA administrator       | Shared configuration, discovery/default player, journal/database edits and exports/imports, metadata review, collection additions, calendar management and uncertainty recovery |

The Basic/Advanced UI switch changes presentation, not authorization. The
backend derives actor identity from HA, validates entry/dataset/runtime scope,
and rechecks authorization across awaited work. User role changes clear browser
state and suppress late private responses. Requests cannot select another user's
preference owner or receipt. Accepted external actions cannot be recalled by
closing a dialog or revoking access after transmission.

Household summaries exclude private notes, raw source/player identities,
purchase prices/orders/store references and recorder diagnostics. Purchase dates
and shared viewing/movie facts are visible where the feature permits them. Now
Playing also respects source entity read permission. Administrators and HA
backups can access the full stored dataset; tombstones are not secure erasure.

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
Database condition search compiles a restricted grammar with bound parameters;
it does not accept arbitrary SQL. Imports are size/time/row bounded, reviewed
before applying, and cannot introduce network configuration or executable data.
Raw database files are opened defensively; application writes never execute SQL
from an import. The
[data-management design](../design/design-data-management.md) owns field rules,
limits and import/restore procedures.

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
accounts is outside scope.

An administrator's per-title Refresh searches the chosen public provider even
when a match is cached. Unique or explicitly selected results are downloaded
into that provider's cache; zero results record only a check time. Browser
requests cannot submit provider metadata directly. Field-source choices and
cover reset remain administrator-only, snapshot-checked Library writes. Provider
match links use validated HTTPS movie routes and open without a referrer;
arbitrary URLs from scraped metadata are not rendered.

## External mutations and recovery

HA authentication alone cannot make a device or calendar mutation atomic with
SQLite. Playback and collection writes reserve durable intent before sending,
send once, and preserve uncertainty after a possible send without a confirmed
outcome. Exact request retries retrieve the recorded result instead of sending
again. Calendar publishing/reconciliation has provider-specific evidence and
uncertainty rules. See each feature design for recovery and operator controls.

Backup/unload barriers stop new work and drain accepted operations before
storage closes. A failed observation after acknowledgement does not turn the
command into an unsent failure. Reconnect must not replay user writes. Protocol
ACKs do not prove physical outcome or exact movie edition.

The PoC's persistent pyk workflow includes ordinary initialization, local
events, version identification and automatic reconnect. These are compatible
with an opt-in connection and must not be prohibited by a blanket “no connection
writes” policy. Optional upstream logging/syslog changes require owner
agreement; Companion does not impose its household policy on all pyk callers.

## Logging, diagnostics and dependency review

[Logging and diagnostics](../design/design-logging.md) is the authoritative
logging mechanism and privacy policy. Use native module loggers and safe
exception summaries at owned boundaries. No raw credentials, household content,
protocol frames or request bodies belong in Companion logs at any severity. Its
diagnostic projection is bounded operational metadata, not a database export.
This policy does not guarantee that unrelated HA or dependency logs are
content-free.

Run dependency audits for the candidate Python and frontend lock/pin set; record
versions, exposure, mitigations and review decisions. Reconcile updates with
HA's constraints rather than force-installing incompatible versions. Historical
advisory totals are not current release evidence. No audit or removal of a
specific dependency finding is claimed by this documentation review.

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
