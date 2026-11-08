/** Settings navigation and search share one inventory of the editable options. */
import { SOURCE_FIELDS } from "../enrichment/sources";

export const SETTINGS_SECTIONS = [
  [
    "general",
    "General",
    "Make Companion feel at home",
    "Landing page, shared search and display preferences.",
  ],
  [
    "journal",
    "Journal",
    "Build your viewing journal",
    "Connect the playback sources and choose what counts as a viewing.",
  ],
  [
    "library",
    "Library",
    "Bring your collection together",
    "Local scanning, artwork storage and collection visibility.",
  ],
  [
    "playback",
    "Playback",
    "Choose how you control playback",
    "Connect your system and select the player used by Companion.",
  ],
  [
    "metadata",
    "Metadata",
    "Fill in the details",
    "Optional providers, credentials and preferred sources for movie information.",
  ],
  [
    "calendar",
    "Calendar",
    "Share your viewing history",
    "Publish completions, format events and manage a dedicated calendar.",
  ],
  [
    "automations",
    "Automations",
    "Set up your recurring workflows",
    "Install and update blueprints, then configure their inputs in Home Assistant.",
  ],
  [
    "maintenance",
    "Maintenance",
    "Manage and maintain Companion",
    "Settings transfer, metadata repair and a test dashboard.",
  ],
  [
    "about",
    "About",
    "About Kaleidescape Companion",
    "Installed versions, documentation and support information.",
  ],
] as const;
export type SettingsSection = (typeof SETTINGS_SECTIONS)[number][0];
export type SettingsDraft = Record<
  string,
  string | number | boolean | string[]
>;
export interface SettingField {
  key: string;
  label: string;
  hint: string;
  section: SettingsSection;
  type?: "number" | "text";
  min?: number;
  max?: number;
  unit?: string;
  placeholder?: string;
}
export const JOURNAL_FIELDS: SettingField[] = [
  {
    key: "media_player",
    label: "Media player",
    hint: "The built-in Kaleidescape media player to observe.",
    section: "journal",
    type: "text",
    placeholder: "media_player.your_player",
  },
  {
    key: "play_status",
    label: "Play-status sensor",
    hint: "Choose the exact play-status sensor for that player, including credits status.",
    section: "journal",
    type: "text",
    placeholder: "sensor.your_player_play_status",
  },
  {
    key: "media_location",
    label: "Media-location sensor",
    hint: "Choose the sensor that distinguishes main content from trailers and other material.",
    section: "journal",
    type: "text",
    placeholder: "sensor.your_player_media_location",
  },
  {
    key: "minimum_runtime_minutes",
    label: "Minimum movie runtime",
    hint: "Ignore shorter titles. Set to 0 to include every runtime; unknown runtimes wait for metadata.",
    section: "journal",
    type: "number",
    min: 0,
    max: 1440,
    unit: "minutes",
  },
  {
    key: "minimum_seconds",
    label: "Playback before credits completion",
    hint: "Main-content watch time required before confirmed credits can complete a viewing.",
    section: "journal",
    type: "number",
    min: 1,
    max: 3600,
    unit: "seconds",
  },
  {
    key: "resume_hours",
    label: "Resume window",
    hint: "Combine partial viewings resumed within this window. Set to 0 to keep them separate.",
    section: "journal",
    type: "number",
    min: 0,
    max: 168,
    unit: "hours",
  },
];
export const LIBRARY_FIELDS: SettingField[] = [
  {
    key: "library_host",
    label: "Kaleidescape Server Address",
    hint: "A local hostname or private IP address. Leave blank to use my-kaleidescape.local.",
    section: "library",
    type: "text",
    placeholder: "my-kaleidescape.local",
  },
  {
    key: "library_recent_purchase_weeks",
    label: "Recently Added purchase window",
    hint: "Show the Recently Added badge for recent purchases. Set to 0 to disable the purchase window.",
    section: "library",
    type: "number",
    min: 0,
    max: 520,
    unit: "weeks",
  },
  {
    key: "library_artwork_cache_mb",
    label: "Artwork storage limit",
    hint: "Older cached images can be removed and fetched again when space is needed.",
    section: "library",
    type: "number",
    min: 32,
    max: 4096,
    unit: "MiB",
  },
];
export const TOGGLES = [
  [
    "tracking_enabled",
    "Automatically record playback",
    "Add viewings to the Journal using the selected Home Assistant entities.",
    "journal",
  ],
  [
    "library_enabled",
    "Enable Library sync",
    "Read your local movie catalog. No Library requests run while this is off.",
    "library",
  ],
  [
    "library_sync_collections",
    "Collections and watched status",
    "Read collection membership and playback status from the system.",
    "library",
  ],
  [
    "library_sync_details",
    "Movie details and credits",
    "Include synopsis, cast and other details available from the source.",
    "library",
  ],
  [
    "library_sync_artwork",
    "Cover artwork",
    "Download covers to Companion's private image cache.",
    "library",
  ],
  [
    "library_allow_collection_add",
    "Allow collection changes",
    "Let administrators queue changes for a selected edition on the device. Requires collection sync. Watched and Unwatched are moves; In Progress requires playback to add.",
    "library",
  ],
  [
    "control_enabled",
    "Enable playback controls",
    "Make the remote available to active Home Assistant users.",
    "playback",
  ],
  [
    "control_allow_launch",
    "Allow Library title playback",
    "Experimental: launch a selected Library movie on your player. The player chooses the playable format.",
    "playback",
  ],
  [
    "calendar_enabled",
    "Add watched movies to calendar",
    "Publish new movie completions to your selected calendar.",
    "calendar",
  ],
] as const;
export const BOOLEAN_FIELDS = new Set([
  "fuzzy_search",
  ...TOGGLES.map(([key]) => key),
  "calendar_full_sync",
  "calendar_full_sync_dedicated",
  "metadata_store_enabled",
  "metadata_tmdb_enabled",
  "metadata_auto_save",
  "metadata_clear_tmdb_key",
]);
export const SETTINGS_INDEX: SettingField[] = [
  ...JOURNAL_FIELDS,
  ...LIBRARY_FIELDS,
  ...TOGGLES.map(([key, label, hint, section]) => ({
    key,
    label,
    hint,
    section,
  })),
  ...(
    [
      [
        "default_landing_page",
        "Default landing page",
        "general",
        "Shared starting page",
      ],
      [
        "fuzzy_search",
        "Fuzzy search",
        "general",
        "Shared spelling and partial matches",
      ],
      [
        "hidden_collections",
        "Hidden collection names",
        "library",
        "Shared labels and filter visibility",
      ],
      [
        "control_host",
        "Kaleidescape Player Address",
        "playback",
        "Private LAN hostname or IP",
      ],
      [
        "control_player",
        "Default player",
        "playback",
        "Discover and select a player",
      ],
      [
        "metadata_store_enabled",
        "Kaleidescape Store",
        "metadata",
        "Public Store metadata provider",
      ],
      ["metadata_tmdb_enabled", "TMDB", "metadata", "Movie metadata provider"],
      [
        "metadata_tmdb_credential",
        "TMDB credential",
        "metadata",
        "API key or read access token",
      ],
      [
        "metadata_clear_tmdb_key",
        "Remove TMDB credential",
        "metadata",
        "Clear saved key",
      ],
      [
        "metadata_auto_save",
        "Auto-save metadata edits",
        "metadata",
        "Save per-movie manager changes immediately",
      ],
      [
        "metadata_requests_per_second",
        "Request rate",
        "metadata",
        "Shared provider requests per second",
      ],
      [
        "calendar_entity",
        "Calendar destination",
        "calendar",
        "Home Assistant calendar",
      ],
      ["calendar_title", "Event title", "calendar", "Template placeholders"],
      [
        "calendar_description",
        "Event description",
        "calendar",
        "Template placeholders",
      ],
      [
        "calendar_full_sync",
        "Full Sync",
        "calendar",
        "Maintain a dedicated calendar",
      ],
      [
        "calendar_full_sync_dedicated",
        "Dedicated calendar acknowledgement",
        "calendar",
        "Unmatched events can be deleted",
      ],
      [
        "calendar_full_sync_months",
        "Full Sync age window",
        "calendar",
        "Months of history to maintain",
      ],
      [
        "blueprints",
        "Optional automations",
        "automations",
        "Receipt email, Library, metadata and calendar schedules; install, update and change log",
      ],
      [
        "transfer",
        "Settings transfer",
        "maintenance",
        "Export and import selected settings",
      ],
      [
        "repair",
        "Metadata repair",
        "maintenance",
        "Review cached metadata repairs",
      ],
      [
        "dashboard",
        "Test dashboard",
        "maintenance",
        "Create Home Assistant cards",
      ],
    ] as const
  ).map(([key, label, section, hint]) => ({ key, label, section, hint })),
  ...SOURCE_FIELDS.map(([field, label]) => ({
    key: `metadata_source_${field}`,
    label: `${label} source`,
    section: "metadata" as const,
    hint: "Preferred metadata source and fallback",
  })),
];

export function changedSettings(
  draft: SettingsDraft,
  initial: SettingsDraft,
): string[] {
  const value = (item: SettingsDraft[string] | undefined) =>
    Array.isArray(item) ? JSON.stringify(item) : String(item ?? "");
  return [...new Set([...Object.keys(draft), ...Object.keys(initial)])].filter(
    (key) => value(draft[key]) !== value(initial[key]),
  );
}
export function searchSettings(query: string): SettingField[] {
  const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return words.length
    ? SETTINGS_INDEX.filter((field) =>
        words.every((word) =>
          `${field.label} ${field.hint} ${field.section} ${field.key}`
            .toLocaleLowerCase()
            .includes(word),
        ),
      )
    : [];
}
