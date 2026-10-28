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
export interface NowPlayingPlayer {
  player_id: string;
  entity_id: string | null;
  name: string | null;
  title: string | null;
  raw_content_id: string | null;
  duration_seconds: number | null;
  play_status: string;
  location: string;
  available: boolean;
  observed_at: string;
  artwork_key: string | null;
  session: {
    watched_seconds: number;
    credits_confirmed: boolean;
    gap_count: number;
  } | null;
  recording_paused: boolean;
  minimum_runtime_minutes: number;
  recording_exclusion: "runtime_unknown" | "below_minimum_runtime" | null;
  recording_error: string | null;
  overflow_count: number;
  buffered_observations: number;
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
export interface OptionsForm {
  type: "form" | "create_entry" | "abort";
  flow_id?: string;
  errors?: Record<string, string>;
  fields?: { name: string; default?: string | number | boolean }[];
}
export interface DatabasePage {
  table: string;
  tables: Record<string, number>;
  revision: number;
  offset: number;
  items: Record<string, unknown>[];
  has_more: boolean;
}
export interface PurgeResult {
  purged_count: number;
  revision: number;
}
export interface ImportResult {
  imported_count: number;
  skipped_count: number;
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
export const MAX_ARTWORK_BYTES = 5 * 1024 * 1024;
export const MAX_IMPORT_BYTES = 32 * 1024 * 1024;

function requestId(): string {
  const random = globalThis.crypto;
  if (typeof random?.randomUUID === "function") return random.randomUUID();
  if (typeof random?.getRandomValues !== "function")
    throw new ApiError("request_id_unavailable");
  // getRandomValues also works on HTTP LAN origins. Keep UUID v4 version/variant bits.
  const bytes = random.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

async function boundedBlob(
  response: Response,
  limit: number,
  type: string,
): Promise<Blob> {
  const reader = response.body?.getReader();
  if (!reader) throw new ApiError("storage_error");
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let length = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > limit) throw new ApiError("export_too_large");
      chunks.push(new Uint8Array(value));
    }
    return new Blob(chunks, { type });
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

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
    request_id_unavailable:
      "This browser cannot create a secure request ID. Try a supported browser. No change was sent.",
    tracking_enabled:
      "Disable automatic tracking in Settings before importing or purging entries.",
    import_too_large: "Choose an import file no larger than 32 MiB.",
    import_timeout:
      "The import result is unconfirmed. Retry the same file and request to confirm it.",
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
  nowPlaying(scope: Scope): Promise<{ players: NowPlayingPlayer[] }> {
    return this.call({ type: `${DOMAIN}/now_playing`, ...scopeFields(scope) });
  }
  settings(
    scope: Scope,
    operation: "start" | "submit" | "cancel",
    values: Record<string, unknown> = {},
  ): Promise<OptionsForm> {
    return this.call({
      ...values,
      ...scopeFields(scope),
      type: `${DOMAIN}/settings/${operation}`,
    });
  }
  inspect(
    scope: Scope,
    table: string,
    offset = 0,
    revision?: number,
  ): Promise<DatabasePage> {
    return this.call({
      type: `${DOMAIN}/database/inspect`,
      ...scopeFields(scope),
      table,
      offset,
      ...(revision == null ? {} : { revision }),
    });
  }
  preparePurge(
    scope: Scope,
    values: Record<string, unknown>,
  ): PreparedMutation {
    return this.prepareCommand(scope, "database/purge", values);
  }
  prepareDatabaseUpdate(
    scope: Scope,
    values: Record<string, unknown>,
  ): PreparedMutation {
    return this.prepareCommand(scope, "database/update", values);
  }
  prepareImport(scope: Scope, file: File, revision: number): PreparedMutation {
    const format = /\.(sqlite|sqlite3|db)$/i.test(file.name)
      ? "sqlite"
      : /\.json$/i.test(file.name)
        ? "json"
        : null;
    if (!format) throw new ApiError("invalid_request");
    if (!file.size || file.size > MAX_IMPORT_BYTES)
      throw new ApiError("import_too_large");
    return this.prepareCommand(scope, "database/import", { format, revision });
  }
  async importFile(
    pending: PreparedMutation,
    file: File,
    signal: AbortSignal,
  ): Promise<ImportResult> {
    const { scope, message } = pending;
    const query = new URLSearchParams({
      format: String(message.format),
      request_id: String(message.request_id),
      revision: String(message.revision),
    });
    const response = await this.transport.fetchWithAuth(
      `/api/${DOMAIN}/${encodeURIComponent(scope.entry_id)}/${encodeURIComponent(scope.dataset_id)}/import?${query}`,
      {
        method: "POST",
        body: file,
        signal,
        redirect: "error",
        headers: { "Content-Type": "application/octet-stream" },
      },
    );
    if (!response.ok) {
      const codes: Record<number, string> = {
        401: "unauthorized",
        403: "unauthorized",
        413: "import_too_large",
        404: "not_found",
      };
      if (codes[response.status]) throw new ApiError(codes[response.status]);
      const error = (await response.json().catch(() => null)) as {
        code?: string;
      } | null;
      throw new ApiError(error?.code ?? "connection_lost");
    }
    return response.json() as Promise<ImportResult>;
  }
  purge(pending: PreparedMutation): Promise<PurgeResult> {
    return this.call({ ...pending.message });
  }
  async artwork(entityId: string, signal: AbortSignal): Promise<Blob | null> {
    if (!/^media_player\.[a-z0-9_]{1,255}$/.test(entityId))
      throw new ApiError("invalid_request");
    // Use HA's existing authenticated image route, without copying query tokens.
    const response = await this.transport.fetchWithAuth(
      `/api/media_player_proxy/${entityId}`,
      {
        signal,
        cache: "no-store",
        redirect: "error",
      },
    );
    if (!response.ok) {
      await response.body?.cancel();
      if (response.status === 404) return null;
      throw new ApiError(
        [401, 403].includes(response.status) ? "unauthorized" : "not_ready",
      );
    }
    const type = response.headers
      .get("Content-Type")
      ?.split(";")[0]
      .trim()
      .toLowerCase();
    if (!type || !["image/jpeg", "image/png", "image/webp"].includes(type)) {
      await response.body?.cancel();
      return null;
    }
    return boundedBlob(response, MAX_ARTWORK_BYTES, type);
  }
  prepare(
    scope: Scope,
    operation: "create" | "update" | "delete",
    values: Record<string, unknown>,
  ): PreparedMutation {
    return this.prepareCommand(scope, `journal/${operation}`, values);
  }
  private prepareCommand(
    scope: Scope,
    operation: string,
    values: Record<string, unknown>,
  ): PreparedMutation {
    // Keep the UUID and exact payload across uncertain transport failures.
    const message = structuredClone({
      ...values,
      ...scopeFields(scope),
      type: `${DOMAIN}/${operation}`,
      request_id: requestId(),
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
    return boundedBlob(
      response,
      MAX_DOWNLOAD_BYTES,
      format === "json" ? "application/json" : "application/vnd.sqlite3",
    );
  }
}
