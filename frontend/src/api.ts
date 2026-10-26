/** Typed journal API. All access control and database work stays in HA. */
export type JournalStatus = "partial" | "completed";
export interface Scope {
  entry_id: string;
  dataset_id: string;
}
export interface JournalInfo extends Scope {
  api_version: number;
  schema_version?: number;
  revision: number;
  viewing_count: number;
  database_bytes?: number;
  database_limit_bytes?: number;
  backup_in_progress?: boolean;
  tracking_enabled?: boolean;
  permissions: { read: boolean; edit: boolean; export: boolean };
}
export interface ViewingData {
  title: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  watched_seconds: number;
  status: JournalStatus;
  source_id: string | null;
  player_id: string | null;
  raw_content_id: string | null;
  notes: string;
}
export interface Viewing extends ViewingData {
  id: string;
  origin: "manual" | "observed";
  revision: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  completion_reason: string | null;
}
export type ViewingSummary = Pick<
  Viewing,
  | "id"
  | "title"
  | "started_at"
  | "ended_at"
  | "duration_seconds"
  | "watched_seconds"
  | "status"
  | "origin"
>;
export interface Session {
  id: string;
  started_at: string;
  last_observed_at: string;
  watched_seconds: number;
  credits_confirmed: number;
  gap_count: number;
  end_reason: string | null;
}
export interface SessionPage {
  items: Session[];
  has_more: boolean;
}
export interface JournalPage {
  items: ViewingSummary[];
  revision: number;
  next_cursor: string | null;
}
export interface MutationResult {
  viewing: Viewing;
  revision: number;
}
export type ApiMessage = Record<string, unknown> & { type: string };
export interface Transport {
  callWS<T>(message: ApiMessage): Promise<T>;
  fetchWithAuth(path: string, init?: RequestInit): Promise<Response>;
}
export interface Hass extends Transport {
  user?: { id: string; is_admin: boolean; name?: string };
  connection: { connected: boolean };
}
export interface PreparedMutation {
  readonly scope: Scope;
  readonly message: Readonly<ApiMessage>;
}
export class ApiError extends Error {
  constructor(public readonly code: string) {
    super(code);
  }
}
const DOMAIN = "kaleidescape_companion";
const REQUEST_TIMEOUT = 15000;
const scopeFields = ({ entry_id, dataset_id }: Scope): Scope => ({
  entry_id,
  dataset_id,
});
export const MAX_DOWNLOAD_BYTES = 256 * 1024 * 1024;

export function errorCode(error: unknown): string {
  return typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
    ? error.code
    : "connection_lost";
}
export function errorMessage(error: unknown): string {
  const messages: Record<string, string> = {
    unauthorized:
      "Access to this operation is denied. Your journal has been cleared from this view.",
    not_ready:
      "The integration is not loaded. Reload the connection after it starts.",
    not_found:
      "This record or dataset is no longer available. Refresh the journal.",
    conflict:
      "This entry changed elsewhere. Reload the entry and review your changes before saving again.",
    refresh_required:
      "The journal changed. Return to the first page to refresh the results.",
    invalid_request:
      "Some values were rejected. Check the fields and try again.",
    busy: "The journal is busy. Wait a moment, then retry.",
    backup_in_progress: "A backup is running. Retry after it finishes.",
    storage_error:
      "The journal could not access storage. Check HA diagnostics and available space.",
    export_too_large: "This export exceeds the download size limit.",
    export_timeout:
      "The export timed out. Try again when the server is less busy.",
  };
  return (
    messages[errorCode(error)] ??
    "The connection was interrupted. The result could not be confirmed."
  );
}

export async function withRequestDeadline<T>(request: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      request,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new ApiError("connection_lost")),
          REQUEST_TIMEOUT,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export class JournalClient {
  constructor(private readonly transport: Transport) {}

  call<T>(message: ApiMessage): Promise<T> {
    return withRequestDeadline(this.transport.callWS<T>(message));
  }
  info(): Promise<{ entries: JournalInfo[] }> {
    return this.call({ type: `${DOMAIN}/info` });
  }
  list(
    scope: Scope,
    query = "",
    status = "",
    cursor?: string,
  ): Promise<JournalPage> {
    return this.call({
      type: `${DOMAIN}/journal/list`,
      ...scopeFields(scope),
      query,
      limit: 25,
      ...(status ? { status } : {}),
      ...(cursor ? { cursor } : {}),
    });
  }
  get(scope: Scope, viewing_id: string): Promise<Viewing> {
    return this.call({
      type: `${DOMAIN}/journal/get`,
      ...scopeFields(scope),
      viewing_id,
    });
  }
  sessions(scope: Scope, viewing_id: string): Promise<SessionPage> {
    return this.call({
      type: `${DOMAIN}/journal/sessions`,
      ...scopeFields(scope),
      viewing_id,
    });
  }
  prepare(
    scope: Scope,
    operation: "create" | "update" | "delete",
    values: Record<string, unknown>,
  ): PreparedMutation {
    // Keep the UUID and exact payload across uncertain transport failures.
    const message = structuredClone({
      ...values,
      ...scopeFields(scope),
      type: `${DOMAIN}/journal/${operation}`,
      request_id: crypto.randomUUID(),
    });
    return { scope: scopeFields(scope), message: Object.freeze(message) };
  }
  mutate(pending: PreparedMutation): Promise<MutationResult> {
    return this.call({ ...pending.message });
  }
  async download(
    scope: Scope,
    format: "json" | "sqlite",
    signal: AbortSignal,
  ): Promise<Blob> {
    const path = `/api/${DOMAIN}/${encodeURIComponent(scope.entry_id)}/${encodeURIComponent(scope.dataset_id)}/export?format=${format}`;
    const response = await this.transport.fetchWithAuth(path, {
      signal,
      cache: "no-store",
      redirect: "error",
    });
    if (!response.ok) {
      const codes: Record<number, string> = {
        401: "unauthorized",
        403: "unauthorized",
        404: "not_found",
        413: "export_too_large",
        503: "busy",
      };
      throw new ApiError(codes[response.status] ?? "storage_error");
    }
    // The backend is bounded too; cap browser accumulation before creating a Blob.
    const reader = response.body?.getReader();
    if (!reader) throw new ApiError("storage_error");
    const chunks: Uint8Array<ArrayBuffer>[] = [];
    let length = 0;
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        length += value.byteLength;
        if (length > MAX_DOWNLOAD_BYTES) throw new ApiError("export_too_large");
        chunks.push(new Uint8Array(value));
      }
      return new Blob(chunks, {
        type:
          format === "json" ? "application/json" : "application/vnd.sqlite3",
      });
    } finally {
      await reader.cancel().catch(() => {});
      reader.releaseLock();
    }
  }
}
