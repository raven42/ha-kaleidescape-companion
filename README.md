# Kaleidescape Companion

A Home Assistant integration for a household watch Journal, Now Playing and an
optional local movie Library. It observes playback through HA's built-in
**Kaleidescape** integration and offers optional metadata, purchases, calendars
and selected-player controls.

**Alpha preparation is in progress.** The current version is `0.1.0-dev.0`;
supported HA versions, project licensing, distribution and hardware/restore
qualification remain open. HA 2026.11.0 is the development baseline, not a
promised supported minimum. See the [roadmap](docs/development/roadmap.md).

## Install and try it

You need administrator access to Home Assistant and a compatible complete build
of this integration. Automatic recording also needs HA's built-in Kaleidescape
integration with a media player, play-status sensor and media-location sensor.
Keep that integration installed. Library and controls are separate opt-in
features; controls are not required for recording.

1. Back up the target HA configuration and Companion data before an upgrade.
2. Copy the complete built `custom_components/kaleidescape_companion/` directory
   into HA's configuration directory. Include the compiled frontend, templates
   and bundled dependency files; HA needs neither Node nor Vite.
3. Restart HA, then choose **Settings → Devices & services → Add integration →
   Kaleidescape Companion**.
4. Open **Kaleidescape Companion** in the sidebar. Review Settings before
   enabling features. To record playback, select the three existing entities and
   enable tracking; a qualified completed viewing appears in Journal.

Follow [getting started](docs/getting-started.md) for prerequisites, first use,
upgrade and recovery. A tagged public alpha and HACS publication are not yet
available as a supported installation path.

## Use Companion

- [Configuration and permissions](docs/guides/configuration.md): feature
  opt-ins, household/admin access and personal display profiles.
- [Journal and Library](docs/guides/journal-and-library.md): recording, first
  sync, manual viewings and corrections.
- [Troubleshooting and recovery](docs/guides/troubleshooting.md): diagnostics,
  failed operations and useful support reports.
- [All documentation](docs/README.md): setup and feature references, including
  dashboard cards, metadata, purchases, automations and calendars.

HA users can browse enabled household features. Administrators configure
features and manage private records; Basic/Advanced presentation does not grant
permissions. Recording, collection changes, player controls, experimental title
launch, calendar publishing and external metadata are separately enabled.

## Contribute

Use macOS or Linux with Bash, Python 3.14.2+ (SQLite 3.35+), Node.js 22.13+ on
22.x or 24+, and npm:

```sh
scripts/setup
scripts/build
scripts/check
scripts/package
```

[CONTRIBUTING.md](CONTRIBUTING.md) explains the workflow and links to the
engineering contracts. One checkout contains the sources, tests and pinned pyk
reconstruction inputs. The bundled pyk proof of concept remains until its
upstream and HA compatibility gates pass.

## Security

Custom integrations execute with HA's privileges. Read the
[security guide](docs/development/security.md) for permissions, private data,
logging limitations and reporting. Report suspected vulnerabilities to the
repository owner through an established private channel; keep credentials,
household logs and databases out of public issues. A dedicated private reporting
channel remains a release prerequisite.
