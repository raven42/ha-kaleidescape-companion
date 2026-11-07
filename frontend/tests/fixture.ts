/** Fictional in-memory transport for UI tests and the explicit review page only. */
import { matches } from "../src/core/search";
import { formatBadges } from "../src/library/badges";
import { purchaseValues } from "../src/library/purchase-details";
import { ApiError, JournalClient } from "../src/core/api";
import type {
  ApiMessage,
  ImportResult,
  JournalInfo,
  LibraryTitle,
  MutationResult,
  NowPlayingPlayer,
  Transport,
  Viewing,
} from "../src/core/api";

export const info: JournalInfo = {
  entry_id: "fixture-entry",
  dataset_id: "a323bd20-1b55-4562-87b0-9999944759f3",
  api_version: 1,
  pyk_version: "1.1.6",
  schema_version: 23,
  library_enabled: false,
  revision: 5,
  viewing_count: 3,
  database_bytes: 81920,
  database_limit_bytes: 268435456,
  backup_in_progress: false,
  tracking_enabled: true,
  permissions: { read: true, edit: true, export: true },
};
export function libraryTitle(
  overrides: Partial<LibraryTitle> = {},
): LibraryTitle {
  return {
    id: "a".repeat(64),
    title: "Voyage to Europa",
    first_seen: "2026-10-27T12:00:00Z",
    last_seen: "2026-10-27T12:00:00Z",
    metadata_synced_at: "2026-10-27T12:00:00Z",
    artwork_key: null,
    watched_status: "watched",
    collections: ["Played", "Science Fiction"],
    actors: ["Fictional Actor"],
    directors: ["Fictional Director"],
    writers: ["Fictional Writer"],
    studios: ["Example Studio"],
    genres: ["Science Fiction"],
    rating: "PG",
    year: 2025,
    edition: "4K",
    duration_seconds: 7200,
    synopsis: "An entirely fictional journey through the stars.",
    ...overrides,
  };
}
export function record(overrides: Partial<Viewing> = {}): Viewing {
  return {
    id: "7189938b-f61f-44c0-8b1c-f0be346e9551",
    title: "The Lantern Voyage",
    started_at: "2026-10-24T19:15:00Z",
    ended_at: "2026-10-24T21:05:00Z",
    duration_seconds: 7200,
    watched_seconds: 6600,
    status: "completed",
    notes: "A fictional viewing for interface testing.",
    source_id: "fictional-source",
    player_id: "fictional-player",
    raw_content_id: "26-0.0-S_fictional",
    revision: 2,
    origin: "observed",
    created_at: "2026-10-24T19:15:00Z",
    updated_at: "2026-10-24T21:05:00Z",
    completion_reason: "credits",
    deleted_at: null,
    ...overrides,
  };
}
export function playing(
  overrides: Partial<NowPlayingPlayer> = {},
): NowPlayingPlayer {
  return {
    player_id: "fictional-player",
    entity_id: "media_player.example",
    name: "Fictional cinema",
    title: "The Lantern Voyage",
    raw_content_id: "raw-fictional",
    duration_seconds: 7200,
    play_status: "playing",
    location: "content",
    available: true,
    observed_at: "2026-10-26T19:00:00Z",
    artwork_key: null,
    session: { watched_seconds: 600, credits_confirmed: false, gap_count: 0 },
    recording_paused: false,
    minimum_runtime_minutes: 10,
    recording_exclusion: null,
    recording_error: null,
    overflow_count: 0,
    buffered_observations: 0,
    ...overrides,
  };
}
export class FixtureTransport implements Transport {
  calls: ApiMessage[] = [];
  records = [
    record(),
    record({
      id: "02642a36-a1c1-4649-9433-91aa7c660352",
      title: "A Map of Quiet Places",
      status: "partial",
      watched_seconds: 1680,
      ended_at: null,
      completion_reason: null,
    }),
    record({
      id: "935ec542-7f4a-4ea5-8571-5a7ac6173468",
      title: "Midnight at the Observatory",
      origin: "manual",
      watched_seconds: 5400,
    }),
  ];
  libraryTitles = [
    libraryTitle(),
    libraryTitle({
      id: "b".repeat(64),
      title: "Midnight at the Observatory",
      watched_status: "in_progress",
      collections: ["Played", "Paused"],
      writers: [],
      duration_seconds: 5400,
    }),
    libraryTitle({
      id: "c".repeat(64),
      title: "The Lantern Voyage",
      watched_status: "unwatched",
      collections: [],
      studios: [],
    }),
  ];
  // Fictional source groups stay in the transport, outside public API records.
  libraryGroups = new Map<string, string>();
  purchaseUnavailable = new Set<string>();
  manualPurchaseValues = new Map<string, Record<string, string | null>>();
  private purchaseEditResults = new Map<string, unknown>();
  private groupKey(row: LibraryTitle) {
    return this.libraryGroups.get(row.id) ?? row.id;
  }
  preferencesKey = "0".repeat(64);
  revision = 5;
  failure: string | null = null;
  pendingAdds: {
    request_id: string;
    title_id: string;
    title: string;
    collection: string;
  }[] = [];
  calendarJob: {
    job_id: string;
    total: number;
    finished: boolean;
    counts: Record<string, number>;
  } | null = null;
  collectionResults = new Map<string, { status: string; request_id: string }>();
  trackingEnabled = true;
  deletedRecords: Viewing[] = [];
  options: Record<string, string | number | boolean | string[]> = {
    control_enabled: false,
    control_allow_launch: false,
    control_host: "",
    control_player: "",
    calendar_enabled: false,
    calendar_full_sync: false,
    calendar_full_sync_dedicated: false,
    calendar_full_sync_months: 3,
    calendar_full_sync_time: "03:00",
    calendar_title: "Watched: {title}",
    calendar_description: "Watched {title} · {watched} minutes",
    tracking_enabled: true,
    media_player: "media_player.example",
    play_status: "sensor.example_status",
    media_location: "sensor.example_location",
    minimum_runtime_minutes: 10,
    minimum_seconds: 300,
    resume_hours: 24,
    library_enabled: false,
    library_host: "",
    default_landing_page: "journal",
    library_interval_hours: 6,
    library_recent_purchase_weeks: 2,
    library_sync_collections: true,
    library_allow_collection_add: false,
    library_sync_details: true,
    library_sync_artwork: false,
    library_artwork_cache_mb: 512,
  };
  purgeResults = new Map<string, { purged_count: number; revision: number }>();
  importResults = new Map<
    string,
    { imported_count: number; skipped_count: number; revision: number }
  >();
  players: NowPlayingPlayer[] = [];
  retryResults = new Map<string, MutationResult>();
  uiPreferences: Record<string, unknown> = {
    view: "list",
    page_size: 100,
    cover_size: 150,
    cast_limit: 8,
    show_titles: true,
    show_format: true,
    show_badges: true,
    library_badge_style: "icons",
    movie_status_labels: "modern",
    show_rating: false,
    show_library_cost: false,
    widths: [360, 90, 260, 150, 140, 210],
    query: "",
    sort: "name",
    random_seed: "",
    descending: false,
    collection: [],
    actor: [],
    director: [],
    rating: [],
    genre: [],
    year: [],
    format: [],
    status: [],
    missing_metadata_artwork: false,
    missing_purchase_information: false,
    recently_added: false,
  };
  missingMetadataArtwork = new Set<string>();
  missingPurchaseInformation = new Set<string>();
  sharedPreferences: Record<string, unknown> = { hidden_collections: [] };
  searchPreferences: Record<string, unknown> = { fuzzy_search: true };
  interfacePreferences: Record<string, unknown> = { advanced_view: true };
  journalPreferences: Record<string, unknown> = {
    view: "list",
    calendar_size: 180,
    movie_details: "full",
    calendar_fit: false,
  };
  purchaseTotals = {
    purchase_count: 0,
    unique_transactions: 0,
    missing_purchase_prices: 0,
    missing_retail_prices: 0,
    missing_order_ids: 0,
    unpaired_prices: 0,
    duplicate_purchases: 0,
    currencies: [] as {
      currency: string;
      library_cost: string | null;
      retail_price: string | null;
      savings: string | null;
    }[],
  };
  databasePreferences: Record<string, unknown> = {
    limit: 25,
    show_system: false,
    table: "viewings",
    sorts: {},
  };
  databaseResults = new Map<string, unknown>();
  purchaseRecords: Record<string, unknown>[] = [];
  purchaseRepairEvents: Record<string, unknown>[] = [];
  viewingLinks = new Map<string, string>();
  private uiRevision = 0;
  async callWS<T>(message: ApiMessage): Promise<T> {
    this.calls.push(structuredClone(message));
    if (this.failure) throw new ApiError(this.failure);
    const operation = message.type.split("/").slice(1).join("/");
    let result: unknown;
    if (operation === "purchases/reconcile") {
      result = { empty: true };
    } else if (operation === "automations/status") {
      result = Object.fromEntries(
        [
          "purchase_email",
          "library_schedule",
          "metadata_schedule",
          "calendar_schedule",
        ].map((kind) => [
          kind,
          { status: "current", label: kind, revision: "fixture" },
        ]),
      );
    } else if (operation.startsWith("ui/")) {
      const shared = operation.startsWith("ui/shared/");
      const values = shared
        ? this.sharedPreferences
        : message.area === "database"
          ? this.databasePreferences
          : message.area === "search"
            ? this.searchPreferences
            : message.area === "journal"
              ? this.journalPreferences
              : message.area === "interface"
                ? this.interfacePreferences
                : this.uiPreferences;
      if (operation.endsWith("/get"))
        result = { values, revision: this.uiRevision };
      else {
        Object.assign(values, message.patch);
        result = { revision: ++this.uiRevision };
      }
    } else if (operation === "info")
      result = {
        entries: [
          {
            ...info,
            viewing_count: this.records.length,
            watched_seconds: this.records.reduce(
              (sum, row) => sum + row.watched_seconds,
              0,
            ),
            revision: this.revision,
            tracking_enabled: this.trackingEnabled,
            library_enabled: !!this.options.library_enabled,
            ui_defaults: {
              default_landing_page: String(this.options.default_landing_page),
            },
          },
        ],
      };
    else if (operation === "control/info")
      result = {
        enabled: !!this.options.control_enabled,
        allow_launch: !!this.options.control_allow_launch,
        default_player: this.options.control_player,
        players: this.options.control_player
          ? [
              {
                id: this.options.control_player,
                name: "Example Cinema",
                model: "Fictional player",
              },
            ]
          : [],
        can_manage: true,
        blocked_players: [],
        devices: [],
        pending: [],
      };
    else if (operation === "library/purchases/summary")
      result = { ...this.purchaseTotals, revision: this.revision };
    else if (operation === "library/info")
      result = {
        collection_add_enabled:
          !!this.options.library_allow_collection_add &&
          !!this.options.library_sync_collections,
        pending_adds: this.pendingAdds,
        preferences_key: this.preferencesKey,
        title_count: this.libraryTitles.length,
        name_count: new Set(
          this.libraryTitles.map((row) => row.title.toLowerCase()),
        ).size,
        group_count: new Set(
          this.libraryTitles.map((row) => this.groupKey(row)),
        ).size,
        collection_count: 3,
        collection_names: ["Played", "Paused", "Science Fiction"],
        revision: this.revision,
        last_synced_at: "2026-10-27T12:00:00Z",
        collections_synced_at: "2026-10-27T12:00:00Z",
        phase: "idle",
        error: null,
        processed: 0,
        total: 0,
        last_attempt: "2026-10-27T12:00:00Z",
        interval_hours: Number(this.options.library_interval_hours),
        collections_enabled: !!this.options.library_sync_collections,
        details_enabled: !!this.options.library_sync_details,
        artwork_enabled: !!this.options.library_sync_artwork,
        artwork_bytes: 0,
        artwork_limit_bytes:
          Number(this.options.library_artwork_cache_mb) * 1048576,
      };
    else if (operation === "library/viewing") {
      const title = this.libraryTitles.find(
        (row) => row.id === this.viewingLinks.get(String(message.viewing_id)),
      );
      result = {
        library: title
          ? {
              title_id: title.id,
              title: title.title,
              artwork_key: title.artwork_key,
            }
          : null,
      };
    } else if (
      operation === "library/purchases/edit/get" ||
      operation === "library/purchases/edit/save"
    ) {
      const title = this.libraryTitles.find(
        (row) => row.id === message.title_id,
      );
      if (!title) throw new ApiError("not_found");
      const group = this.groupKey(title);
      const rows = this.libraryTitles.filter(
        (row) => this.groupKey(row) === group,
      );
      const records = rows.flatMap((row) => row.purchase_history ?? []);
      const manual = rows
        .filter(
          (row) => row.purchased_on || this.manualPurchaseValues.has(row.id),
        )
        .map((row) => ({
          library_id: row.id,
          purchased_on: row.purchased_on ?? null,
          purchase_price: null,
          retail_price: null,
          order_id: null,
          href: null,
          ...this.manualPurchaseValues.get(row.id),
        }));
      const snapshot = this.revision.toString(16).padStart(64, "0");
      if (operation.endsWith("/get"))
        result = {
          snapshot,
          unavailable: this.purchaseUnavailable.has(group),
          records,
          manual,
        };
      else {
        const request = String(message.request_id);
        const previous = this.purchaseEditResults.get(request);
        if (previous) return previous as T;
        if (message.snapshot !== snapshot)
          throw new ApiError("refresh_required");
        const data = message.data as {
          receipt_id: string | null;
          unavailable: boolean;
          fields: Record<string, string | null>;
        };
        const index = records.findIndex(
          (record) => record.id === data.receipt_id,
        );
        const baseline = purchaseValues(records, manual, Math.max(index, 0));
        if (data.receipt_id && index < 0) throw new ApiError("not_found");
        if (data.unavailable) this.purchaseUnavailable.add(group);
        else this.purchaseUnavailable.delete(group);
        const record = index < 0 ? undefined : records[index];
        if (record) Object.assign(record, data.fields);
        if ("purchased_on" in data.fields) {
          const old = baseline.purchased_on;
          for (const row of rows)
            if (
              (old !== null && row.purchased_on === old) ||
              (!record && old === null && row.id === title.id)
            )
              row.purchased_on = data.fields.purchased_on;
        }
        for (const key of [
          "purchase_price",
          "retail_price",
          "order_id",
          "href",
        ] as const) {
          if (!(key in data.fields)) continue;
          const old = baseline[key];
          for (const row of rows) {
            const existing =
              this.manualPurchaseValues.get(row.id)?.[key] ?? null;
            if (
              (old !== null && existing === old) ||
              (!record && old === null && row.id === title.id)
            )
              this.manualPurchaseValues.set(row.id, {
                ...this.manualPurchaseValues.get(row.id),
                [key]: data.fields[key],
              });
          }
        }
        this.revision++;
        result = { title_id: title.id };
        this.purchaseEditResults.set(request, result);
      }
    } else if (operation === "library/versions") {
      if (message.revision !== undefined && message.revision !== this.revision)
        throw new ApiError("refresh_required");
      const title = this.libraryTitles.find(
        (row) => row.id === message.title_id,
      );
      if (!title) throw new ApiError("not_found");
      const rows = this.libraryTitles
        .filter((row) => this.groupKey(row) === this.groupKey(title))
        .map((row) => ({
          ...row,
          formats:
            row.formats ?? (row.edition === "Multiple" ? [] : [row.edition]),
        }));
      const offset = Number(message.offset ?? 0);
      result = {
        preferences_key: this.preferencesKey,
        items: rows.slice(offset, offset + 50).map((row) => ({
          ...row,
          missing_metadata_artwork: rows.some((item) =>
            this.missingMetadataArtwork.has(item.id),
          ),
        })),
        total: rows.length,
        offset,
        has_more: rows.length > offset + 50,
        revision: this.revision,
        group_purchase_details: {
          unavailable: this.purchaseUnavailable.has(this.groupKey(title)),
          records: rows.flatMap((row) =>
            (row.purchase_history ?? []).map((purchase) => ({
              ...purchase,
              imported_at: "2026-10-13T00:00:00Z",
              library_id: row.id,
              issue: null,
              token: "a".repeat(64),
            })),
          ),
          manual: rows
            .filter(
              (row) =>
                row.purchased_on || this.manualPurchaseValues.has(row.id),
            )
            .map((row) => ({
              library_id: row.id,
              purchased_on: row.purchased_on,
              purchase_price: null,
              retail_price: null,
              order_id: null,
              href: null,
              ...this.manualPurchaseValues.get(row.id),
              editable: true,
              date_only: !!row.purchase_history?.length,
            })),
          truncated: false,
        },
      };
    } else if (operation === "library/collections/targets")
      result = { collections: ["Science Fiction"], revision: this.revision };
    else if (operation === "library/collections/add") {
      const request = String(message.request_id);
      if (this.collectionResults.has(request))
        return this.collectionResults.get(request) as T;
      const version = this.libraryTitles.find(
        (item) => item.id === message.title_id,
      )!;
      version.collections = [
        ...new Set([...version.collections, String(message.collection)]),
      ];
      result = { status: "confirmed", request_id: request };
      this.collectionResults.set(
        request,
        result as { status: string; request_id: string },
      );
      this.revision++;
    } else if (
      operation === "library/collections/check" ||
      operation === "library/collections/acknowledge"
    ) {
      const request = String(message.request_id);
      if (operation.endsWith("acknowledge")) {
        this.pendingAdds = this.pendingAdds.filter(
          (item) => item.request_id !== request,
        );
        this.collectionResults.set(request, {
          status: "abandoned",
          request_id: request,
        });
      }
      result = this.collectionResults.get(request) ?? {
        status: "uncertain",
        request_id: request,
      };
    } else if (operation === "journal/metadata/preview") {
      result = {
        token: "a".repeat(64),
        updated_count: 3,
        unchanged_count: 2,
        unmatched_count: 1,
        active_count: 0,
      };
    } else if (operation === "journal/metadata/repair") {
      result = {
        updated_count: 3,
        unchanged_count: 2,
        unmatched_count: 1,
        active_count: 0,
        revision: ++this.revision,
      };
    } else if (operation === "database/import") {
      const request = String(message.request_id);
      if (this.importResults.has(request))
        result = this.importResults.get(request);
      else {
        result = {
          imported_count: (message.selected as string[]).length,
          updated_count: 0,
          skipped_count: 0,
          revision: ++this.revision,
        };
        this.importResults.set(request, result as ImportResult);
      }
    } else if (
      operation === "calendar/status" ||
      operation === "calendar/cancel"
    )
      result = {
        enabled: !!this.options.calendar_enabled,
        ready:
          !!this.options.calendar_enabled && !!this.options.calendar_entity,
        fingerprint: "fictional",
        active: false,
        maintenance: {
          enabled:
            !!this.options.calendar_full_sync &&
            !!this.options.calendar_enabled,
          ready: !!this.options.calendar_entity,
          active: false,
          uncertain: 0,
          quarantined: 0,
          last_success: null,
          error: "",
          counts: {},
        },
        completed_viewings: this.records.filter(
          (row) => row.status === "completed",
        ).length,
        job: this.calendarJob,
      };
    else if (operation === "calendar/sync") {
      const total = this.records.filter(
        (row) => row.status === "completed",
      ).length;
      this.calendarJob = {
        job_id: String(message.request_id),
        total,
        finished: true,
        counts: { created: total },
      };
      result = { job_id: message.request_id, total };
    } else if (operation === "library/search")
      result = {
        items: this.libraryTitles
          .filter((row) =>
            matches(
              row.title,
              String(message.query ?? ""),
              message.fuzzy !== false,
            ),
          )
          .slice(0, 10),
        has_more: false,
      };
    else if (operation === "library/sync") result = { accepted: true };
    else if (operation === "library/list") {
      const filters = (message.filters ?? {}) as Record<
        string,
        string | string[] | number | boolean
      >;
      const facets = Object.fromEntries(
        ["actors", "directors", "collections", "genres"].map((key) => [
          key,
          [
            ...new Set(
              this.libraryTitles.flatMap(
                (row) => row[key as keyof LibraryTitle] as string[],
              ),
            ),
          ].sort(),
        ]),
      );
      facets.rating = [...new Set(this.libraryTitles.map((row) => row.rating))];
      facets.year = [
        ...new Set(
          this.libraryTitles.flatMap((row) =>
            row.year == null ? [] : [String(row.year)],
          ),
        ),
      ];
      facets.format = [
        ...new Set(
          this.libraryTitles.flatMap((row) => [
            ...(row.formats ?? [row.edition]),
            ...formatBadges(row).map((badge) => badge.label),
          ]),
        ),
      ];
      const matchesStatus = (row: LibraryTitle, selected: string[]) => {
        const group = filters.grouped
          ? this.libraryTitles.filter(
              (candidate) => this.groupKey(candidate) === this.groupKey(row),
            )
          : [row];
        return selected.some((status) =>
          group.some((candidate) => {
            if (status === "favorite")
              return (
                !!candidate.is_favorite ||
                candidate.collections.some(
                  (name) => name.toLowerCase() === "favorites",
                )
              );
            if (status === "watch_soon")
              return (
                !!candidate.is_watch_soon ||
                candidate.collections.some(
                  (name) =>
                    name.toLowerCase().replace(/[\s_-]+/g, "") === "watchsoon",
                )
              );
            if (status === "recently_added")
              return !!candidate.is_recently_added;
            return (
              candidate.movie_statuses?.includes(
                status as "watched" | "unwatched" | "in_progress",
              ) ?? candidate.watched_status === status
            );
          }),
        );
      };
      let rows = this.libraryTitles.filter(
        (row) =>
          (!filters.scraper_conflict || !!row.scraper_conflict) &&
          (!filters.recently_added || row.is_recently_added) &&
          (!filters.missing_metadata_artwork ||
            this.libraryTitles.some(
              (candidate) =>
                this.groupKey(candidate) === this.groupKey(row) &&
                this.missingMetadataArtwork.has(candidate.id),
            )) &&
          (!filters.missing_purchase_information ||
            this.missingPurchaseInformation.has(row.id)) &&
          (!filters.query ||
            [row.title, ...row.actors, ...row.directors].some((value) =>
              matches(value, String(filters.query), !!filters.fuzzy),
            )) &&
          (!filters.status ||
            !(filters.status as string[]).length ||
            matchesStatus(row, filters.status as string[])),
      );
      for (const [filter, key] of [
        ["actor", "actors"],
        ["director", "directors"],
        ["collection", "collections"],
        ["genre", "genres"],
      ]) {
        const selected = filters[filter] as string[] | undefined;
        if (selected?.length)
          rows = rows.filter((row) =>
            selected.some((value) =>
              (row[key as keyof LibraryTitle] as string[]).includes(value),
            ),
          );
      }
      if ((filters.year as string[] | undefined)?.length)
        rows = rows.filter((row) =>
          (filters.year as string[]).includes(String(row.year)),
        );
      if ((filters.format as string[] | undefined)?.length)
        rows = rows.filter((row) =>
          (filters.format as string[]).some((value) =>
            [
              ...(row.formats ?? [row.edition]),
              ...formatBadges(row).map((badge) => badge.label),
            ].includes(value),
          ),
        );
      if ((filters.rating as string[] | undefined)?.length)
        rows = rows.filter((row) =>
          (filters.rating as string[]).includes(row.rating),
        );
      if (filters.grouped) {
        const matching = new Set(rows.map((row) => this.groupKey(row)));
        rows = [...matching].map((name) => {
          const versions = this.libraryTitles
            .filter((row) => this.groupKey(row) === name)
            .sort((a, b) => a.id.localeCompare(b.id));
          const minimum = versions
            .map((row) => row.duration_seconds)
            .filter((value): value is number => value !== null);
          return {
            ...versions[0],
            version_count: versions.length,
            content_ratings: [
              ...new Set(versions.map((row) => row.rating).filter(Boolean)),
            ].sort(),
            is_favorite: versions.some(
              (row) =>
                row.is_favorite ||
                row.collections.some(
                  (name) => name.toLowerCase() === "favorites",
                ),
            ),
            is_watch_soon: versions.some(
              (row) =>
                row.is_watch_soon ||
                row.collections.some(
                  (name) =>
                    name.toLowerCase().replace(/[\s_-]+/g, "") === "watchsoon",
                ),
            ),
            is_recently_added: versions.some((row) => row.is_recently_added),
            missing_metadata_artwork: versions.some((row) =>
              this.missingMetadataArtwork.has(row.id),
            ),
            formats: [
              ...new Set(
                versions.flatMap(
                  (row) =>
                    row.formats ??
                    (row.edition === "Multiple" ? [] : [row.edition]),
                ),
              ),
            ].sort(),
            years: [
              ...new Set(
                versions
                  .map((row) => row.year)
                  .filter((year): year is number => year !== null),
              ),
            ].sort(),
            collections: [
              ...new Set(versions.flatMap((row) => row.collections)),
            ].sort(),
            watched_status: versions.some(
              (row) => row.watched_status === "in_progress",
            )
              ? "in_progress"
              : versions.some((row) => row.watched_status === "watched")
                ? "watched"
                : versions.some((row) => row.watched_status === "unknown")
                  ? "unknown"
                  : "unwatched",
            duration_seconds: minimum.length ? Math.min(...minimum) : null,
            maximum_duration_seconds: minimum.length
              ? Math.max(...minimum)
              : null,
          };
        });
      }
      rows.sort((a, b) =>
        filters.sort === "length"
          ? (a.duration_seconds ?? 0) - (b.duration_seconds ?? 0)
          : filters.sort === "watched"
            ? a.watched_status.localeCompare(b.watched_status)
            : filters.sort === "year"
              ? (a.year ?? 0) - (b.year ?? 0)
              : filters.sort === "collection"
                ? ([...a.collections]
                    .sort()[0]
                    ?.localeCompare([...b.collections].sort()[0] ?? "") ?? -1)
                : filters.sort === "added"
                  ? a.first_seen.localeCompare(b.first_seen)
                  : a.title.localeCompare(b.title),
      );
      if (filters.sort === "random") {
        // A deterministic fixture shuffle; production uses SHA-256 on the worker.
        const rank = (id: string) => {
          let value = 2166136261;
          for (const char of `${filters.random_seed}:${id}`)
            value = Math.imul(value ^ char.charCodeAt(0), 16777619) >>> 0;
          return value;
        };
        rows.sort((a, b) => rank(a.id) - rank(b.id));
      } else if (filters.descending) rows.reverse();
      const limit = Number(filters.limit ?? 50);
      const offset = Number(filters.offset ?? 0);
      result = {
        preferences_key: this.preferencesKey,
        limit,
        items: rows.slice(offset, offset + limit).map((row) => ({
          ...row,
          missing_metadata_artwork:
            row.missing_metadata_artwork ??
            this.libraryTitles.some(
              (candidate) =>
                this.groupKey(candidate) === this.groupKey(row) &&
                this.missingMetadataArtwork.has(candidate.id),
            ),
        })),
        total: rows.length,
        offset,
        has_more: rows.length > offset + limit,
        revision: this.revision,
        facets,
        truncated_facets: [],
      };
    } else if (operation === "now_playing") result = { players: this.players };
    else if (operation === "settings/start")
      result = {
        type: "form",
        flow_id: "fixture-flow",
        errors: {},
        fields: Object.entries({
          ...this.options,
          tracking_enabled: this.trackingEnabled,
        }).map(([name, value]) => ({ name, default: value })),
      };
    else if (operation === "settings/cancel") result = { type: "abort" };
    else if (operation === "settings/submit") {
      this.options = message.data as typeof this.options;
      this.trackingEnabled = !!this.options.tracking_enabled;
      result = { type: "create_entry" };
    } else if (operation === "library/suggest") {
      const field = message.field === "actor" ? "actors" : "directors";
      const names = [
        ...new Set(this.libraryTitles.flatMap((row) => row[field])),
      ]
        .filter((name) =>
          matches(name, String(message.query ?? ""), !!message.fuzzy),
        )
        .sort();
      result = { items: names.slice(0, 20), has_more: names.length > 20 };
    } else if (operation === "database/validate_query")
      result = { valid: true };
    else if (operation === "database/mutate") {
      const request = String(message.request_id);
      if (this.databaseResults.has(request))
        return structuredClone(this.databaseResults.get(request)) as T;
      const data = message.data as {
        table: string;
        operation: string;
        expected_revision: number;
        rows: { key: Record<string, unknown>; token: string }[];
        patch: Record<string, unknown>;
      };
      if (data.expected_revision !== this.revision)
        throw new ApiError("conflict");
      const records = [...this.records, ...this.deletedRecords];
      if (data.table !== "viewings") throw new ApiError("invalid_request");
      const selected = data.rows.map((item) =>
        records.find((row) => row.id === item.key.id),
      );
      if (selected.some((row) => !row)) throw new ApiError("not_found");
      if (data.operation === "edit")
        Object.assign(selected[0]!, data.patch, {
          revision: selected[0]!.revision + 1,
        });
      else {
        const ids = new Set(selected.map((row) => row!.id));
        this.records = this.records.filter((row) => !ids.has(row.id));
        this.deletedRecords = this.deletedRecords.filter(
          (row) => !ids.has(row.id),
        );
      }
      result = {
        updated_count: data.operation === "edit" ? 1 : 0,
        deleted_count: data.operation === "delete" ? selected.length : 0,
        revision: ++this.revision,
      };
      this.databaseResults.set(request, result);
    } else if (operation === "database/inspect") {
      const tables: Record<string, Record<string, unknown>[]> = {
        settings: [
          {
            owner: "user:fictional-review",
            key: "library",
            value: JSON.stringify(this.uiPreferences),
            revision: this.uiRevision,
            updated_at: "2026-10-29T12:00:00Z",
          },
        ],
        library_collection_intents: [],
        calendar_managed_events: [],
        calendar_reconcile_candidates: [],
        calendar_reconcile_intents: [],
        calendar_publications: [],
        calendar_sync_jobs: [],
        calendar_sync_items: [],
        viewings: [...this.records, ...this.deletedRecords].map((row) => ({
          ...row,
        })),
        sessions: [],
        requests: [],
        manual_audit: [],
        maintenance_audit: [],
        import_audit: [],
        database_audit: [],
        schema_metadata: [{ revision: this.revision }],
        library_sources: [],
        library: [],
        purchase_records: this.purchaseRecords,
        purchase_repair_events: this.purchaseRepairEvents,
        purchase_identity_barriers: [],
        library_collections: [],
        library_memberships: [],
        library_artwork: [],
      };
      let rows = tables[String(message.table)];
      if (!rows) throw new ApiError("invalid_request");
      const revision =
        message.table === "settings" ? this.uiRevision : this.revision;
      if (message.revision != null && message.revision !== revision)
        throw new ApiError("refresh_required");
      const offset = Number(message.offset ?? 0);
      const limit = Number(message.limit ?? 25);
      const query = String(message.query ?? "");
      const columns = Object.keys(rows[0] ?? { id: "" });
      const sort = String(message.sort ?? columns[0]);
      if (query)
        rows = rows.filter((row) =>
          Object.values(row).some((value) => matches(String(value), query)),
        );
      rows.sort(
        (a, b) =>
          String(a[sort] ?? "").localeCompare(String(b[sort] ?? "")) *
          (message.descending ? -1 : 1),
      );
      const editable =
        String(message.table) === "viewings"
          ? [
              "title",
              "started_at",
              "ended_at",
              "duration_seconds",
              "watched_seconds",
              "status",
              "notes",
            ]
          : String(message.table) === "settings"
            ? ["value"]
            : [];
      result = {
        dataset_revision: this.revision,
        main_tables: ["viewings", "sessions", "library", "purchase_records"],
        schema: columns.map((name) => ({
          name,
          type: ["duration_seconds", "watched_seconds", "revision"].includes(
            name,
          )
            ? "number"
            : name === "value"
              ? "json"
              : "text",
          nullable: ["ended_at", "duration_seconds"].includes(name),
          editable: editable.includes(name),
          primary: name === "id" || name === "owner" || name === "key",
        })),
        query_fields: columns.map((name) => ({ name, type: "text" })),
        operators: ["=", "!=", "IS NULL", "IS NOT NULL", "LIKE", "CONTAINS"],
        deletable: [
          "viewings",
          "sessions",
          "library",
          "library_collections",
          "library_sources",
          "library_artwork",
          "settings",
          "library_memberships",
        ].includes(String(message.table)),
        row_tokens: rows
          .slice(offset, offset + limit)
          .map((row) => JSON.stringify(row)),
        table: message.table,
        tables: Object.fromEntries(
          Object.entries(tables).map(([name, rows]) => [name, rows.length]),
        ),
        items: rows.slice(offset, offset + limit),
        revision,
        offset,
        has_more: rows.length > offset + limit,
        limit,
        query,
        sort,
        columns,
        descending: !!message.descending,
        total: rows.length,
      };
    } else if (operation === "database/purge") {
      const request = String(message.request_id);
      if (this.purgeResults.has(request))
        return structuredClone(this.purgeResults.get(request)) as T;
      if (this.trackingEnabled) throw new ApiError("tracking_enabled");
      if (message.expected_revision !== this.revision)
        throw new ApiError("conflict");
      const count = this.records.length + this.deletedRecords.length;
      const ids = message.viewing_ids as string[];
      this.records = this.records.filter(
        (row) => !message.all && !ids.includes(row.id),
      );
      this.deletedRecords = this.deletedRecords.filter(
        (row) => !message.all && !ids.includes(row.id),
      );
      const receipt = {
        purged_count: count - this.records.length - this.deletedRecords.length,
        revision: ++this.revision,
      };
      this.purgeResults.set(request, receipt);
      result = receipt;
    } else if (
      operation === "journal/calendar" ||
      operation === "journal/calendar/get"
    ) {
      const summary = (row: Viewing) => ({
        id: row.id,
        title: row.title,
        started_at: row.started_at,
        ended_at: row.ended_at,
        duration_seconds: row.duration_seconds,
        watched_seconds: row.watched_seconds,
        status: row.status,
        origin: row.origin,
      });
      const movieFor = (row: Viewing) =>
        this.options.library_enabled
          ? this.libraryTitles.find(
              (title) => title.id === this.viewingLinks.get(row.id),
            )
          : undefined;
      if (operation.endsWith("/get")) {
        const row = this.records.find((row) => row.id === message.viewing_id);
        if (!row) throw new ApiError("not_found");
        const title = movieFor(row);
        result = {
          viewing: summary(row),
          movie: title
            ? {
                title: title.title,
                artwork_key: title.artwork_key,
                actors: title.actors,
                directors: title.directors,
                genres: title.genres,
                rating: title.rating,
                year: title.year,
                duration_seconds: title.duration_seconds,
                edition: title.edition,
                formats: title.formats ?? null,
              }
            : null,
        };
      } else {
        const monthRows = this.records.filter(
          (row) =>
            !row.deleted_at &&
            new Date(row.ended_at ?? row.started_at) >=
              new Date(String(message.start)) &&
            new Date(row.ended_at ?? row.started_at) <
              new Date(String(message.end)),
        );
        result = {
          summary: {
            viewing_count: monthRows.length,
            watched_seconds: monthRows.reduce(
              (total, row) => total + row.watched_seconds,
              0,
            ),
          },
          items: this.records
            .filter(
              (row) =>
                !row.deleted_at &&
                ((new Date(row.started_at) >= new Date(String(message.start)) &&
                  new Date(row.started_at) < new Date(String(message.end))) ||
                  (row.status === "completed" &&
                    row.ended_at &&
                    new Date(row.ended_at) > new Date(row.started_at) &&
                    new Date(row.ended_at) >= new Date(String(message.start)) &&
                    new Date(row.ended_at) < new Date(String(message.end)))) &&
                matches(
                  row.title,
                  String(message.query ?? ""),
                  message.fuzzy !== false,
                ) &&
                (!message.status || row.status === message.status) &&
                (!message.title_id ||
                  this.viewingLinks.get(row.id) === message.title_id),
            )
            .map((row) => ({
              ...summary(row),
              library_title_id: movieFor(row)?.id ?? null,
              artwork_key: movieFor(row)?.artwork_key ?? null,
            })),
          revision: this.revision,
        };
      }
    } else if (operation === "journal/list" || operation === "library/viewings")
      result = {
        items: this.records.filter(
          (row) =>
            matches(
              row.title,
              String(message.query ?? ""),
              message.fuzzy !== false,
            ) &&
            (!message.status || row.status === message.status) &&
            (operation !== "library/viewings" ||
              (() => {
                const linked = this.libraryTitles.find(
                  (title) => title.id === this.viewingLinks.get(row.id),
                );
                const selected = this.libraryTitles.find(
                  (title) => title.id === message.title_id,
                );
                return (
                  !!linked &&
                  !!selected &&
                  this.groupKey(linked) === this.groupKey(selected)
                );
              })()),
        ),
        revision: this.revision,
        next_cursor: null,
      };
    else if (operation === "journal/get") {
      result = this.records.find((row) => row.id === message.viewing_id);
      if (!result) throw new ApiError("not_found");
    } else if (operation === "journal/sessions")
      result = {
        items: [
          {
            id: "fictional-session",
            started_at: "2026-10-24T19:15:00Z",
            last_observed_at: "2026-10-24T21:05:00Z",
            watched_seconds: 6600,
            credits_confirmed: 1,
            gap_count: 0,
            end_reason: "stopped",
          },
        ],
        has_more: false,
      };
    else {
      const request = String(message.request_id);
      if (this.retryResults.has(request))
        return structuredClone(this.retryResults.get(request)) as T;
      const index = this.records.findIndex(
        (row) => row.id === message.viewing_id,
      );
      if (
        operation !== "journal/create" &&
        this.records[index]?.revision !== message.expected_revision
      )
        throw new ApiError("conflict");
      let saved: Viewing;
      if (operation === "journal/create") {
        const data = message.data as {
          library_title_id: string;
          started_at: string;
          status: string;
          watched_seconds?: number;
          notes: string;
        };
        const movie = this.libraryTitles.find(
          (row) => row.id === data.library_title_id,
        );
        if (!movie?.duration_seconds) throw new ApiError("invalid_request");
        const watched =
          data.status === "partial"
            ? data.watched_seconds!
            : movie.duration_seconds;
        saved = record({
          title: movie.title,
          started_at: data.started_at,
          status: data.status as Viewing["status"],
          notes: data.notes,
          ended_at: new Date(
            new Date(data.started_at).getTime() + watched * 1000,
          ).toISOString(),
          duration_seconds: movie.duration_seconds,
          watched_seconds: watched,
          id: crypto.randomUUID(),
          revision: 1,
          origin: "manual",
        });
        this.records.unshift(saved);
      } else if (
        operation === "journal/update" ||
        operation === "database/update"
      ) {
        const patch = {
          ...(message.patch as Partial<Viewing> & {
            library_title_id?: string;
          }),
        };
        if (operation === "journal/update" && "title" in patch)
          throw new ApiError("invalid_request");
        if (patch.library_title_id) {
          if (!this.options.library_enabled)
            throw new ApiError("library_disabled");
          const movie = this.libraryTitles.find(
            (row) => row.id === patch.library_title_id,
          );
          if (!movie) throw new ApiError("invalid_request");
          this.viewingLinks.set(this.records[index].id, movie.id);
          patch.title = movie.title;
          delete patch.library_title_id;
        }
        saved = this.records[index] = {
          ...this.records[index],
          ...patch,
          revision: this.records[index].revision + 1,
        };
      } else if (operation === "journal/delete") {
        saved = {
          ...this.records.splice(index, 1)[0],
          deleted_at: new Date().toISOString(),
        };
        this.deletedRecords.push(saved);
      } else throw new ApiError("invalid_request");
      const mutation = { viewing: saved, revision: ++this.revision };
      this.retryResults.set(request, structuredClone(mutation));
      result = mutation;
    }
    return structuredClone(result) as T;
  }
  async fetchWithAuth(path?: string, init?: RequestInit): Promise<Response> {
    if (path?.includes("/import/preview?")) {
      if (this.trackingEnabled)
        return new Response(JSON.stringify({ code: "tracking_enabled" }), {
          status: 409,
        });
      try {
        const document = JSON.parse(await (init?.body as File).text());
        const records = Array.isArray(document) ? document : document.viewings;
        const rows = records.map((row: Viewing) => ({
          key: `viewings:${row.id}`,
          title: row.title,
          table: "viewings",
          action: this.records.some((item) => item.id === row.id)
            ? "unchanged"
            : "new",
          changes: { title: { before: null, after: row.title } },
          conflicts: [],
          reason: "",
        }));
        return new Response(
          JSON.stringify({
            plan_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            revision: this.revision,
            expires_in: 600,
            rows,
            counts: {
              new: rows.filter(
                (row: { action: string }) => row.action === "new",
              ).length,
              merge: 0,
              unchanged: rows.filter(
                (row: { action: string }) => row.action === "unchanged",
              ).length,
              skip: 0,
            },
          }),
        );
      } catch {
        return new Response(JSON.stringify({ code: "invalid_request" }), {
          status: 400,
        });
      }
    }
    return new Response(
      JSON.stringify({ metadata: info, viewings: this.records }),
    );
  }
  client() {
    return new JournalClient(this);
  }
}
