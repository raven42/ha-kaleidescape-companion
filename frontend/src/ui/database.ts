import { responsivePreferences } from "./profile-controller";
/** Schema-guided administrator inspection with confirmed, revision-bound writes. */
import { responsiveViewport } from "./viewport";
import { counted } from "../core/text";
import { LitElement, html, nothing } from "lit";
import { repeat } from "lit/directives/repeat.js";
import type { PropertyValues } from "lit";
import { ApiError, errorCode, errorMessage } from "../core/api";
import type {
  DatabasePage,
  DatabaseReferenceGroup,
  DatabaseQuery,
  JournalClient,
  JournalInfo,
  PreparedMutation,
} from "../core/api";
import { styles } from "./styles";
import { databaseStyles } from "./database.styles";
import { settingHint } from "./settings-hint";
import tableDescriptions from "./database-table-descriptions.json";
import { entryLayoutStyles } from "./entry-layout.styles";
import { PreferenceStore } from "./preference-store";
import { closeButton, dismissBackdrop } from "./dialog";
import { manualDraft, manualData } from "./manual-viewing";
import "./database-query";
import "./database-cleanup";
import "./transfers";
import "./purchase-repair";
import type { KaleidescapePurchaseRepair } from "./purchase-repair";
import "../library/cover";
import { CoverQueue } from "../library/cover";

const LABELS: Record<string, string> = {
  viewings: "Viewings",
  sessions: "Sessions",
  library: "Library",
  library_collections: "Library collections",
  library_sources: "Library sources",
  library_artwork: "Library artwork",
  settings: "UI settings",
  purchase_records: "Purchases",
  purchase_repair_events: "Purchase repair history",
  purchase_identity_barriers: "Purchase replay barriers",
  library_memberships: "Library memberships",
  requests: "Write requests",
  schema_metadata: "Metadata",
  manual_audit: "Manual audit",
  maintenance_audit: "Maintenance audit",
  import_audit: "Import audit",
  database_audit: "Database audit",
  library_collection_intents: "Collection change receipts",
  calendar_publications: "Calendar publications",
  calendar_sync_jobs: "Calendar exports",
  calendar_sync_items: "Calendar export items",
  calendar_managed_events: "Calendar managed events",
  calendar_reconcile_candidates: "Calendar reconciliation candidates",
  calendar_reconcile_intents: "Calendar reconciliation receipts",
  playback_controls: "Playback control receipts",
};
const MAIN = ["viewings", "sessions", "library", "purchase_records"];
const ALL_BATCH = 100;
const ROW_HEIGHT = 44;
const SYSTEM_GROUPS: [string, (table: string) => boolean][] = [
  ["Library", (table) => table.startsWith("library_")],
  ["Purchases", (table) => table.startsWith("purchase_")],
  ["Calendar", (table) => table.startsWith("calendar_")],
  [
    "Activity and audits",
    (table) =>
      table.endsWith("_audit") ||
      table === "requests" ||
      table === "playback_controls",
  ],
  ["System", () => true],
];
function systemGroup(table: string) {
  return SYSTEM_GROUPS.find(([, matches]) => matches(table))![0];
}
type Row = Record<string, unknown>;
interface ResizeAnchor {
  row: Row;
  index: number;
  table: string;
  filters: DatabaseQuery;
  revision: number;
}
export class KaleidescapeDatabase extends LitElement {
  constructor() {
    super();
    responsiveViewport(this, () => this.scheduleFit());
    responsivePreferences(this, () => {
      if (
        !this.ready ||
        this.preferences?.unsettled ||
        this.moreLoading ||
        this.detailLoading ||
        (this.allMode &&
          (!!this.detail ||
            this.selected.size > 0 ||
            (this.page?.items.length ?? 0) > ALL_BATCH)) ||
        this.blocked ||
        this.operation ||
        this.renderRoot.querySelector("dialog[open]")
      )
        return false;
      const anchor =
        this.detail && this.page
          ? {
              row: this.detail,
              index: this.page.offset + this.page.items.indexOf(this.detail),
              table: this.table,
              filters: { ...this.filters },
              revision: this.page.revision,
            }
          : undefined;
      this.clear();
      void this.initialize(anchor);
      return true;
    });
  }

  static properties = {
    client: { attribute: false },
    scope: { attribute: false },
  };
  static styles = [styles, entryLayoutStyles, databaseStyles];
  client?: JournalClient;
  scope?: JournalInfo;
  private boundClient?: JournalClient;
  private bound = "";
  private generation = 0;
  private mutationEpoch = 0;
  private request = 0;
  private page?: DatabasePage;
  private table = "viewings";
  private filters: DatabaseQuery = { limit: 25, query: "", descending: false };
  private fitPage = true;
  private allMode = false;
  private allBatchSize = ALL_BATCH;
  private moreLoading = false;
  private moreError = "";
  private detailLoading = false;
  private detailRequest = 0;
  private referenceRequest = 0;
  private referenceLoading = false;
  private referenceError = "";
  private referencedBy: DatabaseReferenceGroup[] = [];
  private rowScrollTop = 0;
  private listHeight = 440;
  private fitObserver?: ResizeObserver;
  private fitList?: Element;
  private fitTimer?: ReturnType<typeof setTimeout>;
  private showSystem = false;
  private sorts: Record<string, { sort: string; descending: boolean }> = {};
  private preferences?: PreferenceStore;
  private fuzzySearch = true;
  private ready = false;
  private preferenceError = "";
  private loading = false;
  private saving = false;
  private transferBusy = false;
  private repairing = false;
  private repairPending = false;
  private error = "";
  private notice = "";
  private search = "";
  private detail?: Row;
  private selected = new Set<number>();
  private operation: "edit" | "delete" | "new" | null = null;
  private draft: Record<string, string> = {};
  private nulls = new Set<string>();
  private original = "";
  private createDraft = manualDraft();
  private confirmed = false;
  private deleteWord = "";
  private pending?: PreparedMutation;
  private covers = new CoverQueue();
  protected willUpdate(changed: PropertyValues) {
    if (!changed.has("client") && !changed.has("scope")) return;
    const key = `${this.scope?.entry_id}:${this.scope?.dataset_id}:${this.scope?.permissions.edit}`;
    if (key === this.bound && this.client === this.boundClient) {
      const fuzzy = this.scope?.ui_defaults?.fuzzy_search !== false;
      if (this.ready && this.fuzzySearch !== fuzzy) {
        this.fuzzySearch = fuzzy;
        void this.load();
      }
      return;
    }
    this.clear();
    this.bound = key;
    this.boundClient = this.client;
    if (this.client && this.scope?.permissions.edit) void this.initialize();
  }
  connectedCallback() {
    super.connectedCallback();
    window.addEventListener("resize", this.scheduleFit);
    window.visualViewport?.addEventListener("resize", this.scheduleFit);
    this.requestUpdate("client");
    this.requestUpdate("scope");
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener("resize", this.scheduleFit);
    window.visualViewport?.removeEventListener("resize", this.scheduleFit);
    this.fitObserver?.disconnect();
    this.fitObserver = undefined;
    this.fitList = undefined;
    clearTimeout(this.fitTimer);
    this.clear();
    this.boundClient = undefined;
    this.bound = "";
  }
  private clear() {
    this.covers.cache.dispose();
    this.covers = new CoverQueue();
    this.generation++;
    this.request++;
    this.preferences?.dispose();
    this.preferences = undefined;
    this.fuzzySearch = true;
    this.ready = false;
    this.page = undefined;
    this.table = "viewings";
    this.fitPage = true;
    this.allMode = this.moreLoading = this.detailLoading = false;
    this.allBatchSize = ALL_BATCH;
    this.moreError = "";
    this.detailRequest++;
    this.referenceRequest++;
    this.referenceLoading = false;
    this.referenceError = "";
    this.referencedBy = [];
    this.rowScrollTop = 0;
    this.filters = { limit: 25, query: "", descending: false };
    this.showSystem = false;
    this.sorts = {};
    this.detail = undefined;
    this.selected.clear();
    this.pending = undefined;
    this.operation = null;
    this.draft = {};
    this.original = "";
    this.search = "";
    this.confirmed = false;
    this.deleteWord = "";
    this.loading =
      this.saving =
      this.transferBusy =
      this.repairing =
      this.repairPending =
        false;
    this.error = this.notice = this.preferenceError = "";
    for (const dialog of this.renderRoot.querySelectorAll("dialog"))
      dialog.close();
    this.busy();
    this.requestUpdate();
  }
  private async initialize(anchor?: ResizeAnchor) {
    const generation = ++this.generation;
    this.preferences?.dispose();
    this.preferences = new PreferenceStore(
      this.client!,
      this.scope!,
      false,
      (error) => {
        if (generation !== this.generation) return;
        if (error && errorCode(error) === "unauthorized") this.fail(error);
        else {
          this.preferenceError = error ? errorMessage(error) : "";
          this.requestUpdate();
        }
      },
      "database",
    );
    try {
      const values = await this.preferences.load();
      if (generation !== this.generation) return;
      this.fuzzySearch = this.scope?.ui_defaults?.fuzzy_search !== false;
      this.fitPage = values.limit === "fit" || values.limit === undefined;
      this.allMode = values.limit === "all";
      this.filters.limit = this.allMode
        ? ALL_BATCH
        : this.fitPage
          ? 25
          : (values.limit as number);
      this.showSystem = values.show_system as boolean;
      this.sorts = (values.sorts ?? {}) as typeof this.sorts;
      this.table = String(values.table ?? "viewings");
      if (!this.showSystem && !MAIN.includes(this.table))
        this.table = "viewings";
      this.filters = { ...this.filters, ...this.sorts[this.table] };
      if (anchor) {
        this.table = anchor.table;
        this.showSystem ||= !MAIN.includes(this.table);
        this.filters = { ...anchor.filters, limit: this.filters.limit };
        this.search = this.filters.query;
      }
      this.ready = true;
      await this.load(
        anchor && !this.allMode
          ? Math.floor(anchor.index / this.filters.limit) * this.filters.limit
          : 0,
        anchor?.revision,
        this.allMode ? undefined : anchor?.row,
      );
      if (anchor && this.allMode && generation === this.generation) {
        while (
          this.page &&
          this.page.items.length <= anchor.index &&
          this.page.has_more &&
          !this.moreError &&
          generation === this.generation
        ) {
          const loaded = this.page.items.length;
          await this.loadMore();
          if (!this.page || this.page.items.length <= loaded) break;
        }
        const row = this.page?.items[anchor.index];
        if (row && generation === this.generation) {
          await this.showDetail(row);
          await this.updateComplete;
          const list =
            this.renderRoot.querySelector<HTMLElement>(".entry-list");
          if (list) {
            list.scrollTop = anchor.index * ROW_HEIGHT;
            this.rowScrollTop = list.scrollTop;
            this.requestUpdate();
          }
        }
      }
    } catch (error) {
      if (generation === this.generation) this.fail(error);
    }
  }
  protected updated() {
    const list = this.renderRoot.querySelector(".entry-list");
    if (list !== this.fitList) {
      this.fitObserver?.disconnect();
      this.fitList = list ?? undefined;
      this.fitObserver ??= new ResizeObserver(this.scheduleFit);
      if (list) this.fitObserver.observe(list);
    }
    this.scheduleFit();
    for (const [name, value] of [
      [
        "database_limit",
        this.allMode
          ? "all"
          : this.fitPage
            ? "fit"
            : String(this.filters.limit),
      ],
      ["database_sort", this.filters.sort ?? this.page?.columns[0] ?? ""],
      ["database_table", MAIN.includes(this.table) ? "" : this.table],
    ]) {
      const input = this.renderRoot.querySelector<HTMLSelectElement>(
        `[name="${name}"]`,
      );
      if (input && input.value !== value) input.value = value;
    }
  }
  private scheduleFit = () => {
    clearTimeout(this.fitTimer);
    if (
      !this.fitPage ||
      !this.ready ||
      !this.page ||
      this.blocked ||
      this.operation
    )
      return;
    this.fitTimer = setTimeout(() => this.resizePage(), 120);
  };
  private resizePage() {
    if (!this.fitPage || this.blocked || this.operation || !this.page) return;
    const list = this.renderRoot.querySelector<HTMLElement>(".entry-list");
    if (!list || list.clientHeight <= 0) return;
    const heights = [...list.querySelectorAll("li")]
      .map((row) => row.getBoundingClientRect().height)
      .filter((height) => height > 0);
    if (!heights.length) return;
    // Use the tallest rendered row so wrapped labels also fit without clipping.
    const limit = Math.max(
      1,
      Math.min(500, Math.floor((list.clientHeight - 8) / Math.max(...heights))),
    );
    if (limit === this.filters.limit) return;
    const index = this.detail ? this.page.items.indexOf(this.detail) : -1;
    const anchor = this.page.offset + Math.max(0, index);
    const detail = this.detail;
    this.filters.limit = limit;
    void this.load(
      Math.floor(anchor / limit) * limit,
      this.page.revision,
      detail,
    );
  }
  private get blocked() {
    return (
      this.loading ||
      this.detailLoading ||
      this.saving ||
      !!this.pending ||
      this.transferBusy ||
      this.repairing
    );
  }
  private busy() {
    this.dispatchEvent(
      new CustomEvent("maintenance-busy", {
        detail:
          this.saving ||
          !!this.pending ||
          this.transferBusy ||
          this.repairPending,
        bubbles: true,
        composed: true,
      }),
    );
  }
  private fail(error: unknown) {
    if (errorCode(error) === "unauthorized") {
      this.clear();
      this.dispatchEvent(
        new CustomEvent("access-denied", { bubbles: true, composed: true }),
      );
    }
    const code = errorCode(error),
      message = (error as { message?: unknown })?.message;
    this.error =
      ["query_syntax", "conflict", "invalid_request", "busy"].includes(code) &&
      typeof message === "string" &&
      message !== code
        ? message
        : errorMessage(error);
    this.requestUpdate();
  }
  private async load(offset = 0, revision?: number, preserve?: Row) {
    if (!this.client || !this.scope || !this.ready || this.pending) return;
    const generation = this.generation,
      request = ++this.request;
    this.loading = true;
    this.moreLoading = this.detailLoading = false;
    this.moreError = "";
    this.allBatchSize = ALL_BATCH;
    this.detailRequest++;
    this.referenceRequest++;
    this.referenceLoading = false;
    this.referenceError = "";
    this.referencedBy = [];
    this.rowScrollTop = 0;
    if (this.page?.table !== this.table) this.page = undefined;
    this.error = "";
    if (!preserve) this.detail = undefined;
    this.selected.clear();
    this.requestUpdate();
    try {
      const page = this.allMode
        ? await this.inspectAllChunk(offset, revision, generation, request)
        : await this.client.inspect(
            this.scope,
            this.table,
            offset,
            revision,
            this.filters,
          );
      if (generation !== this.generation || request !== this.request) return;
      if (this.allMode) {
        if (
          (page.has_more && !page.items.length) ||
          page.row_tokens?.length !== page.items.length
        )
          throw new ApiError("refresh_required");
        page.items = page.items.map((row) => this.compactRow(row, page));
      }
      this.page = page;
      if (preserve) {
        const keys =
          page.schema
            ?.filter((field) => field.primary)
            .map((field) => field.name) ?? [];
        this.detail = page.items.find((row) =>
          keys.length
            ? keys.every((key) => row[key] === preserve[key])
            : JSON.stringify(row) === JSON.stringify(preserve),
        );
      }
      this.filters.sort = page.sort;
      if (this.detail) void this.loadReferencedBy(this.detail);
    } catch (error) {
      if (generation === this.generation && request === this.request)
        this.fail(error);
    } finally {
      if (generation === this.generation && request === this.request) {
        this.loading = false;
        this.requestUpdate();
        await this.updateComplete;
        if (generation === this.generation && request === this.request) {
          const list =
            this.renderRoot.querySelector<HTMLElement>(".entry-list");
          if (list) list.scrollTop = 0;
          const row = this.renderRoot.querySelector<HTMLElement>("li.selected");
          if (preserve && row && list)
            list.scrollTop = Math.max(
              0,
              row.offsetTop -
                list.offsetTop +
                row.offsetHeight -
                list.clientHeight,
            );
        }
      }
    }
  }
  private follow(reference: NonNullable<DatabasePage["references"]>[number]) {
    if (!this.detail) return;
    const values = Object.fromEntries(
      Object.entries(reference.key).map(([field, local]) => [
        field,
        this.detail![local],
      ]),
    );
    void this.followValues(reference.table, values);
  }
  private async followValues(target: string, values: Record<string, unknown>) {
    if (this.blocked || !this.page?.tables || !(target in this.page.tables))
      return;
    const clauses = [];
    for (const [field, value] of Object.entries(values)) {
      if (
        value == null ||
        !/^[a-z_][a-z_0-9]*$/.test(field) ||
        !["string", "number"].includes(typeof value)
      )
        return;
      clauses.push(
        `${field} = ${typeof value === "number" ? value : `'${String(value).replaceAll("'", "''")}'`}`,
      );
    }
    if (!clauses.length) return;
    if (!MAIN.includes(target)) {
      this.showSystem = true;
      this.preferences?.set({ show_system: true });
    }
    this.table = target;
    this.search = `WHERE ${clauses.join(" AND ")}`;
    this.filters = {
      limit: this.filters.limit,
      query: this.search,
      ...this.sorts[this.table],
    };
    this.preferences?.set({ table: this.table });
    const generation = this.generation,
      table = this.table;
    await this.load();
    if (generation !== this.generation || table !== this.table) return;
    if (this.page?.items[0]) void this.showDetail(this.page.items[0]);
    else this.notice = "The referenced entry no longer exists.";
    this.requestUpdate();
  }
  private referenceText(table: string, values: unknown[]) {
    return `${LABELS[table] ?? table} - ${values.map((value) => String(value)).join(", ")}`;
  }
  private async loadReferencedBy(row: Row) {
    if (!this.client || !this.scope || !this.page) return;
    const page = this.page,
      index = page.items.indexOf(row),
      token = page.row_tokens?.[index];
    const request = ++this.referenceRequest,
      generation = this.generation;
    this.referencedBy = [];
    this.referenceError = "";
    if (index < 0 || !token) {
      this.referenceLoading = false;
      this.requestUpdate();
      return;
    }
    this.referenceLoading = true;
    this.requestUpdate();
    try {
      const result = await this.client.referencedBy(
        this.scope,
        page.table,
        this.rowKey(row),
        token,
        page.revision,
      );
      if (
        request === this.referenceRequest &&
        generation === this.generation &&
        this.detail === row
      )
        this.referencedBy = result.groups;
    } catch (error) {
      if (
        request !== this.referenceRequest ||
        generation !== this.generation ||
        this.detail !== row
      )
        return;
      if (errorCode(error) === "unauthorized") this.fail(error);
      else this.referenceError = errorMessage(error);
    } finally {
      if (
        request === this.referenceRequest &&
        generation === this.generation &&
        this.detail === row
      ) {
        this.referenceLoading = false;
        this.requestUpdate();
      }
    }
  }
  private rowKey(row: Row) {
    return Object.fromEntries(
      (this.page?.schema ?? [])
        .filter((field) => field.primary)
        .map((field) => [field.name, row[field.name]]),
    );
  }
  private rowSelection(row: Row) {
    const index = this.page!.items.indexOf(row);
    return {
      key: this.rowKey(row),
      token: this.page!.row_tokens?.[index] ?? "",
    };
  }
  private selectedRows() {
    return this.selected.size
      ? [...this.selected].map((index) => this.page!.items[index])
      : this.detail
        ? [this.detail]
        : [];
  }
  private compactRow(row: Row, page: DatabasePage): Row {
    const keys = new Set([
      "title",
      "name",
      "id",
      "cache_key",
      "owner",
      "request_id",
      ...(page.schema ?? [])
        .filter((field) => field.primary)
        .map((field) => field.name),
    ]);
    return Object.fromEntries(
      [...keys]
        .filter((key) => key in row)
        .map((key) => [
          key,
          typeof row[key] === "string" &&
          !(page.schema ?? []).some(
            (field) => field.primary && field.name === key,
          )
            ? (row[key] as string).slice(0, 512)
            : row[key],
        ]),
    );
  }
  private async inspectAllChunk(
    offset: number,
    revision: number | undefined,
    generation: number,
    request: number,
  ) {
    while (
      generation === this.generation &&
      request === this.request &&
      this.client &&
      this.scope
    ) {
      try {
        return await this.client.inspect(
          this.scope,
          this.table,
          offset,
          revision,
          { ...this.filters, limit: this.allBatchSize },
        );
      } catch (error) {
        if (generation !== this.generation || request !== this.request)
          throw error;
        if (
          errorCode(error) !== "database_page_too_large" ||
          this.allBatchSize === 1
        )
          throw error;
        this.allBatchSize = Math.max(1, Math.floor(this.allBatchSize / 2));
      }
    }
    throw new ApiError("not_ready");
  }
  private async loadMore() {
    if (
      !this.allMode ||
      !this.client ||
      !this.scope ||
      !this.page?.has_more ||
      this.moreLoading ||
      this.moreError ||
      this.blocked ||
      this.operation
    )
      return;
    const generation = this.generation,
      request = this.request,
      page = this.page;
    this.moreLoading = true;
    this.requestUpdate();
    try {
      const next = await this.inspectAllChunk(
        page.items.length,
        page.revision,
        generation,
        request,
      );
      if (
        generation !== this.generation ||
        request !== this.request ||
        !this.allMode
      )
        return;
      if (
        next.revision !== page.revision ||
        next.offset !== page.items.length ||
        (next.has_more && !next.items.length) ||
        next.row_tokens?.length !== next.items.length
      )
        throw new ApiError("refresh_required");
      this.page = {
        ...page,
        items: [
          ...page.items,
          ...next.items.map((row) => this.compactRow(row, next)),
        ],
        row_tokens: [...(page.row_tokens ?? []), ...(next.row_tokens ?? [])],
        has_more: next.has_more,
        total: next.total,
      };
    } catch (error) {
      if (generation !== this.generation || request !== this.request) return;
      if (errorCode(error) === "unauthorized") this.fail(error);
      else
        this.moreError =
          errorCode(error) === "refresh_required"
            ? "The database changed while loading rows."
            : errorMessage(error);
    } finally {
      if (generation === this.generation && request === this.request) {
        this.moreLoading = false;
        this.requestUpdate();
      }
    }
  }
  private scrollRows(event: Event) {
    const list = event.currentTarget as HTMLElement;
    this.rowScrollTop = list.scrollTop;
    this.listHeight = list.clientHeight || 440;
    if (
      this.allMode &&
      list.scrollHeight - list.scrollTop - list.clientHeight < 300
    )
      void this.loadMore();
    if (this.allMode) {
      const focused = (this.renderRoot as ShadowRoot)
        .activeElement as HTMLElement | null;
      const item = focused?.closest<HTMLElement>("li[data-row-index]");
      const index = item ? Number(item.dataset.rowIndex) : -1;
      const start = Math.max(0, Math.floor(this.rowScrollTop / ROW_HEIGHT) - 8);
      const end = start + Math.ceil(this.listHeight / ROW_HEIGHT) + 16;
      if (index >= 0 && (index < start || index >= end))
        list.focus({ preventScroll: true });
      this.requestUpdate();
    }
  }
  private async showDetail(row: Row) {
    if (this.blocked || !this.page) return;
    if (this.allMode && this.client && this.scope) {
      const page = this.page,
        index = page.items.indexOf(row),
        token = page.row_tokens?.[index],
        generation = this.generation,
        request = this.request,
        detailRequest = ++this.detailRequest;
      if (index < 0) return;
      this.detailLoading = true;
      this.requestUpdate();
      try {
        const result = await this.client.inspect(
          this.scope,
          this.table,
          index,
          page.revision,
          { ...this.filters, limit: 1 },
        );
        if (
          generation !== this.generation ||
          request !== this.request ||
          detailRequest !== this.detailRequest
        )
          return;
        if (
          result.revision !== page.revision ||
          result.offset !== index ||
          result.table !== page.table ||
          !result.items[0] ||
          (token && result.row_tokens?.[0] !== token)
        )
          throw new ApiError("refresh_required");
        if (this.detail) {
          const old = this.page!.items.indexOf(this.detail);
          if (old >= 0)
            this.page!.items[old] = this.compactRow(this.detail, this.page!);
        }
        this.page!.items[index] = result.items[0];
        row = result.items[0];
      } catch (error) {
        if (
          generation === this.generation &&
          request === this.request &&
          detailRequest === this.detailRequest
        )
          this.fail(error);
        return;
      } finally {
        if (
          generation === this.generation &&
          request === this.request &&
          detailRequest === this.detailRequest
        ) {
          this.detailLoading = false;
          this.requestUpdate();
        }
      }
    }
    this.detail = row;
    void this.loadReferencedBy(row);
    this.requestUpdate();
    void this.updateComplete.then(() => {
      if (this.detail !== row) return;
      const detail =
        this.renderRoot.querySelector<HTMLElement>(".entries-detail");
      if (detail) detail.scrollTop = 0;
    });
  }
  private async open(id: string) {
    this.requestUpdate();
    await this.updateComplete;
    if (this.isConnected)
      this.renderRoot.querySelector<HTMLDialogElement>(`#${id}`)?.showModal();
  }
  private async edit() {
    if (this.blocked || !this.detail) return;
    this.operation = "edit";
    this.draft = {};
    this.nulls.clear();
    for (const field of this.page?.schema ?? []) {
      if (!field.editable) continue;
      const value = this.detail[field.name];
      this.draft[field.name] =
        value === null
          ? ""
          : typeof value === "string"
            ? value
            : JSON.stringify(value);
      if (value === null) this.nulls.add(field.name);
    }
    this.original = JSON.stringify([this.draft, [...this.nulls]]);
    this.confirmed = false;
    void this.open("database-edit");
  }
  private newEntry() {
    if (this.blocked || this.table !== "viewings") return;
    this.operation = "new";
    this.createDraft = manualDraft();
    this.original = JSON.stringify(this.createDraft);
    this.confirmed = false;
    void this.open("database-edit");
  }
  private deleteEntries() {
    if (this.blocked || !this.page?.deletable || !this.selectedRows().length)
      return;
    this.operation = "delete";
    this.deleteWord = "";
    void this.open("database-delete");
  }
  private discard() {
    if (this.pending || this.saving) return false;
    const current =
      this.operation === "edit"
        ? JSON.stringify([this.draft, [...this.nulls]])
        : this.operation === "new"
          ? JSON.stringify(this.createDraft)
          : this.original;
    return (
      current === this.original ||
      window.confirm("Discard unsaved database changes?")
    );
  }
  confirmNavigation() {
    return (
      !this.transferBusy &&
      !this.saving &&
      !this.pending &&
      this.discard() &&
      (this.renderRoot
        .querySelector<KaleidescapePurchaseRepair>(
          "kaleidescape-purchase-repair",
        )
        ?.confirmNavigation() ??
        true)
    );
  }
  private close(event?: Event) {
    event?.preventDefault();
    if (!this.saving && !this.pending && !this.discard()) return;
    this.mutationEpoch++;
    this.pending = undefined;
    this.saving = false;
    this.busy();
    for (const id of ["database-edit", "database-delete"])
      this.renderRoot.querySelector<HTMLDialogElement>(`#${id}`)?.close();
    this.operation = null;
    this.draft = {};
    this.original = "";
    this.requestUpdate();
  }
  private async save(event?: Event) {
    event?.preventDefault();
    if (!this.client || !this.scope || this.saving) return;
    try {
      if (!this.pending) {
        if (!this.operation || !this.page) return;
        if (this.operation === "delete" && this.deleteWord !== "DELETE") return;
        if (this.operation !== "delete" && !this.confirmed) return;
        if (this.operation === "new")
          this.pending = this.client.prepare(this.scope, "create", {
            data: manualData(this.createDraft),
          });
        else {
          const patch: Row = {};
          if (this.operation === "edit") {
            for (const field of this.page.schema ?? []) {
              if (!field.editable) continue;
              let value: unknown = this.nulls.has(field.name)
                ? null
                : this.draft[field.name];
              if (value !== null && field.type === "number") {
                if (!String(value).trim()) throw new Error("invalid");
                value = Number(value);
                if (!Number.isFinite(value)) throw new Error("invalid");
              }
              if (value !== null && field.type === "json") {
                value = JSON.parse(String(value));
                value = JSON.stringify(value);
              }
              if (
                JSON.stringify(value) !==
                JSON.stringify(this.detail![field.name])
              )
                patch[field.name] = value;
            }
            if (!Object.keys(patch).length) {
              this.close();
              return;
            }
          }
          this.pending = this.client.prepareDatabaseMutation(this.scope, {
            table: this.table,
            operation: this.operation,
            rows: (this.operation === "edit"
              ? [this.detail!]
              : this.selectedRows()
            ).map((row) => this.rowSelection(row)),
            patch,
            expected_revision: this.page.dataset_revision ?? this.page.revision,
            confirmation: this.operation === "delete" ? "DELETE" : "SAVE",
          });
        }
      }
      const generation = this.generation,
        epoch = this.mutationEpoch;
      this.saving = true;
      this.error = "";
      this.busy();
      this.requestUpdate();
      try {
        if (this.operation === "new") await this.client.mutate(this.pending);
        else await this.client.databaseMutation(this.pending);
        if (generation !== this.generation || epoch !== this.mutationEpoch)
          return;
        this.pending = undefined;
        this.saving = false;
        this.operation = null;
        this.original = "";
        this.draft = {};
        for (const dialog of this.renderRoot.querySelectorAll<HTMLDialogElement>(
          "#database-edit,#database-delete",
        ))
          dialog.close();
        this.notice = "Database change applied.";
        this.dispatchEvent(
          new CustomEvent("database-changed", {
            bubbles: true,
            composed: true,
          }),
        );
        await this.load();
      } catch (error) {
        if (generation !== this.generation || epoch !== this.mutationEpoch)
          return;
        if (
          [
            "invalid_request",
            "conflict",
            "not_found",
            "unauthorized",
            "busy",
            "backup_in_progress",
            "library_storage_limit",
          ].includes(errorCode(error))
        )
          this.pending = undefined;
        this.fail(error);
      } finally {
        if (generation === this.generation && epoch === this.mutationEpoch) {
          this.saving = false;
          this.busy();
          this.requestUpdate();
        }
      }
    } catch {
      this.error = "Check the edited values and JSON syntax before saving.";
      this.requestUpdate();
    }
  }
  private changeTable(table: string) {
    if (this.blocked || !this.discard()) return;
    this.table = table;
    this.filters = {
      limit: this.filters.limit,
      query: "",
      ...({ descending: false } as { descending: boolean }),
      ...this.sorts[table],
    };
    this.search = "";
    this.preferences?.set({ table });
    void this.load();
  }
  private browse(change: Partial<DatabaseQuery>) {
    if (this.blocked) return;
    this.filters = { ...this.filters, ...change };
    if (change.limit !== undefined)
      this.preferences?.set({ limit: change.limit });
    if (change.sort !== undefined || change.descending !== undefined) {
      this.sorts = {
        ...this.sorts,
        [this.table]: {
          sort: this.filters.sort ?? this.page?.columns[0] ?? "id",
          descending: this.filters.descending,
        },
      };
      this.preferences?.set({ sorts: this.sorts });
    }
    void this.load();
  }
  private retry() {
    return this.pending
      ? html`<div class="warning" role="alert">
          ${this.saving ? "Saving…" : "Result unconfirmed. Retry this exact request."}<button
            ?disabled=${this.saving}
            @click=${() => this.save()}
          >
            Retry same change</button
          ><button
            ?disabled=${this.saving}
            @click=${() => {
              if (
                window.confirm(
                  "The change may have committed. Discard the retry and refresh to inspect the result?",
                )
              ) {
                this.pending = undefined;
                this.original = "";
                this.operation = null;
                this.busy();
                for (const dialog of this.renderRoot.querySelectorAll("dialog"))
                  dialog.close();
                void this.load();
              }
            }}
          >
            Discard retry & reload
          </button>
        </div>`
      : nothing;
  }
  private options() {
    return html`<dialog
      id="database-options"
      class="database-dialog"
      @click=${dismissBackdrop}
    >
      <div class="card-head">
        <h2>Database options</h2>
        ${closeButton(() => this.renderRoot.querySelector<HTMLDialogElement>("#database-options")?.close())}
      </div>
      <p>View choices save automatically for your HA user.</p>
      <fieldset ?disabled=${this.blocked}>
        <label
          >Rows per page<select
            name="database_limit"
            .value=${this.allMode ? "all" : this.fitPage ? "fit" : String(this.filters.limit)}
            @change=${(event: Event) => {
              const value = (event.target as HTMLSelectElement).value;
              const wasAll = this.allMode;
              this.fitPage = value === "fit";
              this.allMode = value === "all";
              this.preferences?.set({
                limit: this.fitPage
                  ? "fit"
                  : this.allMode
                    ? "all"
                    : Number(value),
              });
              if (this.fitPage && wasAll) {
                this.filters.limit = 25;
                void this.load();
              } else if (this.fitPage) {
                this.scheduleFit();
                this.requestUpdate();
              } else if (this.allMode) {
                this.filters.limit = ALL_BATCH;
                void this.load();
              } else this.browse({ limit: Number(value) });
            }}
          >
            <option value="fit">Fit to screen</option>
            <option value="all">All · load as you scroll</option>
            ${[10, 25, 100, 500].map((count) => html`<option value=${count}>${count}</option>`)}
          </select></label
        >
        <p class="muted">
          All loads rows as you scroll. Up to 100 loaded rows can be selected
          for deletion.
        </p>
        <label class="check"
          ><input
            name="show_system"
            type="checkbox"
            .checked=${this.showSystem}
            @change=${(event: Event) => {
              this.showSystem = (event.target as HTMLInputElement).checked;
              this.preferences?.set({ show_system: this.showSystem });
              if (!this.showSystem && !MAIN.includes(this.table))
                this.changeTable("viewings");
              this.requestUpdate();
            }}
          />Show system tables</label
        >
      </fieldset>
      <p class="muted">
        IDs, relationship keys, managed paths, audit history, dataset metadata
        and write receipts remain protected.
      </p>
    </dialog>`;
  }
  protected render() {
    if (!this.ready)
      return html`<p>${this.error || "Loading database preferences…"}</p>
        ${this.error ? html`<button @click=${() => this.initialize()}>Retry loading database</button>` : nothing}`;
    const available = Object.keys(this.page?.tables ?? LABELS);
    const tables = MAIN.filter((table) => available.includes(table));
    const systemTables = available.filter((table) => !MAIN.includes(table));
    const editable = (this.page?.schema ?? []).some((field) => field.editable);
    const rows = this.page?.items ?? [];
    const start = this.allMode
      ? Math.max(0, Math.floor(this.rowScrollTop / ROW_HEIGHT) - 8)
      : 0;
    const end = this.allMode
      ? Math.min(
          rows.length,
          start + Math.ceil(this.listHeight / ROW_HEIGHT) + 16,
        )
      : rows.length;
    return html`<section class="card database" aria-label="Database management">
      <div class="entries-header">
        <div class="database-toolbar">
          <div class="actions">
            <button
              class="primary"
              ?disabled=${this.blocked || this.table !== "viewings"}
              @click=${this.newEntry}
            >
              New Entry</button
            ><button
              class="danger"
              ?disabled=${this.blocked || !this.page?.deletable || !this.selectedRows().length}
              @click=${this.deleteEntries}
            >
              ${`Delete ${this.selected.size > 1 ? "entries" : "entry"}${this.selected.size ? ` (${this.selected.size})` : ""}`}</button
            ><button ?disabled=${this.blocked} @click=${() => this.load()}>
              Refresh database
            </button>
          </div>
          <kaleidescape-database-cleanup
            .client=${this.client}
            .scope=${this.scope}
            .disabled=${this.blocked || !!this.operation}
            @cleanup-complete=${() => void this.load()}
          ></kaleidescape-database-cleanup>
          <kaleidescape-transfers
            .client=${this.client}
            .scope=${this.scope ? { ...this.scope, revision: this.page?.dataset_revision ?? this.scope.revision } : undefined}
            .disabled=${this.blocked || !!this.operation}
            @transfer-busy=${(event: CustomEvent<boolean>) => {
              this.transferBusy = event.detail;
              this.busy();
            }}
            @database-changed=${() => {
              if (!this.pending) void this.load();
            }}
          ></kaleidescape-transfers
          ><button
            class="database-options-button"
            ?disabled=${this.blocked}
            @click=${() => this.open("database-options")}
          >
            Options
          </button>
        </div>
        <div class="database-messages">
          ${this.error ? html`<p class="error" role="alert">${this.error}</p>` : nothing}${this.notice ? html`<p role="status">${this.notice}</p>` : nothing}${this.preferenceError ? html`<p class="warning">${this.preferenceError}<button @click=${() => this.preferences?.retry()}>Retry preferences</button></p>` : nothing}${this.retry()}
        </div>
        <div class="database-table-selector">
          <div
            class="page-tabs table-tabs"
            role="tablist"
            aria-label="Database tables"
            @keydown=${(event: KeyboardEvent) => {
              const index = tables.indexOf(this.table);
              const next =
                event.key === "ArrowRight"
                  ? (index + 1) % tables.length
                  : event.key === "ArrowLeft"
                    ? (index + tables.length - 1) % tables.length
                    : event.key === "Home"
                      ? 0
                      : event.key === "End"
                        ? tables.length - 1
                        : -1;
              if (next >= 0 && !this.blocked) {
                event.preventDefault();
                this.changeTable(tables[next]);
                void this.updateComplete.then(() =>
                  this.renderRoot
                    .querySelector<HTMLButtonElement>(`#table-${this.table}`)
                    ?.focus(),
                );
              }
            }}
          >
            ${tables.map((table) => html`<button role="tab" id=${`table-${table}`} aria-selected=${this.table === table} tabindex=${this.table === table || (!MAIN.includes(this.table) && table === tables[0]) ? 0 : -1} ?disabled=${this.blocked} @click=${() => this.changeTable(table)}>${LABELS[table] ?? table}${this.page ? ` (${this.page.tables[table]})` : ""}</button>`)}
          </div>
          ${
            this.showSystem
              ? html`<label class="system-table-picker"
                  >System tables<select
                    name="database_table"
                    .value=${MAIN.includes(this.table) ? "" : this.table}
                    ?disabled=${this.blocked}
                    @change=${(event: Event) => {
                      const table = (event.target as HTMLSelectElement).value;
                      if (table) this.changeTable(table);
                    }}
                  >
                    <option value="">Choose a table</option>
                    ${SYSTEM_GROUPS.map(([group]) => {
                      const choices = systemTables.filter(
                        (table) => systemGroup(table) === group,
                      );
                      return choices.length
                        ? html`<optgroup label=${group}>
                            ${choices.map((table) => html`<option value=${table}>${LABELS[table] ?? table.replaceAll("_", " ")}${this.page ? ` (${this.page.tables[table]})` : ""}</option>`)}
                          </optgroup>`
                        : nothing;
                    })}
                  </select></label
                >`
              : nothing
          }
        </div>
        <div class="database-filters filters">
          <kaleidescape-database-search
            .client=${this.client}
            .scope=${this.scope}
            .table=${this.table}
            .value=${this.search}
            .fields=${this.page?.query_fields ?? []}
            .operators=${this.page?.operators ?? []}
            .disabled=${this.blocked}
            @query-change=${(event: CustomEvent<string>) => {
              this.search = event.detail;
            }}
            @query-submit=${() => this.browse({ query: this.search })}
            @access-denied=${() => this.fail({ code: "unauthorized" })}
            ><button
              slot="actions"
              ?disabled=${this.blocked}
              @click=${() => this.browse({ query: this.search })}
            >
              Search
            </button></kaleidescape-database-search
          >
          <label
            >Sort by<select
              name="database_sort"
              .value=${this.filters.sort ?? ""}
              @change=${(event: Event) => this.browse({ sort: (event.target as HTMLSelectElement).value })}
            >
              ${this.page?.columns.map((name) => html`<option value=${name}>${name}</option>`)}
            </select></label
          ><label
            >Order<button
              aria-label="Reverse database sort"
              @click=${() => this.browse({ descending: !this.filters.descending })}
            >
              ${this.filters.descending ? "Descending ↓" : "Ascending ↑"}
            </button></label
          >
        </div>
      </div>
      <div class="entries-layout">
        <section
          class="database-entries entries-list"
          aria-label="Database entries"
        >
          <div class="card-head">
            <span class="database-table-heading"
              ><h2>${LABELS[this.table] ?? this.table}</h2>
              ${settingHint(LABELS[this.table] ?? this.table, (tableDescriptions as Record<string, string>)[this.table] ?? "Database table records.")}</span
            >
          </div>
          ${this.loading ? html`<p role="status">Loading database…</p>` : nothing}
          <ul
            class="entry-list"
            tabindex="0"
            aria-label="Database rows"
            @scroll=${this.scrollRows}
          >
            ${this.allMode && start ? html`<li class="entry-spacer" role="presentation" aria-hidden="true" style=${`height:${start * ROW_HEIGHT}px`}></li>` : nothing}
            ${repeat(
              rows.slice(start, end),
              (_row, localIndex) => `${this.request}:${start + localIndex}`,
              (row, localIndex) => {
                const index = start + localIndex;
                return html`<li
                  data-row-index=${index}
                  aria-posinset=${(this.page?.offset ?? 0) + index + 1}
                  aria-setsize=${this.page?.total ?? rows.length}
                  class=${this.detail === row ? "selected" : ""}
                >
                  ${
                    this.page?.deletable
                      ? html`<input
                          type="checkbox"
                          aria-label=${`Select ${String(row.title ?? row.name ?? row.id ?? row.cache_key ?? row.owner ?? "row")}`}
                          .checked=${this.selected.has(index)}
                          ?disabled=${this.blocked || (this.selected.size >= 100 && !this.selected.has(index))}
                          @change=${(event: Event) => {
                            if ((event.target as HTMLInputElement).checked)
                              this.selected.add(index);
                            else this.selected.delete(index);
                            this.requestUpdate();
                          }}
                        />`
                      : nothing
                  }<button
                    class="link entry-name"
                    title=${String(row.title ?? row.name ?? row.id ?? "Database entry")}
                    ?disabled=${this.blocked}
                    @click=${() => this.showDetail(row)}
                  >
                    ${String(row.title ?? row.name ?? row.id ?? row.cache_key ?? row.owner ?? row.request_id ?? "Dataset metadata")}
                  </button>
                </li>`;
              },
            )}
            ${this.allMode && end < rows.length ? html`<li class="entry-spacer" role="presentation" aria-hidden="true" style=${`height:${(rows.length - end) * ROW_HEIGHT}px`}></li>` : nothing}
          </ul>
          ${this.allMode && this.moreLoading ? html`<p role="status">Loading more rows…</p>` : nothing}
          ${this.allMode && this.moreError ? html`<p class="error" role="alert">${this.moreError} Refresh database to restart.</p>` : nothing}
          ${this.allMode && this.page?.has_more && !this.moreError ? html`<button type="button" ?disabled=${this.moreLoading || this.blocked} @click=${this.loadMore}>Load more rows</button>` : nothing}
        </section>
        <section
          class="database-detail entries-detail"
          aria-label="Selected database entry"
          tabindex="0"
        >
          <div class="card-head">
            <h2>Entry details</h2>
            ${
              this.detail
                ? html`<button
                    ?disabled=${this.blocked || (!editable && this.table !== "purchase_records")}
                    @click=${() => {
                      if (this.table === "purchase_records") {
                        this.repairing = true;
                        this.requestUpdate();
                      } else this.edit();
                    }}
                  >
                    Edit entry
                  </button>`
                : nothing
            }
            ${
              this.detail && this.table === "purchase_repair_events"
                ? html`<button
                    ?disabled=${this.blocked}
                    @click=${() => {
                      this.repairing = true;
                      this.requestUpdate();
                    }}
                  >
                    Review reversal
                  </button>`
                : nothing
            }
          </div>
          ${this.detailLoading ? html`<p role="status">Loading entry…</p>` : nothing}
          ${
            this.detail
              ? html`${
                    (this.table === "library_artwork" ||
                      this.table === "library") &&
                    (this.detail.cache_key || this.detail.artwork_key)
                      ? html`<div class="database-preview">
                            <kaleidescape-library-cover
                              .client=${this.client}
                              .scope=${this.scope}
                              .queue=${this.covers}
                              .artworkKey=${String(this.detail.cache_key ?? this.detail.artwork_key)}
                              .title=${String(this.detail.title ?? "Database artwork")}
                            ></kaleidescape-library-cover>
                          </div>
                          ${!this.scope?.library_enabled ? html`<small>Enable Library to preview cached artwork.</small>` : nothing}`
                      : nothing
                  }
                  <div class="database-relationships">
                    <section
                      class="database-references"
                      aria-label="References"
                    >
                      <h3>References</h3>
                      ${(() => {
                        const refs = (this.page?.references ?? []).filter(
                          (ref) =>
                            Object.values(ref.key).every(
                              (key) => this.detail?.[key] != null,
                            ),
                        );
                        return refs.length
                          ? html`<ul>
                              ${refs.map(
                                (ref) =>
                                  html`<li>
                                    <button
                                      class="link"
                                      ?disabled=${this.blocked}
                                      @click=${() => this.follow(ref)}
                                    >
                                      ${this.referenceText(
                                        ref.table,
                                        Object.values(ref.key).map(
                                          (key) => this.detail![key],
                                        ),
                                      )}
                                    </button>
                                  </li>`,
                              )}
                            </ul>`
                          : html`<small>None</small>`;
                      })()}
                    </section>
                    <section
                      class="database-references"
                      aria-label="Referenced by"
                    >
                      <h3>Referenced by</h3>
                      ${
                        this.referenceLoading
                          ? html`<small role="status">Loading…</small>`
                          : this.referenceError
                            ? html`<small class="error" role="alert"
                                  >${this.referenceError}</small
                                ><button
                                  class="link"
                                  @click=${() => this.detail && this.loadReferencedBy(this.detail)}
                                >
                                  Retry
                                </button>`
                            : this.referencedBy.length
                              ? html`<ul>
                                  ${this.referencedBy.map(
                                    (group) =>
                                      html`${group.items.map((key) => html`<li><button class="link" ?disabled=${this.blocked} @click=${() => this.followValues(group.table, key)}>${this.referenceText(group.table, Object.values(key))}</button></li>`)}${
                                        group.more
                                          ? html`<li>
                                              <button
                                                class="link"
                                                ?disabled=${this.blocked}
                                                @click=${() => this.follow(group)}
                                              >
                                                View all
                                                ${LABELS[group.table] ?? group.table}
                                              </button>
                                            </li>`
                                          : nothing
                                      }`,
                                  )}
                                </ul>`
                              : html`<small>None</small>`
                      }
                    </section>
                  </div>
                  <pre>${JSON.stringify(this.detail, null, 2)}</pre>
                  ${
                    this.repairing &&
                    ["purchase_records", "purchase_repair_events"].includes(
                      this.table,
                    )
                      ? html`<kaleidescape-purchase-repair
                          .client=${this.client}
                          .scope=${this.scope}
                          .row=${this.detail}
                          .token=${this.rowSelection(this.detail).token}
                          .reverse=${this.table === "purchase_repair_events"}
                          .editOnly=${this.table === "purchase_records"}
                          @repair-cancel=${() => {
                            this.repairing = false;
                            this.requestUpdate();
                          }}
                          @repair-busy=${(event: CustomEvent<boolean>) => {
                            this.repairPending = event.detail;
                            this.busy();
                          }}
                          @repair-complete=${() => {
                            this.repairing = false;
                            this.repairPending = false;
                            this.busy();
                            this.detail = undefined;
                            this.notice = "Purchase repair applied.";
                            this.dispatchEvent(
                              new CustomEvent("database-changed", {
                                bubbles: true,
                                composed: true,
                              }),
                            );
                            void this.load();
                          }}
                          @access-denied=${() => this.fail({ code: "unauthorized" })}
                        ></kaleidescape-purchase-repair>`
                      : nothing
                  }
                  ${!editable && this.table !== "purchase_records" ? html`<p class="muted">This table protects system integrity; stored values are read-only.</p>` : nothing}`
              : html`<p class="empty">
                  Select an entry to inspect raw values.
                </p>`
          }
        </section>
      </div>
      <footer class="entries-footer">
        <span
          >${LABELS[this.table] ?? this.table} · ${this.page?.total ?? 0} total
          · Revision ${this.page?.dataset_revision ?? 0}</span
        >
        ${
          this.page
            ? html`<div class="pagination database-pagination">
                <small
                  >${this.allMode ? `${this.page.items.length} of ${this.page.total} rows loaded` : `${this.page.items.length === 1 ? "Row" : "Rows"} ${this.page.items.length ? this.page.offset + 1 : 0}–${this.page.offset + this.page.items.length} of ${this.page.total}`}
                  · ${this.selected.size} selected (maximum 100)</small
                >
                ${
                  !this.allMode
                    ? html`<div class="actions">
                        <button
                          ?disabled=${this.blocked || !this.page.offset}
                          @click=${() => this.load()}
                        >
                          First</button
                        ><button
                          ?disabled=${this.blocked || !this.page.offset}
                          @click=${() => this.load(Math.max(0, this.page!.offset - this.page!.limit), this.page!.revision)}
                        >
                          Previous</button
                        ><button
                          ?disabled=${this.blocked || !this.page.has_more}
                          @click=${() => this.load(this.page!.offset + this.page!.limit, this.page!.revision)}
                        >
                          Next
                        </button>
                      </div>`
                    : nothing
                }
              </div>`
            : nothing
        }
      </footer>
      ${this.options()}
      <dialog
        id="database-edit"
        class="database-dialog"
        @click=${dismissBackdrop}
        @cancel=${this.close}
      >
        <div class="card-head">
          <h2>
            ${this.operation === "new" ? "New viewing" : "Edit database entry"}
          </h2>
          ${closeButton((event) => this.close(event))}
        </div>
        <p class="warning">
          Only supported fields can change. Source metadata may be restored by a
          later sync. Open playback sessions and their viewings are protected
          until closed. Session corrections do not recalculate viewing
          summaries.
        </p>
        ${this.error ? html`<p class="error">${this.error}</p>` : nothing}${this.retry()}
        <form @submit=${this.save}>
          <fieldset ?disabled=${this.saving || !!this.pending}>
            ${
              this.operation === "new"
                ? html`<kaleidescape-manual-viewing
                    .fuzzySearch=${this.fuzzySearch}
                    .client=${this.client}
                    .scope=${this.scope}
                    .draft=${this.createDraft}
                    .disabled=${this.saving || !!this.pending}
                    @draft-change=${(event: CustomEvent) => {
                      this.createDraft = event.detail;
                      this.requestUpdate();
                    }}
                    @access-denied=${() => this.fail(new ApiError("unauthorized"))}
                  ></kaleidescape-manual-viewing>`
                : (this.page?.schema ?? [])
                    .filter((field) => field.editable)
                    .map(
                      (field) =>
                        html`<div class="database-edit-field">
                          <label
                            >${field.name}${
                              field.type === "json" || field.name === "notes"
                                ? html`<textarea
                                    name=${field.name}
                                    .value=${this.nulls.has(field.name) ? "" : (this.draft[field.name] ?? "")}
                                    placeholder=${this.nulls.has(field.name) ? "NULL · type to set a value" : ""}
                                    @input=${(event: Event) => {
                                      this.nulls.delete(field.name);
                                      this.requestUpdate();
                                      this.draft = {
                                        ...this.draft,
                                        [field.name]: (
                                          event.target as HTMLTextAreaElement
                                        ).value,
                                      };
                                    }}
                                  ></textarea>`
                                : html`<input
                                    name=${field.name}
                                    type=${field.type === "number" ? "number" : "text"}
                                    step="any"
                                    .value=${this.nulls.has(field.name) ? "" : (this.draft[field.name] ?? "")}
                                    placeholder=${this.nulls.has(field.name) ? "NULL · type to set a value" : ""}
                                    @input=${(event: Event) => {
                                      this.nulls.delete(field.name);
                                      this.requestUpdate();
                                      this.draft = {
                                        ...this.draft,
                                        [field.name]: (
                                          event.target as HTMLInputElement
                                        ).value,
                                      };
                                    }}
                                  />`
                            }</label
                          >${
                            field.nullable
                              ? html`<label class="check"
                                  ><input
                                    type="checkbox"
                                    aria-label=${`Set ${field.name} to NULL`}
                                    .checked=${this.nulls.has(field.name)}
                                    @change=${(event: Event) => {
                                      if (
                                        (event.target as HTMLInputElement)
                                          .checked
                                      )
                                        this.nulls.add(field.name);
                                      else this.nulls.delete(field.name);
                                      this.requestUpdate();
                                    }}
                                  />NULL</label
                                >`
                              : nothing
                          }
                        </div>`,
                    )
            }<label class="check"
              ><input
                name="confirm_edit"
                type="checkbox"
                .checked=${this.confirmed}
                @change=${(event: Event) => {
                  this.confirmed = (event.target as HTMLInputElement).checked;
                  this.requestUpdate();
                }}
              />I reviewed these changes and confirm saving.</label
            >
          </fieldset>
          <div class="dialog-footer">
            <button
              type="submit"
              class="primary"
              ?disabled=${!this.confirmed || this.saving || !!this.pending}
            >
              Save changes
            </button>
          </div>
        </form>
      </dialog>
      <dialog
        id="database-delete"
        class="database-dialog"
        @click=${dismissBackdrop}
        @cancel=${this.close}
      >
        <div class="card-head">
          <h2>
            Permanently delete
            ${counted(this.selectedRows().length, "entry", "entries")}?
          </h2>
          ${closeButton((event) => this.close(event))}
        </div>
        <p>
          Database deletion is permanent. Associated memberships/session
          references may also be removed, and artwork references cleared. Source
          sync may recreate cached library records. Existing exports and backups
          remain.
        </p>
        ${this.error ? html`<p class="error">${this.error}</p>` : nothing}${this.retry()}<label
          >Type DELETE to confirm<input
            name="delete_confirmation"
            .value=${this.deleteWord}
            ?disabled=${!!this.pending || this.saving}
            @input=${(event: Event) => {
              this.deleteWord = (event.target as HTMLInputElement).value;
              this.requestUpdate();
            }}
        /></label>
        <div class="dialog-footer">
          <button
            class="danger"
            ?disabled=${this.deleteWord !== "DELETE" || this.saving || !!this.pending}
            @click=${() => this.save()}
          >
            Confirm delete
          </button>
        </div>
      </dialog>
    </section>`;
  }
}
if (!customElements.get("kaleidescape-database"))
  customElements.define("kaleidescape-database", KaleidescapeDatabase);
