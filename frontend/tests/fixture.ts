/** Fictional in-memory transport for UI tests and the explicit review page only. */
import { ApiError, JournalClient } from "../src/api";
import type {
  ApiMessage,
  JournalInfo,
  MutationResult,
  NowPlayingPlayer,
  Transport,
  Viewing,
} from "../src/api";

export const info: JournalInfo = {
  entry_id: "fixture-entry",
  dataset_id: "a323bd20-1b55-4562-87b0-9999944759f3",
  api_version: 1,
  schema_version: 5,
  revision: 5,
  viewing_count: 3,
  database_bytes: 81920,
  database_limit_bytes: 268435456,
  backup_in_progress: false,
  tracking_enabled: true,
  permissions: { read: true, edit: true, export: true },
};
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
  revision = 5;
  failure: string | null = null;
  trackingEnabled = true;
  deletedRecords: Viewing[] = [];
  options: Record<string, string | number | boolean> = {
    tracking_enabled: true,
    media_player: "media_player.example",
    play_status: "sensor.example_status",
    media_location: "sensor.example_location",
    minimum_runtime_minutes: 10,
    minimum_seconds: 300,
    resume_hours: 24,
  };
  purgeResults = new Map<string, { purged_count: number; revision: number }>();
  importResults = new Map<
    string,
    { imported_count: number; skipped_count: number; revision: number }
  >();
  players: NowPlayingPlayer[] = [];
  retryResults = new Map<string, MutationResult>();
  async callWS<T>(message: ApiMessage): Promise<T> {
    this.calls.push(structuredClone(message));
    if (this.failure) throw new ApiError(this.failure);
    const operation = message.type.split("/").slice(1).join("/");
    let result: unknown;
    if (operation === "info")
      result = {
        entries: [
          {
            ...info,
            viewing_count: this.records.length,
            revision: this.revision,
            tracking_enabled: this.trackingEnabled,
          },
        ],
      };
    else if (operation === "now_playing") result = { players: this.players };
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
    } else if (operation === "database/inspect") {
      const tables: Record<string, Record<string, unknown>[]> = {
        viewings: [...this.records, ...this.deletedRecords].map((row) => ({
          ...row,
        })),
        sessions: [],
        requests: [],
        manual_audit: [],
        maintenance_audit: [],
        import_audit: [],
        schema_metadata: [{ revision: this.revision }],
      };
      const rows = tables[String(message.table)];
      if (!rows) throw new ApiError("invalid_request");
      if (message.revision != null && message.revision !== this.revision)
        throw new ApiError("refresh_required");
      const offset = Number(message.offset ?? 0);
      result = {
        table: message.table,
        tables: Object.fromEntries(
          Object.entries(tables).map(([name, rows]) => [name, rows.length]),
        ),
        items: rows.slice(offset, offset + 25),
        revision: this.revision,
        offset,
        has_more: rows.length > offset + 25,
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
    } else if (operation === "journal/list")
      result = {
        items: this.records.filter(
          (row) =>
            row.title
              .toLowerCase()
              .includes(String(message.query ?? "").toLowerCase()) &&
            (!message.status || row.status === message.status),
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
        saved = record({
          ...(message.data as Partial<Viewing>),
          id: crypto.randomUUID(),
          revision: 1,
          origin: "manual",
        });
        this.records.unshift(saved);
      } else if (
        operation === "journal/update" ||
        operation === "database/update"
      ) {
        saved = this.records[index] = {
          ...this.records[index],
          ...(message.patch as Partial<Viewing>),
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
    if (path?.includes("/import?")) {
      const query = new URL(path, "http://fixture.invalid").searchParams;
      const request = query.get("request_id")!;
      if (this.importResults.has(request))
        return new Response(JSON.stringify(this.importResults.get(request)));
      if (this.trackingEnabled)
        return new Response(JSON.stringify({ code: "tracking_enabled" }), {
          status: 409,
        });
      if (query.get("format") !== "json")
        return new Response(JSON.stringify({ code: "invalid_request" }), {
          status: 400,
        });
      try {
        const document = JSON.parse(await (init?.body as File).text());
        const rows = Array.isArray(document) ? document : document.viewings;
        if (
          !Array.isArray(rows) ||
          rows.some((row) => !row.id || !row.title || !row.started_at)
        )
          throw new Error("Invalid fixture import");
        let imported = 0,
          skipped = 0;
        for (const row of rows) {
          if (
            [...this.records, ...this.deletedRecords].some(
              (record) => record.id === row.id,
            )
          ) {
            skipped++;
            continue;
          }
          const viewing = record(row);
          (viewing.deleted_at ? this.deletedRecords : this.records).push(
            viewing,
          );
          imported++;
        }
        const result = {
          imported_count: imported,
          skipped_count: skipped,
          revision: ++this.revision,
        };
        this.importResults.set(request, result);
        return new Response(JSON.stringify(result));
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
