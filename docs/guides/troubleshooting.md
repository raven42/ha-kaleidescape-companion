# Troubleshooting and support

Start with the visible error, feature state and last confirmed outcome. The
current build is still preparing for alpha; a passing offline test suite does
not establish compatibility with every HA release, firmware or provider.

| Symptom                                                         | Check and recovery                                                                                                                                                                                                         |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Integration does not appear after copying files                 | Confirm the complete `custom_components/kaleidescape_companion/` path and restart HA Core. Check HA's integration/setup error and version compatibility.                                                                   |
| Panel or blueprint assets are missing                           | Install the complete runtime directory, including `ui/assets/`, `templates/` and bundled dependency files. Restart HA; a config-entry reload alone does not replace imported Python modules.                               |
| Journal is empty                                                | Confirm tracking is enabled and the media player plus both distinct sensors belong to the intended source. Check runtime/playing/credits rules in the [recording reference](../development/journal.md#automatic-tracking). |
| Library is disabled or stale                                    | Enable Library sync as administrator, check the selected server's LAN address and inspect sync status. Use Sync now after resolving the cause; retained cached data is not proof of a successful scan.                     |
| Manual viewing cannot be added                                  | Sync an enabled Library and select an exact available version with known positive runtime. Editing requires administrator access and the appropriate presentation controls.                                                |
| An edit reports stale state or lost permission                  | Refresh and review the current record; sign-in or role changes can invalidate a draft. Do not reinterpret a hidden control as authorization.                                                                               |
| A player, collection or calendar write has an uncertain outcome | Inspect its current status and recovery/readback flow. Do not blindly repeat a command whose first send may have succeeded.                                                                                                |
| Receipt import fails or saves unmatched purchases               | Review the action outcome and administrator purchase reconciliation. Invalid HTML, partial data and unmatched titles are distinct outcomes; see [receipt setup](../development/automations.md).                            |
| Setup rejects the stored database                               | Preserve the files and check the schema/version error. Do not overwrite a newer database with older code. Use a compatible backup with HA stopped.                                                                         |

## Gather useful evidence

Record the integration version, HA version, affected feature, minimal steps,
expected result and actual result. For device issues, include the relevant model
and firmware without publishing addresses or raw protocol frames. Describe
whether the result is reproducible with fictional data and whether an operation
may already have reached its destination.

Use Companion's bounded diagnostics and relevant HA logs. Review downloaded
diagnostics before sharing them. Ordinary diagnostics are not a database export;
the current receipt-import diagnostic exception can place full bounded email
content, prices and order identifiers in logs. Treat those logs as private. See
[logging](../development/logging.md) and
[security](../development/security.md#logging-diagnostics-and-dependency-review).

Report ordinary defects through the repository's issue tracker with sanitized
steps and bounded error details. Report suspected vulnerabilities privately to
the repository owner through an established private channel. Do not attach
household databases, credentials, raw receipt HTML or complete private logs to
public issues. A dedicated private reporting channel remains release work.

## Restore deliberately

Exports and full HA backups serve different purposes. A SQLite export does not
include cached artwork or HA configuration. Code rollback does not reverse
schema upgrades. Stop HA before replacing database/configuration files, preserve
the current state and choose a compatible backup. Retain pending-operation and
uncertainty evidence during recovery; it prevents duplicate external writes. See
[data management](../development/data-management.md) and
[backup contracts](../development/journal.md#exports-backups-and-restore).
