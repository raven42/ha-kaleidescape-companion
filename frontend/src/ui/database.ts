/** Schema-guided administrator inspection with confirmed, revision-bound writes. */
import { counted } from "../core/text";
import { LitElement, html, nothing } from "lit";
import type { PropertyValues } from "lit";
import { ApiError, errorCode, errorMessage } from "../core/api";
import type {
  DatabasePage,
  DatabaseQuery,
  JournalClient,
  JournalInfo,
  PreparedMutation,
} from "../core/api";
import { styles } from "./styles";
import { databaseStyles } from "./database.styles";
import { entryLayoutStyles } from "./entry-layout.styles";
import { PreferenceStore } from "./preference-store";
import { dismissBackdrop } from "./dialog";
import { manualDraft, manualData } from "./manual-viewing";
import "./database-query";
import "./transfers";
import "../library/cover";
import { CoverQueue } from "../library/cover";

const LABELS: Record<string, string> = {
  viewings: "Viewings",
  sessions: "Sessions",
  library_titles: "Library titles",
  library_collections: "Library collections",
  library_sources: "Library sources",
  library_artwork: "Library artwork",
  settings: "UI settings",
  library_memberships: "Library memberships",
  requests: "Write requests",
  schema_metadata: "Metadata",
  manual_audit: "Manual audit",
  maintenance_audit: "Maintenance audit",
  import_audit: "Import audit",
  database_audit: "Database audit",
  library_collection_intents: "Collection add receipts",
  calendar_publications: "Calendar publications",
  calendar_sync_jobs: "Calendar exports",
  calendar_sync_items: "Calendar export items",
};
const MAIN = ["viewings", "sessions", "library_titles"];
type Row = Record<string, unknown>;
export class KaleidescapeDatabase extends LitElement {
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
  private request = 0;
  private page?: DatabasePage;
  private table = "viewings";
  private filters: DatabaseQuery = { limit: 25, query: "", descending: false };
  private showSystem = false;
  private sorts: Record<string, { sort: string; descending: boolean }> = {};
  private preferences?: PreferenceStore;
  private ready = false;
  private preferenceError = "";
  private loading = false;
  private saving = false;
  private transferBusy = false;
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
    if (key === this.bound && this.client === this.boundClient) return;
    this.clear();
    this.bound = key;
    this.boundClient = this.client;
    if (this.client && this.scope?.permissions.edit) void this.initialize();
  }
  connectedCallback() {
    super.connectedCallback();
    this.requestUpdate("client");
    this.requestUpdate("scope");
  }
  disconnectedCallback() {
    super.disconnectedCallback();
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
    this.ready = false;
    this.page = undefined;
    this.table = "viewings";
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
    this.loading = this.saving = this.transferBusy = false;
    this.error = this.notice = this.preferenceError = "";
    for (const dialog of this.renderRoot.querySelectorAll("dialog"))
      dialog.close();
    this.busy();
    this.requestUpdate();
  }
  private async initialize() {
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
      this.filters.limit = values.limit as number;
      this.showSystem = values.show_system as boolean;
      this.sorts = (values.sorts ?? {}) as typeof this.sorts;
      this.table = String(values.table ?? "viewings");
      if (!this.showSystem && !MAIN.includes(this.table))
        this.table = "viewings";
      this.filters = { ...this.filters, ...this.sorts[this.table] };
      this.ready = true;
      await this.load();
    } catch (error) {
      if (generation === this.generation) this.fail(error);
    }
  }
  protected updated() {
    for (const [name, value] of [
      ["database_limit", String(this.filters.limit)],
      ["database_sort", this.filters.sort ?? this.page?.columns[0] ?? ""],
    ]) {
      const input = this.renderRoot.querySelector<HTMLSelectElement>(
        `[name="${name}"]`,
      );
      if (input && input.value !== value) input.value = value;
    }
  }
  private get blocked() {
    return this.loading || this.saving || !!this.pending || this.transferBusy;
  }
  private busy() {
    this.dispatchEvent(
      new CustomEvent("maintenance-busy", {
        detail: this.saving || !!this.pending || this.transferBusy,
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
  private async load(offset = 0, revision?: number) {
    if (!this.client || !this.scope || !this.ready || this.pending) return;
    const generation = this.generation,
      request = ++this.request;
    this.loading = true;
    if (this.page?.table !== this.table) this.page = undefined;
    this.error = "";
    this.detail = undefined;
    this.selected.clear();
    this.requestUpdate();
    try {
      const page = await this.client.inspect(
        this.scope,
        this.table,
        offset,
        revision,
        this.filters,
      );
      if (generation !== this.generation || request !== this.request) return;
      this.page = page;
      this.filters.sort = page.sort;
    } catch (error) {
      if (generation === this.generation && request === this.request)
        this.fail(error);
    } finally {
      if (generation === this.generation && request === this.request) {
        this.loading = false;
        this.requestUpdate();
      }
    }
  }
  private async follow(
    reference: NonNullable<DatabasePage["references"]>[number],
  ) {
    if (
      this.blocked ||
      !this.detail ||
      !this.page?.tables ||
      !(reference.table in this.page.tables)
    )
      return;
    const clauses = [];
    for (const [field, local] of Object.entries(reference.key)) {
      const value = this.detail[local];
      if (
        value == null ||
        !/^[a-z_]+$/.test(field) ||
        !["string", "number"].includes(typeof value)
      )
        return;
      clauses.push(
        `${field} = ${typeof value === "number" ? value : `'${String(value).replaceAll("'", "''")}'`}`,
      );
    }
    if (!MAIN.includes(reference.table)) {
      this.showSystem = true;
      this.preferences?.set({ show_system: true });
    }
    this.table = reference.table;
    this.search = `WHERE ${clauses.join(" AND ")}`;
    this.filters = {
      limit: this.filters.limit,
      query: this.search,
      ...this.sorts[this.table],
    };
    this.preferences?.set({ table: this.table });
    const generation = this.generation;
    const table = this.table;
    await this.load();
    if (generation !== this.generation || table !== this.table) return;
    if (this.page?.items[0]) this.showDetail(this.page.items[0]);
    else this.notice = "The referenced entry no longer exists.";
    this.requestUpdate();
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
  private showDetail(row: Row) {
    this.detail = row;
    this.requestUpdate();
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
      !this.transferBusy && !this.saving && !this.pending && this.discard()
    );
  }
  private close(event?: Event) {
    event?.preventDefault();
    if (!this.discard()) return;
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
      const generation = this.generation;
      this.saving = true;
      this.error = "";
      this.busy();
      this.requestUpdate();
      try {
        if (this.operation === "new") await this.client.mutate(this.pending);
        else await this.client.databaseMutation(this.pending);
        if (generation !== this.generation) return;
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
        if (generation !== this.generation) return;
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
        if (generation === this.generation) {
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
        <button
          @click=${() => this.renderRoot.querySelector<HTMLDialogElement>("#database-options")?.close()}
        >
          Done
        </button>
      </div>
      <p>View choices save automatically for your HA user.</p>
      <fieldset ?disabled=${this.blocked}>
        <label
          >Rows per page<select
            name="database_limit"
            .value=${String(this.filters.limit)}
            @change=${(event: Event) => this.browse({ limit: Number((event.target as HTMLSelectElement).value) })}
          >
            ${[10, 25, 100, 500].map((count) => html`<option value=${count}>${count}</option>`)}
          </select></label
        ><label class="check"
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
    const tables = Object.keys(this.page?.tables ?? LABELS).filter(
      (table) => this.showSystem || MAIN.includes(table),
    );
    const editable = (this.page?.schema ?? []).some((field) => field.editable);
    return html`<section class="card database" aria-label="Database management">
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
        ${tables.map((table) => html`<button role="tab" id=${`table-${table}`} aria-selected=${this.table === table} tabindex=${this.table === table ? 0 : -1} ?disabled=${this.blocked} @click=${() => this.changeTable(table)}>${LABELS[table] ?? table}${this.page ? ` (${this.page.tables[table]})` : ""}</button>`)}
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
      <div class="entries-layout">
        <section
          class="database-entries entries-list"
          aria-label="Database entries"
        >
          <div class="card-head">
            <h2>${LABELS[this.table] ?? this.table}</h2>
          </div>
          ${this.loading ? html`<p role="status">Loading database…</p>` : nothing}
          <ul class="entry-list">
            ${this.page?.items.map(
              (row, index) =>
                html`<li class=${this.detail === row ? "selected" : ""}>
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
                    ?disabled=${this.blocked}
                    @click=${() => this.showDetail(row)}
                  >
                    ${String(row.title ?? row.name ?? row.id ?? row.cache_key ?? row.owner ?? row.request_id ?? "Dataset metadata")}
                  </button>
                </li>`,
            )}
          </ul>
          ${
            this.page
              ? html`<div class="pagination database-pagination">
                  <small
                    >${this.page.items.length === 1 ? "Row" : "Rows"}
                    ${this.page.items.length ? this.page.offset + 1 : 0}–${this.page.offset + this.page.items.length}
                    of ${this.page.total} · ${this.selected.size} selected
                    (maximum 100)</small
                  >
                  <div class="actions">
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
                  </div>
                </div>`
              : nothing
          }
        </section>
        <section
          class="database-detail entries-detail"
          aria-label="Selected database entry"
        >
          <div class="card-head">
            <h2>Entry details</h2>
            ${this.detail ? html`<button ?disabled=${this.blocked || !editable} @click=${this.edit}>Edit entry</button>` : nothing}
          </div>
          ${
            this.detail
              ? html`${
                    (this.table === "library_artwork" ||
                      this.table === "library_titles") &&
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
                  <div class="database-references">
                    ${(this.page?.references ?? []).filter((ref) => Object.values(ref.key).every((key) => this.detail?.[key] != null)).map((ref) => html`<button class="link" ?disabled=${this.blocked} @click=${() => this.follow(ref)}>Open ${LABELS[ref.table] ?? ref.table} · ${Object.values(ref.key).join(", ")}</button>`)}
                  </div>
                  <pre>${JSON.stringify(this.detail, null, 2)}</pre>
                  ${!editable ? html`<p class="muted">This table protects system integrity; stored values are read-only.</p>` : nothing}`
              : html`<p class="empty">
                  Select an entry to inspect raw values.
                </p>`
          }
        </section>
      </div>
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
              type="button"
              ?disabled=${this.saving || !!this.pending}
              @click=${this.close}
            >
              Cancel edit</button
            ><button
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
        <h2>
          Permanently delete
          ${counted(this.selectedRows().length, "entry", "entries")}?
        </h2>
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
            Confirm delete</button
          ><button
            ?disabled=${this.saving || !!this.pending}
            @click=${this.close}
          >
            Cancel delete
          </button>
        </div>
      </dialog>
    </section>`;
  }
}
if (!customElements.get("kaleidescape-database"))
  customElements.define("kaleidescape-database", KaleidescapeDatabase);
