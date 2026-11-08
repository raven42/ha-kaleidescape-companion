import { displayProfile } from "./display-profile";
export interface TestDashboardPlan {
  title: string;
  url_path: string;
  config: Record<string, unknown>;
  yaml: string;
  views: string[];
}
export interface HADashboard {
  id: string;
  url_path: string;
  title: string;
  mode: string;
  icon?: string;
  require_admin?: boolean;
  show_in_sidebar?: boolean;
}
export interface SettingsTransfer {
  format: string;
  version: number;
  categories: Record<string, Record<string, unknown>>;
  patch?: Record<string, string | number | boolean | string[]>;
}
export interface LogPage {
  items: Record<string, unknown>[];
  before: number | null;
  through: number;
  retained: number;
  bytes: number;
  limit_bytes: number;
  banner: string;
  config: { level: string; log_values: boolean; hidden_through: number };
  dropped: number;
  storage_failures: number;
  sink_failures: number;
}
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
  watched_seconds?: number;
  month_viewing_count?: number;
  month_watched_seconds?: number;
  database_bytes?: number;
  database_limit_bytes?: number;
  backup_in_progress?: boolean;
  tracking_enabled?: boolean;
  pyk_version?: string;
  integration_version?: string;
  library_enabled?: boolean;
  ui_defaults?: {
    default_landing_page: string;
  };
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
> & { completed_at?: string | null };
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
  player_id?: string;
  content_key?: string | null;
  power_state?: string;
  entity_id: string | null;
  name: string | null;
  title: string | null;
  raw_content_id?: string | null;
  duration_seconds: number | null;
  play_status: string;
  location: string;
  available: boolean;
  observed_at: string;
  artwork_key: string | null;
  session?: {
    watched_seconds: number;
    credits_confirmed: boolean;
    gap_count: number;
  } | null;
  recording_paused?: boolean;
  minimum_runtime_minutes?: number;
  recording_exclusion?: "runtime_unknown" | "below_minimum_runtime" | null;
  recording_error?: string | null;
  overflow_count?: number;
  buffered_observations?: number;
}
export interface JournalPage {
  items: ViewingSummary[];
  revision: number;
  next_cursor: string | null;
}
export interface CalendarViewing extends ViewingSummary {
  library_title_id: string | null;
  artwork_key: string | null;
  completed_at?: string | null;
}
export interface CalendarMovie {
  title: string;
  artwork_key: string | null;
  actors: string[] | null;
  directors: string[] | null;
  genres: string[] | null;
  rating: string | null;
  year: number | null;
  duration_seconds: number | null;
  edition: string | null;
  formats: string[] | null;
}
export interface ViewingLibraryLink {
  title_id: string;
  title: string;
  artwork_key: string | null;
}
export interface MutationResult {
  viewing: Viewing;
  revision: number;
}
export interface OptionsForm {
  credential_configured?: boolean;
  entity_choices?: Record<string, { value: string; label: string }[]>;
  calendar_choices?: { value: string; label: string }[];
  type: "form" | "create_entry" | "abort";
  flow_id?: string;
  errors?: Record<string, string>;
  fields?: { name: string; default?: string | number | boolean }[];
}
export interface ControlInfo {
  enabled: boolean;
  allow_launch: boolean;
  default_player: string;
  players: { id: string; name: string; model: string }[];
  can_manage: boolean;
  blocked_players: string[];
  devices?: {
    serial: string;
    name: string;
    model: string;
    ipaddress: string;
    is_player: boolean;
  }[];
  pending: {
    request_id: string;
    player_id: string;
    operation: string;
    created_at: string;
  }[];
}
export interface ControlStatus {
  player_id: string;
  power_state: "on" | "standby";
  readiness: "ready" | "starting" | "idle";
  ready: boolean;
  state: ControlReview["before"];
}
export interface ControlReview {
  token: string;
  operation: string;
  player_id: string;
  title: string | null;
  year: string | null;
  before: {
    title: string;
    mode: number;
    duration_seconds: number;
    position_seconds: number;
  };
  exact_version_confirmed: false;
}
export interface ControlResult {
  request_id: string;
  outcome:
    "unconfirmed" | "acknowledged" | "state_observed" | "rejected" | "not_sent";
  acknowledged: boolean;
  exact_version_confirmed: false;
}
export interface CalendarMaintenanceStatus {
  failure_stage?: string;
  enabled: boolean;
  ready: boolean;
  active: boolean;
  uncertain: number;
  quarantined: number;
  review_token?: string;
  last_success: string | null;
  error: string;
  counts: Record<string, number>;
}
export interface CalendarStatus {
  maintenance?: CalendarMaintenanceStatus;
  enabled: boolean;
  ready: boolean;
  fingerprint: string;
  active: boolean;
  completed_viewings: number;
  job: null | {
    job_id: string;
    total: number;
    finished: boolean;
    counts: Record<string, number>;
  };
}
export interface DatabasePage {
  references?: { table: string; key: Record<string, string> }[];
  dataset_revision?: number;
  schema?: {
    name: string;
    type: string;
    editable: boolean;
    nullable: boolean;
    primary: boolean;
  }[];
  query_fields?: { name: string; type: string }[];
  operators?: string[];
  row_tokens?: string[];
  main_tables?: string[];
  deletable?: boolean;
  table: string;
  tables: Record<string, number>;
  revision: number;
  offset: number;
  items: Record<string, unknown>[];
  has_more: boolean;
  limit: number;
  total: number;
  columns: string[];
  sort: string;
  descending: boolean;
  query: string;
}
export interface DatabaseQuery {
  limit: number;
  query: string;
  sort?: string;
  descending: boolean;
}
export interface PurgeResult {
  purged_count: number;
  revision: number;
}
export interface ImportResult {
  updated_count: number;
  imported_count: number;
  skipped_count: number;
  revision: number;
}
export interface UISettings {
  revision: number;
  values: Record<string, unknown>;
}
export interface LibraryPurchase {
  id: string;
  title: string;
  purchased_on: string | null;
  purchase_price: string | null;
  retail_price: string | null;
  order_id: string | null;
  href: string | null;
}
export interface GroupPurchaseRecord extends LibraryPurchase {
  imported_at: string;
  library_id: string | null;
  issue: string | null;
  token: string;
}
export interface GroupManualPurchase {
  library_id: string;
  purchased_on: string | null;
  purchase_price: string | null;
  retail_price: string | null;
  order_id?: string | null;
  href?: string | null;
  editable: boolean;
  date_only: boolean;
}
export interface GroupPurchaseEdit {
  snapshot: string;
  unavailable: boolean;
  records: LibraryPurchase[];
  manual: Array<
    Pick<
      GroupManualPurchase,
      | "library_id"
      | "purchased_on"
      | "purchase_price"
      | "retail_price"
      | "order_id"
      | "href"
    >
  >;
}
export interface GroupPurchaseDetails {
  records: GroupPurchaseRecord[];
  manual: GroupManualPurchase[];
  truncated: boolean;
  unavailable: boolean;
}
export interface ProviderMetadata {
  provider: string;
  provider_id: string;
  url: string;
  fetched_at: string;
  actors?: string[];
  directors?: string[];
  writers?: string[];
  producers?: string[];
  studios?: string[];
  distributor?: string;
  critic_score?: number | null;
  audience_score?: number | null;
  audience_rating?: number | null;
  audience_votes?: number | null;
  backdrop_key?: string;
  poster_key?: string;
  providers?: string[];
}
export interface ScrapeOptions {
  title?: string;
  search_title?: string;
  snapshot?: string;
  current?: {
    title: string;
    year: number | null;
    directors: string[];
    actors: string[];
    edition?: string | null;
    duration_seconds?: number | null;
    metadata_synced_at?: string | null;
    artwork_key?: string | null;
    original_artwork_key?: string | null;
    backdrop_key?: string | null;
    previous_backdrop_key?: string | null;
    backdrop_reset_available?: boolean;
  };
  providers: {
    id: string;
    label: string;
    available: boolean;
    missing_data?: boolean;
    unavailable?: boolean;
    has_data?: boolean;
    match_url?: string | null;
    supports_images?: boolean;
    fetched_at?: string | null;
    checked_at?: string | null;
    fields?: number;
  }[];
  field_mapping?: {
    field: string;
    label: string;
    values: Record<string, unknown>;
    selected: string;
    override: boolean;
  }[];
  artwork_enabled: boolean;
  auto_save?: boolean;
  history?: {
    provider: string;
    checked_at: string;
    outcome: "downloaded" | "no_data";
    values: Record<string, unknown>;
  }[];
  artwork_unavailable?: ("poster" | "backdrop")[];
  artwork_present?: { poster: boolean; backdrop: boolean };
}
export interface ScrapeReview {
  has_backdrop?: boolean;
  matched?: { title: string; year: number };
  plan_id: string;
  title: string;
  fields: Record<string, { before: unknown; after: unknown }>;
  images: {
    id: string;
    kind: "poster" | "backdrop";
    width: number | null;
    height: number | null;
  }[];
  artwork_enabled: boolean;
}
export interface ScrapeMatches {
  search_id: string;
  title: string;
  query: string;
  candidates: {
    id: string;
    title: string;
    year: number;
    actors: string[];
    directors: string[];
    genres: string[];
    has_artwork: boolean;
  }[];
}
export interface ScrapeStaged {
  outcome: "staged";
  plan_id: string;
  provider: string;
  has_data: boolean;
  matched: { title: string; year: number } | null;
  values: Record<string, unknown>;
  images: ScrapeReview["images"];
}
export type ScrapeRefresh =
  | { outcome: "downloaded" | "no_data" }
  | ScrapeStaged
  | (ScrapeMatches & { outcome: "matches" });
export interface MetadataStatus {
  tmdb_enabled?: boolean;
  enabled?: boolean;
  active?: number;
  queued?: number;
  failed?: number;
  cached_groups?: number;
  by_provider?: Record<string, number>;
  running: boolean;
  processed: number;
  updated: number;
  skipped: number;
  total: number;
  error: string | null;
  last_finished: string | null;
}
export interface LibraryEdit {
  snapshot: string;
  values: Record<string, string | string[] | number | boolean | null>;
  version_count: number;
  has_invoices: boolean;
}
export interface LibraryTitle {
  scraper_conflict?: boolean;
  missing_metadata_artwork?: boolean;
  ratings?: Pick<
    ProviderMetadata,
    "critic_score" | "audience_score" | "audience_rating" | "audience_votes"
  >;
  sort_title?: string | null;
  backdrop_key?: string | null;
  enrichment?: Record<string, ProviderMetadata>;
  producers?: string[];
  purchase_history?: LibraryPurchase[];
  purchased_on?: string | null;
  is_favorite?: boolean;
  is_watch_soon?: boolean;
  is_recently_added?: boolean;
  id: string;
  title: string;
  formats?: string[];
  formats_truncated?: boolean;
  content_ratings?: string[];
  years?: number[];
  version_count?: number;
  maximum_duration_seconds?: number | null;
  first_seen: string;
  last_seen: string;
  metadata_synced_at: string | null;
  artwork_key: string | null;
  watched_status: "watched" | "unwatched" | "in_progress" | "unknown" | "none";
  movie_statuses?: ("watched" | "unwatched" | "in_progress")[];
  collections: string[];
  actors: string[];
  directors: string[];
  writers: string[];
  studios: string[];
  genres: string[];
  rating: string;
  year: number | null;
  edition: string;
  duration_seconds: number | null;
  synopsis: string;
}
export type LibrarySummary = Pick<
  LibraryTitle,
  | "id"
  | "is_favorite"
  | "is_watch_soon"
  | "is_recently_added"
  | "scraper_conflict"
  | "missing_metadata_artwork"
  | "rating"
  | "purchased_on"
  | "title"
  | "formats"
  | "formats_truncated"
  | "content_ratings"
  | "years"
  | "version_count"
  | "maximum_duration_seconds"
  | "first_seen"
  | "last_seen"
  | "metadata_synced_at"
  | "artwork_key"
  | "watched_status"
  | "movie_statuses"
  | "collections"
  | "year"
  | "edition"
  | "duration_seconds"
>;
export interface LibraryPage {
  random_seed?: string;
  limit?: number;
  preferences_key?: string;
  items: LibrarySummary[];
  total: number;
  offset: number;
  has_more: boolean;
  revision: number;
  facets: Record<string, string[]>;
  truncated_facets: string[];
}
export interface LibraryVersionPage {
  group_purchase_details?: GroupPurchaseDetails;
  preferences_key?: string;
  items: LibraryTitle[];
  total: number;
  offset: number;
  has_more: boolean;
  revision: number;
}
export interface LibraryInfo {
  status_counts?: Record<string, number>;
  metadata?: MetadataStatus;
  collection_add_enabled?: boolean;
  collection_choices?: string[];
  collection_jobs?: CollectionJob[];
  pending_adds?: {
    request_id: string;
    title_id: string;
    title: string;
    collection: string;
  }[];
  collection_names?: string[];
  preferences_key?: string;
  name_count?: number;
  title_count: number;
  group_count: number;
  collection_count: number;
  revision: number;
  last_synced_at: string | null;
  collections_synced_at: string | null;
  phase?: string;
  error?: string | null;
  processed?: number;
  total?: number;
  last_attempt?: string | null;
  collections_enabled?: boolean;
  details_enabled?: boolean;
  artwork_enabled?: boolean;
  artwork_bytes?: number;
  artwork_limit_bytes?: number;
}
export interface CollectionJob {
  request_id: string;
  title_id: string;
  group_id: string;
  title: string;
  collection: string;
  operation: "add" | "remove";
  status:
    | "queued"
    | "working"
    | "syncing"
    | "confirmed"
    | "failed"
    | "uncertain"
    | "interrupted";
  error: string | null;
}
export interface LibraryPurchaseTotals {
  revision: number;
  purchase_count: number;
  unique_transactions: number;
  missing_purchase_prices: number;
  missing_retail_prices: number;
  missing_order_ids: number;
  unpaired_prices: number;
  duplicate_purchases: number;
  currencies: {
    currency: string;
    library_cost: string | null;
    retail_price: string | null;
    savings: string | null;
  }[];
}
export interface ImportReviewRow {
  artwork_key?: string | null;
  needs_match?: boolean;
  can_match?: boolean;
  possible_duplicate?: boolean;
  repair_barrier?: boolean;
  duplicate_candidates?: {
    id: string;
    title: string;
    purchased_on: string | null;
    purchase_price: string | null;
    retail_price: string | null;
    order_id: string | null;
    href: string | null;
    imported_at: string;
    library_id: string | null;
    library_title: string | null;
    reserved_by_repair?: boolean;
  }[];
  duplicate_candidates_more?: boolean;
  detail?: string;
  key: string;
  table: "viewings" | "library";
  selected_by_default?: boolean;
  title: string;
  action: "new" | "merge" | "unchanged" | "skip";
  changes: Record<string, { before: unknown; after: unknown }>;
  conflicts: string[];
  reason: string;
}
export interface PurchaseRepairReview {
  plan_id: string;
  revision: number;
  action: "correct" | "void" | "reverse";
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  before_library: Record<string, unknown> | null;
  after_library: Record<string, unknown> | null;
  totals_change: { source_id: string; before: unknown; after: unknown }[];
  expires_in: number;
}
export interface ImportReview {
  plan_id: string;
  revision: number;
  expires_in: number;
  rows: ImportReviewRow[];
  counts: Record<ImportReviewRow["action"], number>;
}
export interface ImportMatchTitle {
  artwork_key?: string | null;
  id: string;
  title: string;
  year: number | null;
  directors: string[];
  version_count: number;
  source_hint: string;
}
export type ImportMatchResult = Omit<ImportReview, "rows"> & {
  row: ImportReviewRow;
};
export interface CollectionAddResult {
  status: "confirmed" | "uncertain" | "abandoned";
  request_id: string;
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

export function randomId(): string {
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
    library_disabled: "Enable library sync in Settings to use the Library.",
    library_storage_limit:
      "Library refresh reached its database storage ceiling. Cached data is retained and journal storage headroom is reserved.",
    library_unreachable:
      "The library host could not be reached. Check the hostname and HA network access. Cached data is retained.",
    library_timeout:
      "The library server took too long to respond. Check its status and the Home Assistant logs.",
    library_destination:
      "The library must use a private LAN hostname or address.",
    library_format:
      "The library page format was not recognized. Cached data is retained.",
    library_response:
      "The library returned an unsupported response. Cached data is retained.",
    library_changed:
      "The library changed during sync. Previous collection data was retained; try again later.",
    query_limit:
      "This search exceeded its execution budget. Refine the text or simplify the conditions and try again.",
    repair_limit:
      "Metadata repair exceeded its 10,000-entry or execution limit. No changes were saved.",
    query_syntax:
      "Check the field names, operators and quoted values in the condition.",
    database_page_too_large:
      "The database page is too large. Choose fewer rows per page.",
    library_page_too_large:
      "This library page is too large. Reduce entries per page and try again.",
    collection_disabled:
      "Enable collection changes and collection sync in Settings first.",
    collection_form:
      "The server’s collection form was not recognized. Refresh or sync before trying again.",
    collection_uncertain:
      "Check or acknowledge the previous unconfirmed collection change first.",
    collection_limit: "Collection request history reached its storage limit.",
    library_too_large:
      "A library response exceeded its safety limit. Cached data is retained.",
    library_artwork:
      "Some artwork could not be cached. Previous artwork is retained when available.",
    provider_destination:
      "The provider request destination or path failed the network allowlist checks. No request was sent to that destination.",
    provider_content_type:
      "The provider returned an unsupported content type or the image bytes did not match that type.",
    provider_encoding:
      "The provider returned compressed content despite requesting an uncompressed response.",
    provider_response_too_large:
      "The provider response exceeded the download size limit.",
    provider_http_error:
      "The provider returned an unsuccessful HTTP response. Check the preceding HTTP status event.",
    provider_access_denied:
      "The provider denied access. Check the scraper credentials and permissions.",
    provider_rate_limited:
      "The provider rate limit was reached. Wait before trying again.",
    provider_artwork_unavailable:
      "The selected image is no longer available from this provider.",
    provider_disabled: "The required provider or artwork feature is disabled.",
    metadata_disabled: "Enable and configure a scraper in Settings first.",
    metadata_unavailable: "Metadata retrieval failed. Try again.",
    provider_identity_mismatch:
      "The provider could not verify this movie's title and release year.",
    tmdb_not_found: "TMDB did not find a matching title and release year.",
    tmdb_ambiguous:
      "TMDB returned more than one matching movie. No data was imported.",
    store_search_truncated:
      "The Kaleidescape Store returned too many results to verify a unique match. Refine the search and choose a match for review.",
    store_missing_library_credits:
      "The Library needs four scanned actors and a director before this Store match can be verified.",
    store_credit_mismatch:
      "The Store results did not match the scanned cast and director. Choose a match for review.",
  };
  return (
    messages[errorCode(error)] ??
    "The connection was interrupted. The result could not be confirmed."
  );
}

export async function withRequestDeadline<T>(
  request: Promise<T>,
  timeout = REQUEST_TIMEOUT,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      request,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new ApiError("connection_lost")),
          timeout,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export interface MetadataRepairResult {
  updated_count: number;
  unchanged_count: number;
  unmatched_count: number;
  active_count: number;
  revision: number;
}
export type MetadataReview = Omit<MetadataRepairResult, "revision"> & {
  token: string;
};

export class JournalClient {
  constructor(private readonly transport: Transport) {}

  call<T>(message: ApiMessage): Promise<T> {
    return withRequestDeadline(this.transport.callWS<T>(message));
  }
  automationStatuses(scope: Scope): Promise<
    Record<
      string,
      {
        status: "current" | "outdated" | "modified" | "missing" | "unavailable";
        label: string;
        revision: string | null;
        installed_version?: number | null;
        latest_version?: number;
      }
    >
  > {
    return this.call({
      type: `${DOMAIN}/automations/status`,
      ...scopeFields(scope),
    });
  }
  updateAutomationBlueprint(
    scope: Scope,
    template: string,
    revision: string,
  ): Promise<unknown> {
    return this.call({
      type: `${DOMAIN}/automations/update`,
      ...scopeFields(scope),
      template,
      revision,
    });
  }
  automationTemplate(
    scope: Scope,
    template: string,
  ): Promise<{ path: string; yaml: string }> {
    return this.call({
      type: `${DOMAIN}/automations/template`,
      ...scopeFields(scope),
      template,
    });
  }
  installAutomationBlueprint(
    path: string,
    yaml: string,
    allowOverride = false,
  ): Promise<{ overrides_existing: boolean }> {
    return this.call({
      type: "blueprint/save",
      domain: "automation",
      path,
      yaml,
      ...(allowOverride ? { allow_override: true } : {}),
    });
  }
  controlInfo(scope: Scope): Promise<ControlInfo> {
    return this.call({ type: `${DOMAIN}/control/info`, ...scopeFields(scope) });
  }
  controlDiscover(scope: Scope): Promise<ControlInfo> {
    return withRequestDeadline(
      this.transport.callWS<ControlInfo>({
        type: `${DOMAIN}/control/discover`,
        ...scopeFields(scope),
      }),
      70000,
    );
  }
  controlStatus(scope: Scope, player_id?: string): Promise<ControlStatus> {
    return this.call({
      type: `${DOMAIN}/control/status`,
      ...scopeFields(scope),
      ...(player_id ? { player_id } : {}),
    });
  }
  controlPrepare(
    scope: Scope,
    operation: string,
    title_id?: string,
    player_id?: string,
  ): Promise<ControlReview> {
    return this.call({
      type: `${DOMAIN}/control/prepare`,
      ...scopeFields(scope),
      operation,
      ...(title_id ? { title_id } : {}),
      ...(player_id ? { player_id } : {}),
    });
  }
  prepareControl(scope: Scope, token: string): PreparedMutation {
    return this.prepareCommand(scope, "control/execute", {
      token,
    });
  }
  controlExecute(pending: PreparedMutation): Promise<ControlResult> {
    return this.call({ ...pending.message });
  }
  controlAcknowledge(
    scope: Scope,
    request_id: string,
  ): Promise<{ pending_count: number }> {
    return this.call({
      type: `${DOMAIN}/control/acknowledge`,
      ...scopeFields(scope),
      request_id,
      confirmation: "REVIEWED",
    });
  }
  metadataStatus(scope: Scope, sync = false): Promise<MetadataStatus> {
    return this.call({
      type: `${DOMAIN}/metadata/${sync ? "sync" : "status"}`,
      ...scopeFields(scope),
    });
  }
  titleScrapeOptions(scope: Scope, title_id: string): Promise<ScrapeOptions> {
    return this.call({
      type: `${DOMAIN}/metadata/title/options`,
      ...scopeFields(scope),
      title_id,
    });
  }
  titleScrapePreview(
    scope: Scope,
    title_id: string,
    provider: string,
    search_id = "",
    choice = "",
  ): Promise<ScrapeReview | ScrapeMatches> {
    return withRequestDeadline(
      this.transport.callWS({
        type: `${DOMAIN}/metadata/title/preview`,
        ...scopeFields(scope),
        title_id,
        provider,
        search_id,
        choice,
      }),
      185000,
    );
  }
  titleScrapeSearch(
    scope: Scope,
    title_id: string,
    provider: string,
    query: string,
    year?: number,
  ): Promise<ScrapeMatches> {
    return withRequestDeadline(
      this.transport.callWS({
        type: `${DOMAIN}/metadata/title/search`,
        ...scopeFields(scope),
        title_id,
        provider,
        query,
        ...(year !== undefined ? { year } : {}),
      }),
      185000,
    );
  }
  titleScrapeRefresh(
    scope: Scope,
    title_id: string,
    provider: string,
    query: string,
    year?: number,
    stage = false,
  ): Promise<ScrapeRefresh> {
    return withRequestDeadline(
      this.transport.callWS({
        type: `${DOMAIN}/metadata/title/refresh`,
        ...scopeFields(scope),
        request_id: randomId(),
        title_id,
        provider,
        query,
        ...(year !== undefined ? { year } : {}),
        stage,
      }),
      185000,
    );
  }
  titleScrapeRefreshChoice(
    scope: Scope,
    title_id: string,
    provider: string,
    search_id: string,
    choice: string,
    stage = false,
  ): Promise<ScrapeRefresh> {
    return withRequestDeadline(
      this.transport.callWS({
        type: `${DOMAIN}/metadata/title/refresh_choice`,
        ...scopeFields(scope),
        request_id: randomId(),
        title_id,
        provider,
        search_id,
        choice,
        stage,
      }),
      185000,
    );
  }
  prepareMetadataAction(scope: Scope, data: Record<string, unknown>) {
    return this.prepareCommand(scope, "metadata/title/action", { data });
  }
  prepareMetadataDraft(scope: Scope, data: Record<string, unknown>) {
    return this.prepareCommand(scope, "metadata/title/draft", { data });
  }
  applyMetadataDraft(
    pending: PreparedMutation,
  ): Promise<{ title_id: string; updated_count: number }> {
    return withRequestDeadline(
      this.transport.callWS({ ...pending.message }),
      185000,
    );
  }
  prepareTitleScrape(
    scope: Scope,
    data: {
      plan_id: string;
      fields: string[];
      images: Record<string, string>;
      save_match?: boolean;
    },
  ) {
    return this.prepareCommand(scope, "metadata/title/apply", { data });
  }
  prepareScraperAvailability(
    scope: Scope,
    data: {
      title_id: string;
      provider: string;
      snapshot: string;
      unavailable: boolean;
    },
  ) {
    return this.prepareCommand(scope, "metadata/title/availability", { data });
  }
  prepareArtworkAvailability(
    scope: Scope,
    data: {
      title_id: string;
      kind: "poster" | "backdrop";
      snapshot: string;
      unavailable: boolean;
    },
  ) {
    return this.prepareCommand(scope, "metadata/title/availability", { data });
  }
  prepareScrapeExpectations(
    scope: Scope,
    data: {
      title_id: string;
      snapshot: string;
      providers: Record<string, boolean>;
      artwork: { poster: boolean; backdrop: boolean };
    },
  ) {
    return this.prepareCommand(scope, "metadata/title/availability", { data });
  }
  cancelTitleScrape(
    scope: Scope,
    planId: string,
  ): Promise<{ cancelled: boolean }> {
    return this.call({
      type: `${DOMAIN}/metadata/title/cancel`,
      ...scopeFields(scope),
      plan_id: planId,
    });
  }
  applyTitleScrape(
    pending: PreparedMutation,
  ): Promise<{ title_id: string; updated_count: number }> {
    return withRequestDeadline(
      this.transport.callWS({ ...pending.message }),
      80000,
    );
  }
  async titleScrapeImage(
    scope: Scope,
    plan: string,
    choice: string,
    signal: AbortSignal,
  ): Promise<Blob> {
    if (
      !/^[a-f0-9-]{36}$/.test(plan) ||
      !/^(poster|backdrop|match)-[0-9]{1,3}$/.test(choice)
    )
      throw new ApiError("invalid_request");
    return this.raster(
      `/api/${DOMAIN}/${encodeURIComponent(scope.entry_id)}/${encodeURIComponent(scope.dataset_id)}/metadata/review/${plan}/image/${choice}`,
      signal,
    );
  }
  metadataPreview(scope: Scope): Promise<MetadataReview> {
    return this.call({
      type: `${DOMAIN}/journal/metadata/preview`,
      ...scopeFields(scope),
    });
  }
  prepareMetadataRepair(scope: Scope, token: string) {
    return this.prepareCommand(scope, "journal/metadata/repair", {
      token,
      confirmation: "REPAIR METADATA",
    });
  }
  repairMetadata(pending: PreparedMutation): Promise<MetadataRepairResult> {
    return this.call({ ...pending.message });
  }
  prepareLibraryReset(scope: Scope, titleId: string, snapshot: string) {
    return this.prepareCommand(scope, "library/edit/reset", {
      title_id: titleId,
      snapshot,
      confirmation: "RESTORE SOURCE",
    });
  }
  libraryEdit(scope: Scope, titleId: string): Promise<LibraryEdit> {
    return this.call({
      type: `${DOMAIN}/library/edit/get`,
      ...scopeFields(scope),
      title_id: titleId,
    });
  }
  groupPurchaseEdit(scope: Scope, titleId: string): Promise<GroupPurchaseEdit> {
    return this.call({
      ...scopeFields(scope),
      type: `${DOMAIN}/library/purchases/edit/get`,
      title_id: titleId,
    });
  }
  prepareGroupPurchaseEdit(
    scope: Scope,
    titleId: string,
    snapshot: string,
    data: Record<string, unknown>,
  ): PreparedMutation {
    return this.prepareCommand(scope, "library/purchases/edit/save", {
      title_id: titleId,
      snapshot,
      data,
    });
  }
  saveGroupPurchaseEdit(pending: PreparedMutation): Promise<unknown> {
    return this.call({ ...pending.message });
  }
  prepareLibraryEdit(
    scope: Scope,
    titleId: string,
    snapshot: string,
    patch: Record<string, unknown>,
  ) {
    return this.prepareCommand(scope, "library/edit/save", {
      title_id: titleId,
      snapshot,
      patch,
    });
  }
  saveLibraryEdit(
    pending: PreparedMutation,
  ): Promise<{ title_id: string; updated_count: number }> {
    return this.call({ ...pending.message });
  }
  uiPreferences(
    scope: Scope,
    shared = false,
    area = "library",
    profile = displayProfile(),
  ): Promise<UISettings> {
    return this.call({
      type: `${DOMAIN}/ui/${shared ? "shared" : "preferences"}/get`,
      ...(area !== "library" ? { area } : {}),
      ...(!shared ? { profile } : {}),
      ...scopeFields(scope),
    });
  }
  prepareUIPreferences(
    scope: Scope,
    shared: boolean,
    revision: number,
    patch: Record<string, unknown>,
    area = "library",
    profile = displayProfile(),
  ) {
    return this.prepareCommand(
      scope,
      `ui/${shared ? "shared" : "preferences"}/update`,
      {
        revision,
        patch,
        ...(area !== "library" ? { area } : {}),
        ...(!shared ? { profile } : {}),
      },
    );
  }
  saveUIPreferences(pending: PreparedMutation): Promise<{ revision: number }> {
    return this.call({ ...pending.message });
  }
  testDashboard(
    scope: Scope,
    request_id: string,
    name: string,
  ): Promise<TestDashboardPlan> {
    return this.call({
      type: `${DOMAIN}/dashboard/preview`,
      ...scopeFields(scope),
      request_id,
      name,
    });
  }
  verifyTestDashboard(
    scope: Scope,
    request_id: string,
  ): Promise<{ url_path: string; views: number }> {
    return this.call({
      type: `${DOMAIN}/dashboard/verify`,
      ...scopeFields(scope),
      request_id,
    });
  }
  haDashboards(): Promise<HADashboard[]> {
    return this.call({ type: "lovelace/dashboards/list" });
  }
  createHATestDashboard(plan: TestDashboardPlan): Promise<HADashboard> {
    return this.call({
      type: "lovelace/dashboards/create",
      title: plan.title,
      url_path: plan.url_path,
      mode: "storage",
      icon: "mdi:test-tube",
      show_in_sidebar: true,
      require_admin: false,
    });
  }
  haTestDashboardConfig(path: string): Promise<Record<string, unknown>> {
    return this.call({ type: "lovelace/config", url_path: path, force: true });
  }
  saveHATestDashboard(plan: TestDashboardPlan): Promise<void> {
    return this.call({
      type: "lovelace/config/save",
      url_path: plan.url_path,
      config: plan.config,
    });
  }
  info(): Promise<{ entries: JournalInfo[] }> {
    return this.call({ type: `${DOMAIN}/info` });
  }
  list(
    scope: Scope,
    query = "",
    status = "",
    cursor?: string,
    sort = "completed_at",
    descending = true,
    fuzzy = false,
    libraryTitleId?: string,
  ): Promise<JournalPage> {
    return this.call({
      type: `${DOMAIN}/${libraryTitleId ? "library/viewings" : "journal/list"}`,
      ...(libraryTitleId ? { title_id: libraryTitleId } : {}),
      ...scopeFields(scope),
      query,
      limit: 25,
      sort,
      descending,
      fuzzy,
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
  calendarMonth(
    scope: Scope,
    start: string,
    end: string,
    query = "",
    status = "",
    fuzzy = false,
    titleId?: string,
  ): Promise<{
    items: CalendarViewing[];
    revision: number;
    summary: { viewing_count: number; watched_seconds: number };
  }> {
    return this.call({
      type: `${DOMAIN}/journal/calendar`,
      ...scopeFields(scope),
      start,
      end,
      query,
      fuzzy,
      ...(status ? { status } : {}),
      ...(titleId ? { title_id: titleId } : {}),
    });
  }
  calendarDetails(
    scope: Scope,
    viewing_id: string,
  ): Promise<{
    viewing: ViewingSummary & { completed_at?: string | null };
    movie: CalendarMovie | null;
  }> {
    return this.call({
      type: `${DOMAIN}/journal/calendar/get`,
      ...scopeFields(scope),
      viewing_id,
    });
  }
  viewingLibrary(
    scope: Scope,
    viewing_id: string,
  ): Promise<{ library: ViewingLibraryLink | null }> {
    return this.call({
      type: `${DOMAIN}/library/viewing`,
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
  nowPlaying(
    scope: Scope,
    player_id?: string,
  ): Promise<{ players: NowPlayingPlayer[] }> {
    return this.call({
      type: `${DOMAIN}/now_playing`,
      ...scopeFields(scope),
      ...(player_id ? { player_id } : {}),
    });
  }
  libraryInfo(scope: Scope): Promise<LibraryInfo> {
    return this.call({ type: `${DOMAIN}/library/info`, ...scopeFields(scope) });
  }
  libraryPurchaseTotals(scope: Scope): Promise<LibraryPurchaseTotals> {
    return this.call({
      type: `${DOMAIN}/library/purchases/summary`,
      ...scopeFields(scope),
    });
  }
  libraryList(
    scope: Scope,
    filters: Record<string, unknown> = {},
  ): Promise<LibraryPage> {
    return this.call({
      type: `${DOMAIN}/library/list`,
      ...scopeFields(scope),
      filters,
    });
  }
  libraryVersions(
    scope: Scope,
    title_id: string,
    offset = 0,
    revision?: number,
  ): Promise<LibraryVersionPage> {
    return this.call({
      type: `${DOMAIN}/library/versions`,
      ...scopeFields(scope),
      title_id,
      offset,
      ...(revision === undefined ? {} : { revision }),
    });
  }
  librarySync(scope: Scope): Promise<{ accepted: boolean }> {
    return this.call({ type: `${DOMAIN}/library/sync`, ...scopeFields(scope) });
  }
  collectionTargets(
    scope: Scope,
    title_id: string,
    revision: number,
  ): Promise<{ collections: string[]; revision: number }> {
    return this.call({
      type: `${DOMAIN}/library/collections/targets`,
      ...scopeFields(scope),
      title_id,
      revision,
    });
  }
  refreshTitleCollections(
    scope: Scope,
    title_id: string,
    revision: number,
  ): Promise<{ collections: string[]; revision: number }> {
    return withRequestDeadline(
      this.transport.callWS({
        type: `${DOMAIN}/library/collections/refresh`,
        ...scopeFields(scope),
        title_id,
        revision,
      }),
      310000,
    );
  }
  dismissCollectionJob(
    scope: Scope,
    request_id: string,
  ): Promise<{ dismissed: boolean }> {
    return this.call({
      type: `${DOMAIN}/library/collections/dismiss`,
      ...scopeFields(scope),
      request_id,
    });
  }
  prepareCollectionAdd(
    scope: Scope,
    title_id: string,
    collection: string,
    revision: number,
  ) {
    return this.prepareCommand(scope, "library/collections/add", {
      title_id,
      collection,
      revision,
    });
  }
  prepareCollectionChange(
    scope: Scope,
    title_id: string,
    collection: string,
    operation: "add" | "remove",
    revision: number,
  ) {
    return this.prepareCommand(scope, "library/collections/queue", {
      title_id,
      collection,
      operation,
      revision,
    });
  }
  queueCollectionChange(
    pending: PreparedMutation,
  ): Promise<{ request_id: string; status: string }> {
    return this.call({ ...pending.message });
  }
  collectionAdd(pending: PreparedMutation): Promise<CollectionAddResult> {
    return this.call({ ...pending.message });
  }
  collectionCheck(
    scope: Scope,
    request_id: string,
  ): Promise<CollectionAddResult> {
    return this.call({
      type: `${DOMAIN}/library/collections/check`,
      ...scopeFields(scope),
      request_id,
    });
  }
  collectionAcknowledge(
    scope: Scope,
    request_id: string,
  ): Promise<CollectionAddResult> {
    return this.call({
      type: `${DOMAIN}/library/collections/acknowledge`,
      ...scopeFields(scope),
      request_id,
      confirmation: "ACKNOWLEDGE",
    });
  }
  async libraryArtwork(
    scope: Scope,
    key: string,
    signal: AbortSignal,
  ): Promise<Blob> {
    if (!/^[a-f0-9]{64}$/.test(key)) throw new ApiError("invalid_request");
    return this.raster(
      `/api/${DOMAIN}/${encodeURIComponent(scope.entry_id)}/${encodeURIComponent(scope.dataset_id)}/library/artwork/${key}`,
      signal,
    );
  }
  private async raster(path: string, signal: AbortSignal): Promise<Blob> {
    const response = await this.transport.fetchWithAuth(path, {
      signal,
      cache: "no-store",
      redirect: "error",
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new ApiError(
        [401, 403].includes(response.status) ? "unauthorized" : "not_found",
      );
    }
    const type = response.headers
      .get("Content-Type")
      ?.split(";")[0]
      .trim()
      .toLowerCase();
    if (!type || !["image/jpeg", "image/png", "image/webp"].includes(type)) {
      await response.body?.cancel();
      throw new ApiError("invalid_request");
    }
    return boundedBlob(response, MAX_ARTWORK_BYTES, type);
  }

  settingsTransfer(
    scope: Scope,
    operation: "export" | "preview" | "apply",
    categories: string[],
    data: Record<string, unknown> = {},
    request_id = "",
  ): Promise<SettingsTransfer> {
    return this.call({
      ...scopeFields(scope),
      type: `${DOMAIN}/settings/transfer`,
      operation,
      categories,
      data,
      request_id,
    });
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
    filters?: DatabaseQuery,
  ): Promise<DatabasePage> {
    return this.call({
      type: `${DOMAIN}/database/inspect`,
      ...scopeFields(scope),
      table,
      offset,
      ...(revision == null ? {} : { revision }),
      ...filters,
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
  searchImportMatches(
    scope: Scope,
    review: ImportReview,
    key: string,
    query: string,
  ): Promise<{ items: ImportMatchTitle[]; has_more: boolean }> {
    return this.call({
      type: `${DOMAIN}/database/import/search`,
      ...scopeFields(scope),
      plan_id: review.plan_id,
      revision: review.revision,
      purchase_key: key,
      query,
    });
  }
  matchImportPurchase(
    scope: Scope,
    review: ImportReview,
    key: string,
    titleId: string | null,
  ): Promise<ImportMatchResult> {
    return this.call({
      type: `${DOMAIN}/database/import/match`,
      ...scopeFields(scope),
      plan_id: review.plan_id,
      revision: review.revision,
      purchase_key: key,
      title_id: titleId,
    });
  }
  prepareImport(
    scope: Scope,
    review: ImportReview,
    selected: string[],
  ): PreparedMutation {
    return this.prepareCommand(scope, "database/import", {
      plan_id: review.plan_id,
      revision: review.revision,
      selected: [...selected].sort(),
    });
  }
  applyImport(pending: PreparedMutation): Promise<ImportResult> {
    return this.call({ ...pending.message });
  }
  async previewImport(
    scope: Scope,
    file: File,
    signal: AbortSignal,
    purchaseOnly = false,
  ): Promise<ImportReview> {
    const format = /\.(sqlite|sqlite3|db)$/i.test(file.name)
      ? "sqlite"
      : /\.json$/i.test(file.name)
        ? "json"
        : null;
    if (!format) throw new ApiError("invalid_request");
    if (!file.size || file.size > MAX_IMPORT_BYTES)
      throw new ApiError("import_too_large");
    const response = await this.transport.fetchWithAuth(
      `/api/${DOMAIN}/${encodeURIComponent(scope.entry_id)}/${encodeURIComponent(scope.dataset_id)}/import/preview?format=${format}${purchaseOnly ? "&purchase_only=true" : ""}`,
      {
        method: "POST",
        body: file,
        signal,
        redirect: "error",
        cache: "no-store",
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
    const blob = await boundedBlob(
      response,
      8 * 1024 * 1024,
      "application/json",
    );
    return JSON.parse(await blob.text()) as ImportReview;
  }
  reconcilePurchases(scope: Scope): Promise<ImportReview | { empty: true }> {
    return this.call({
      type: `${DOMAIN}/purchases/reconcile`,
      ...scopeFields(scope),
    });
  }
  previewPurchaseRepair(
    scope: Scope,
    action: PurchaseRepairReview["action"],
    key: string,
    token: string,
    changes: Record<string, unknown>,
  ): Promise<PurchaseRepairReview> {
    return this.call({
      ...scopeFields(scope),
      type: `${DOMAIN}/purchases/repair/preview`,
      action,
      key,
      token,
      changes,
    });
  }
  preparePurchaseRepair(
    scope: Scope,
    review: PurchaseRepairReview,
  ): PreparedMutation {
    return this.prepareCommand(scope, "purchases/repair/apply", {
      plan_id: review.plan_id,
      revision: review.revision,
    });
  }
  applyPurchaseRepair(
    pending: PreparedMutation,
  ): Promise<{ revision: number; event_id: string }> {
    return this.call({ ...pending.message });
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
  librarySuggestions(
    scope: Scope,
    field: string,
    query: string,
    fuzzy = false,
  ): Promise<{ items: string[]; has_more: boolean }> {
    return this.call({
      type: `${DOMAIN}/library/suggest`,
      ...scopeFields(scope),
      field,
      query,
      fuzzy,
    });
  }
  librarySearch(
    scope: Scope,
    query: string,
    fuzzy = true,
  ): Promise<{ items: LibraryTitle[]; has_more: boolean }> {
    return this.call({
      type: `${DOMAIN}/library/search`,
      ...scopeFields(scope),
      query,
      fuzzy,
    });
  }
  calendarStatus(scope: Scope): Promise<CalendarStatus> {
    return this.call({
      type: `${DOMAIN}/calendar/status`,
      ...scopeFields(scope),
    });
  }
  prepareCalendarSync(scope: Scope, fingerprint: string) {
    return this.prepareCommand(scope, "calendar/sync", {
      fingerprint,
      confirmation: "EXPORT JOURNAL",
    });
  }
  calendarSync(
    pending: PreparedMutation,
  ): Promise<{ job_id: string; total: number }> {
    return this.call({ ...pending.message });
  }
  calendarMaintain(
    scope: Scope,
    action: "run" | "acknowledge",
    fingerprint: string,
    review_token = "",
  ): Promise<CalendarMaintenanceStatus> {
    return this.call({
      type: `${DOMAIN}/calendar/maintain`,
      ...scopeFields(scope),
      action,
      fingerprint,
      review_token,
      confirmation: action === "acknowledge" ? "ACKNOWLEDGE" : "",
    });
  }
  calendarCancel(scope: Scope, job_id: string): Promise<CalendarStatus> {
    return this.call({
      type: `${DOMAIN}/calendar/cancel`,
      ...scopeFields(scope),
      job_id,
    });
  }
  validateDatabaseQuery(
    scope: Scope,
    table: string,
    query: string,
  ): Promise<{ valid: boolean }> {
    return this.call({
      type: `${DOMAIN}/database/validate_query`,
      ...scopeFields(scope),
      table,
      query,
    });
  }
  prepareDatabaseMutation(scope: Scope, data: Record<string, unknown>) {
    return this.prepareCommand(scope, "database/mutate", { data });
  }
  databaseMutation(pending: PreparedMutation): Promise<{
    updated_count: number;
    deleted_count: number;
    revision: number;
  }> {
    return this.call({ ...pending.message });
  }
  async libraryAll(
    scope: Scope,
    filters: Record<string, unknown>,
    current: () => boolean,
  ): Promise<LibraryPage> {
    let page: LibraryPage | undefined;
    const items: LibrarySummary[] = [];
    let bytes = 0;
    while (current()) {
      const next = await this.libraryList(scope, {
        ...filters,
        grouped: true,
        limit: 1000,
        offset: items.length,
        ...(page
          ? {
              revision: page.revision,
              preferences_key: page.preferences_key,
              ...(page.random_seed !== undefined
                ? { random_seed: page.random_seed }
                : {}),
            }
          : {}),
      });
      if (!current()) throw new ApiError("not_ready");
      if (
        page &&
        (next.revision !== page.revision ||
          next.preferences_key !== page.preferences_key)
      )
        throw new ApiError("refresh_required");
      bytes += new TextEncoder().encode(JSON.stringify(next.items)).byteLength;
      if (items.length + next.items.length > 10000 || bytes > 32 * 1024 * 1024)
        throw new ApiError("library_page_too_large");
      items.push(...next.items);
      page = next;
      if (!next.has_more)
        return {
          ...next,
          items,
          offset: 0,
          limit: items.length,
          has_more: false,
        };
      if (!next.items.length) throw new ApiError("refresh_required");
    }
    throw new ApiError("not_ready");
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
      request_id: randomId(),
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
