/** Fictional in-memory transport for UI tests and the explicit review page only. */
import { ApiError, JournalClient } from "../src/api";
import type {
  ApiMessage,
  JournalInfo,
  MutationResult,
  Transport,
  Viewing,
} from "../src/api";

export const info: JournalInfo = {
  entry_id: "fixture-entry",
  dataset_id: "a323bd20-1b55-4562-87b0-9999944759f3",
  api_version: 1,
  schema_version: 3,
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
          },
        ],
      };
    else if (operation === "journal/list")
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
      } else if (operation === "journal/update") {
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
      } else throw new ApiError("invalid_request");
      const mutation = { viewing: saved, revision: ++this.revision };
      this.retryResults.set(request, structuredClone(mutation));
      result = mutation;
    }
    return structuredClone(result) as T;
  }
  async fetchWithAuth(): Promise<Response> {
    return new Response(
      JSON.stringify({ metadata: info, viewings: this.records }),
    );
  }
  client() {
    return new JournalClient(this);
  }
}
