/** Administrator raw inspection and explicitly confirmed permanent purging. */
import { LitElement, html, nothing } from "lit";
import type { PropertyValues } from "lit";
import { errorCode, errorMessage } from "./api";
import type {
  DatabasePage,
  DatabaseQuery,
  JournalClient,
  JournalInfo,
  PreparedMutation,
  Viewing,
} from "./api";
import { draftData, draftFrom, renderDraftFields } from "./editor";
import type { Draft } from "./editor";
import "./transfers";
import { styles } from "./styles";
import { dismissBackdrop } from "./dialog";

const TABLE_LABELS: Record<string, string> = {
  viewings: "Viewings",
  sessions: "Sessions",
  requests: "Write requests",
  manual_audit: "Manual audit",
  maintenance_audit: "Maintenance audit",
  import_audit: "Import audit",
  schema_metadata: "Metadata",
  library_sources: "Library sources",
  library_titles: "Library titles",
  library_collections: "Library collections",
  library_memberships: "Library memberships",
  library_artwork: "Library artwork",
  library_purchase_dates: "Purchase dates",
  library_purchase_audit: "Purchase date audit",
  library_collection_intents: "Collection add requests",
};

export class KaleidescapeAdvanced extends LitElement {
  static properties = {
    client: { attribute: false },
    scope: { attribute: false },
  };
  static styles = styles;
  client?: JournalClient;
  scope?: JournalInfo;
  private boundClient?: JournalClient;
  private bound = "";
  private generation = 0;
  private page?: DatabasePage;
  private table = "viewings";
  private filters: DatabaseQuery = { limit: 25, query: "", descending: false };
  private search = "";
  private columns: string[] = [];
  private selected = new Set<string>();
  private confirming: "selected" | "all" | null = null;
  private confirmation = "";
  private purgeOpen = false;
  private pending?: PreparedMutation;
  private editPending?: PreparedMutation;
  private transferBusy = false;
  private detail: Record<string, unknown> | null = null;
  private draft: Draft | null = null;
  private initial: Draft | null = null;
  private loading = false;
  private saving = false;
  private error = "";
  private notice = "";
  protected willUpdate(changed: PropertyValues) {
    if (!changed.has("client") && !changed.has("scope")) return;
    const key = `${this.scope?.entry_id}:${this.scope?.dataset_id}`;
    if (key === this.bound && this.client === this.boundClient) return;
    this.clear();
    this.bound = key;
    this.boundClient = this.client;
    if (this.client && this.scope) void this.load();
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    this.clear();
    this.bound = "";
    this.boundClient = undefined;
  }
  connectedCallback() {
    super.connectedCallback();
    this.requestUpdate("client");
    this.requestUpdate("scope");
  }
  private clear() {
    this.generation++;
    this.page = undefined;
    this.table = "viewings";
    this.filters = { limit: 25, query: "", descending: false };
    this.search = "";
    this.columns = [];
    this.selected.clear();
    this.confirming = null;
    this.hidePurge();
    this.confirmation = this.error = this.notice = "";
    this.pending = this.editPending = undefined;
    this.detail = this.draft = this.initial = null;
    this.transferBusy = false;
    this.loading = this.saving = false;
    this.busy();
  }
  private hidePurge() {
    this.renderRoot.querySelector<HTMLDialogElement>("#purge-dialog")?.close();
    this.purgeOpen = false;
  }
  private async openPurge() {
    if (
      this.blocked ||
      this.table !== "viewings" ||
      this.scope?.tracking_enabled ||
      !this.discard()
    )
      return;
    const generation = this.generation;
    this.confirming = null;
    this.confirmation = "";
    this.detail = this.draft = this.initial = null;
    this.purgeOpen = true;
    this.requestUpdate();
    await this.updateComplete;
    if (generation === this.generation && this.isConnected)
      this.renderRoot
        .querySelector<HTMLDialogElement>("#purge-dialog")
        ?.showModal();
  }
  private closePurge(event?: Event) {
    event?.preventDefault();
    if (this.saving || this.pending) return;
    this.hidePurge();
    this.confirming = null;
    this.confirmation = "";
    this.requestUpdate();
    this.renderRoot.querySelector<HTMLButtonElement>("#purge-entry")?.focus();
  }
  private get blocked() {
    return (
      this.loading ||
      this.saving ||
      !!this.pending ||
      !!this.editPending ||
      this.transferBusy
    );
  }
  private busy() {
    this.dispatchEvent(
      new CustomEvent("maintenance-busy", {
        detail:
          !!this.pending ||
          !!this.editPending ||
          this.saving ||
          this.transferBusy,
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
    this.error = errorMessage(error);
    this.requestUpdate();
  }
  private async load(offset = 0, revision?: number) {
    if (
      !this.client ||
      !this.scope ||
      this.pending ||
      this.editPending ||
      !this.discard()
    )
      return;
    const generation = ++this.generation;
    this.loading = true;
    this.error = "";
    this.selected.clear();
    this.confirming = null;
    this.confirmation = "";
    this.page = undefined;
    this.detail = this.draft = this.initial = null;
    this.requestUpdate();
    try {
      const page = await this.client.inspect(
        this.scope,
        this.table,
        offset,
        revision,
        this.filters,
      );
      if (generation === this.generation) {
        this.page = page;
        this.columns = page.columns;
        this.filters.sort = page.sort;
      }
    } catch (error) {
      if (generation === this.generation) this.fail(error);
    } finally {
      if (generation === this.generation) {
        this.loading = false;
        this.requestUpdate();
      }
    }
  }
  private async purge(event?: Event) {
    event?.preventDefault();
    if (!this.client || !this.scope || this.saving) return;
    try {
      if (!this.pending) {
        if (
          !this.page ||
          !this.confirming ||
          this.scope.tracking_enabled ||
          (this.confirming === "selected" && !this.selected.size)
        )
          return;
        const all = this.confirming === "all";
        if (this.confirmation !== (all ? "PURGE ALL" : "PURGE")) return;
        if (!this.discard()) return;
        this.detail = this.draft = this.initial = null;
        this.pending = this.client.preparePurge(this.scope, {
          viewing_ids: all ? [] : [...this.selected],
          all,
          expected_revision: this.page.revision,
          confirmation: this.confirmation,
        });
      }
      const generation = this.generation;
      this.saving = true;
      this.error = this.notice = "";
      this.busy();
      this.requestUpdate();
      try {
        const result = await this.client.purge(this.pending);
        if (generation !== this.generation) return;
        this.pending = undefined;
        this.hidePurge();
        this.notice = `Permanently purged ${result.purged_count} entries. Backups and exports were not changed.`;
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
            "unauthorized",
            "invalid_request",
            "conflict",
            "not_found",
            "tracking_enabled",
          ].includes(errorCode(error))
        )
          this.pending = undefined;
        this.fail(error);
      } finally {
        if (generation === this.generation || !this.pending) {
          this.saving = false;
          this.busy();
          this.requestUpdate();
        }
      }
    } catch (error) {
      this.fail(error);
    }
  }
  private discardRetry() {
    if (
      this.saving ||
      !window.confirm(
        "The purge may already have committed. Discard its retry and refresh the database to inspect the result?",
      )
    )
      return;
    this.pending = undefined;
    this.hidePurge();
    this.busy();
    void this.load();
  }
  private discard() {
    return (
      !this.draft ||
      JSON.stringify(this.draft) === JSON.stringify(this.initial) ||
      window.confirm("Discard your unsaved changes?")
    );
  }
  confirmNavigation() {
    return this.discard();
  }
  private showDetail(row: Record<string, unknown>) {
    if (!this.discard()) return;
    this.detail = row;
    this.draft =
      this.table === "viewings" ? draftFrom(row as unknown as Viewing) : null;
    this.initial = this.draft ? { ...this.draft } : null;
    this.requestUpdate();
  }
  private newEntry() {
    if (
      this.table !== "viewings" ||
      this.loading ||
      this.saving ||
      this.pending ||
      this.editPending ||
      this.transferBusy ||
      !this.discard()
    )
      return;
    this.detail = null;
    this.draft = draftFrom();
    this.initial = { ...this.draft };
    this.error = this.notice = "";
    this.requestUpdate();
    void this.updateComplete.then(() =>
      this.renderRoot.querySelector<HTMLInputElement>("#title")?.focus(),
    );
  }
  private async saveDetail(event?: Event) {
    event?.preventDefault();
    if (
      !this.client ||
      !this.scope ||
      !this.draft ||
      !this.initial ||
      this.saving ||
      this.pending ||
      this.transferBusy
    )
      return;
    if (event && !(event.target as HTMLFormElement).reportValidity()) return;
    try {
      if (!this.editPending) {
        const patch = draftData(
          this.draft,
          this.detail ? this.initial : undefined,
        );
        if (!Object.keys(patch).length) {
          this.notice = "There are no changes to save.";
          this.requestUpdate();
          return;
        }
        this.editPending = this.detail
          ? this.client.prepareDatabaseUpdate(this.scope, {
              viewing_id: this.detail.id,
              expected_revision: this.detail.revision,
              patch,
            })
          : this.client.prepare(this.scope, "create", { data: patch });
      }
      await this.mutateDetail();
    } catch (error) {
      this.fail(error);
    }
  }
  private async deleteEntry() {
    if (
      !this.client ||
      !this.scope ||
      this.blocked ||
      this.table !== "viewings" ||
      this.selected.size !== 1
    )
      return;
    const row = this.page?.items.find((row) =>
      this.selected.has(String(row.id)),
    );
    if (
      !row ||
      row.deleted_at ||
      !this.discard() ||
      !window.confirm(
        `Delete “${String(row.title)}” from the journal? Its database record will be retained.`,
      )
    )
      return;
    try {
      this.editPending = this.client.prepare(this.scope, "delete", {
        viewing_id: row.id,
        expected_revision: row.revision,
      });
      this.detail = this.draft = this.initial = null;
      await this.mutateDetail();
    } catch (error) {
      this.fail(error);
    }
  }
  private async mutateDetail() {
    if (!this.client || !this.editPending || this.saving) return;
    const deleting = this.editPending.message.type.endsWith("/delete");
    const generation = this.generation;
    this.saving = true;
    this.error = this.notice = "";
    this.busy();
    this.requestUpdate();
    try {
      const result = await this.client.mutate(this.editPending);
      if (generation !== this.generation) return;
      this.editPending = undefined;
      this.detail = this.draft = this.initial = null;
      this.notice = deleting
        ? "Viewing deleted from the journal. Its database record is retained."
        : "Viewing saved.";
      this.dispatchEvent(
        new CustomEvent("database-changed", {
          bubbles: true,
          composed: true,
        }),
      );
      const refreshGeneration = this.generation + 1;
      await this.load();
      if (
        this.generation !== refreshGeneration ||
        !this.isConnected ||
        deleting
      )
        return;
      const row = this.page?.items.find((row) => row.id === result.viewing.id);
      this.showDetail(
        row ?? (result.viewing as unknown as Record<string, unknown>),
      );
    } catch (error) {
      if (generation !== this.generation) return;
      if (
        ["invalid_request", "conflict", "unauthorized", "not_found"].includes(
          errorCode(error),
        )
      )
        this.editPending = undefined;
      this.fail(error);
    } finally {
      if (generation === this.generation || !this.editPending) {
        this.saving = false;
        this.busy();
        this.requestUpdate();
      }
    }
  }
  private renderMutationRetry() {
    return this.editPending
      ? html`<div class="warning" role="status">
          ${this.saving ? "Saving…" : "The change result is unconfirmed. Retry the exact change."}
          <div class="actions">
            <button
              ?disabled=${this.saving}
              @click=${() => this.mutateDetail()}
            >
              Retry same change
            </button>
            <button
              ?disabled=${this.saving}
              @click=${() => {
                if (
                  window.confirm(
                    "This change may already have committed. Discard its retry and reload the database?",
                  )
                ) {
                  this.editPending = undefined;
                  this.draft = this.initial = null;
                  this.busy();
                  void this.load();
                }
              }}
            >
              Discard retry & reload
            </button>
          </div>
        </div>`
      : nothing;
  }
  private renderDetail(blocked: boolean) {
    if (!this.detail && !this.draft)
      return html`<div class="empty">
        Select an entry to inspect its details.
      </div>`;
    return html`<div class="card-head">
        <h2>
          ${this.draft ? (this.detail ? "Edit viewing" : "New viewing") : "Entry details"}
        </h2>
      </div>
      ${
        this.draft
          ? html`<form class="editor" @submit=${this.saveDetail}>
              <fieldset ?disabled=${blocked}>
                ${renderDraftFields(this.draft, (key, event) => {
                  this.draft = {
                    ...this.draft!,
                    [key]: (event.target as HTMLInputElement).value,
                  };
                  this.requestUpdate();
                })}
                <p class="muted">
                  Only changed viewing fields are corrected. Deletion status and
                  recorded session evidence are preserved.
                </p>
                <div class="actions">
                  <button type="submit" class="primary">
                    ${this.detail ? "Save viewing" : "Create entry"}</button
                  ><button
                    type="button"
                    @click=${() => {
                      if (this.discard()) {
                        this.detail = this.draft = this.initial = null;
                        this.requestUpdate();
                      }
                    }}
                  >
                    Close details
                  </button>
                </div>
              </fieldset>
            </form>`
          : html`<p class="muted">
              System metadata, evidence, retry, and audit records are read-only.
            </p>`
      }
      ${
        this.detail
          ? html`<h3>Raw stored values</h3>
              <pre>${JSON.stringify(this.detail, null, 2)}</pre>`
          : nothing
      }`;
  }
  private switchTable(table: string) {
    if (this.blocked) return;
    if (!this.discard()) return;
    this.table = table;
    this.filters = { limit: this.filters.limit, query: "", descending: false };
    this.search = "";
    this.columns = [];
    this.draft = this.initial = null;
    void this.load();
  }
  private browse(change: Partial<DatabaseQuery>) {
    if (this.blocked || !this.discard()) return false;
    this.filters = { ...this.filters, ...change };
    this.draft = this.initial = null;
    void this.load();
    return true;
  }
  private tabKey(event: KeyboardEvent, tables: string[]) {
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
    if (next < 0) return;
    event.preventDefault();
    this.switchTable(tables[next]);
    void this.updateComplete.then(() =>
      this.renderRoot
        .querySelector<HTMLButtonElement>(`#table-${this.table}`)
        ?.focus(),
    );
  }
  protected render() {
    const blocked = this.blocked;
    const tables = Object.keys(this.page?.tables ?? TABLE_LABELS);
    const selectedRow =
      this.selected.size === 1
        ? this.page?.items.find((row) => this.selected.has(String(row.id)))
        : undefined;
    const viewings = this.table === "viewings";
    return html`<section class="card database" aria-label="Database management">
      <div class="database-toolbar">
        <div class="actions" aria-label="Entry actions">
          <button
            class="primary"
            ?disabled=${blocked || !viewings}
            @click=${this.newEntry}
          >
            New Entry
          </button>
          <button
            class="danger"
            ?disabled=${blocked || !viewings || !selectedRow || !!selectedRow.deleted_at}
            @click=${this.deleteEntry}
          >
            Delete entry
          </button>
          <button
            id="purge-entry"
            class="danger"
            ?disabled=${blocked || !viewings || !!this.scope?.tracking_enabled || !this.page?.tables.viewings}
            @click=${this.openPurge}
          >
            Purge entry
          </button>
          <button ?disabled=${blocked} @click=${() => this.load()}>
            Refresh database
          </button>
        </div>
        <kaleidescape-transfers
          .client=${this.client}
          .scope=${this.scope ? { ...this.scope, revision: this.page?.revision ?? this.scope.revision } : undefined}
          .disabled=${this.loading || this.saving || !!this.pending || !!this.editPending || this.purgeOpen}
          @transfer-open=${(event: CustomEvent<string>) => {
            if (event.detail !== "import") return;
            if (!this.discard()) {
              event.preventDefault();
              return;
            }
            this.detail = this.draft = this.initial = null;
            this.requestUpdate();
          }}
          @transfer-busy=${(event: CustomEvent<boolean>) => {
            this.transferBusy = event.detail;
            this.busy();
            this.requestUpdate();
          }}
          @database-changed=${() => {
            if (!this.pending && !this.editPending) void this.load();
          }}
        ></kaleidescape-transfers>
      </div>
      <div class="database-messages">
        ${this.error ? html`<p class="error" role="alert">${this.error}</p>` : nothing}
        ${this.notice ? html`<p class="notice" role="status">${this.notice}</p>` : nothing}
        ${this.renderMutationRetry()}
      </div>
      <div
        class="page-tabs table-tabs"
        role="tablist"
        aria-label="Database tables"
        @keydown=${(event: KeyboardEvent) => {
          if (!blocked) this.tabKey(event, tables);
        }}
      >
        ${tables.map(
          (table) =>
            html`<button
              role="tab"
              id=${`table-${table}`}
              aria-controls="database-rows"
              aria-selected=${this.table === table}
              tabindex=${this.table === table ? "0" : "-1"}
              ?disabled=${blocked}
              @click=${() => this.switchTable(table)}
            >
              ${TABLE_LABELS[table] ?? table}${this.page ? ` (${this.page.tables[table]})` : ""}
            </button>`,
        )}
      </div>
      <form
        class="filters database-filters"
        @submit=${(event: Event) => {
          event.preventDefault();
          this.browse({ query: this.search });
        }}
      >
        <label
          >Search rows
          <input
            name="database_query"
            maxlength="500"
            .value=${this.search}
            ?disabled=${blocked}
            @input=${(event: Event) => {
              this.search = (event.target as HTMLInputElement).value;
            }}
          />
        </label>
        <button type="submit" ?disabled=${blocked}>Search</button>
        <label
          >Rows per page
          <select
            name="database_limit"
            .value=${String(this.filters.limit)}
            ?disabled=${blocked}
            @change=${(event: Event) => {
              const control = event.target as HTMLSelectElement;
              if (!this.browse({ limit: Number(control.value) }))
                control.value = String(this.filters.limit);
            }}
          >
            ${[10, 25, 100, 500].map((count) => html`<option value=${count}>${count}</option>`)}
          </select>
        </label>
        <label
          >Sort by
          <select
            name="database_sort"
            .value=${this.filters.sort ?? this.columns[0] ?? ""}
            ?disabled=${blocked || !this.columns.length}
            @change=${(event: Event) => {
              const control = event.target as HTMLSelectElement;
              if (!this.browse({ sort: control.value }))
                control.value = this.filters.sort ?? this.columns[0] ?? "";
            }}
          >
            ${this.columns.map((column) => html`<option value=${column}>${column.replaceAll("_", " ")}</option>`)}
          </select>
        </label>
        <button
          type="button"
          ?disabled=${blocked}
          aria-label="Reverse database sort"
          @click=${() => this.browse({ descending: !this.filters.descending })}
        >
          ${this.filters.descending ? "Descending ↓" : "Ascending ↑"}
        </button>
      </form>
      <div
        class="database-layout"
        role="tabpanel"
        id="database-rows"
        aria-labelledby=${`table-${this.table}`}
      >
        <section class="database-entries" aria-label="Database entries">
          <div class="card-head">
            <h2>${TABLE_LABELS[this.table] ?? this.table}</h2>
          </div>
          ${
            this.loading
              ? html`<p role="status">Loading database…</p>`
              : this.page
                ? html` <p class="muted">
                      Schema ${this.scope?.schema_version} · Dataset revision
                      ${this.page.revision} · ${this.page.tables[this.table]}
                      rows
                    </p>
                    <ul class="entry-list">
                      ${this.page.items.map(
                        (row) =>
                          html`<li
                            class=${this.detail === row ? "selected" : ""}
                          >
                            ${
                              viewings
                                ? html`<input
                                    type="checkbox"
                                    aria-label=${`Select ${String(row.title)}`}
                                    ?disabled=${blocked || (this.selected.size >= 100 && !this.selected.has(String(row.id)))}
                                    .checked=${this.selected.has(String(row.id))}
                                    @change=${(event: Event) => {
                                      if (
                                        (event.target as HTMLInputElement)
                                          .checked
                                      ) {
                                        if (this.selected.size >= 100) return;
                                        this.selected.add(String(row.id));
                                      } else
                                        this.selected.delete(String(row.id));
                                      this.confirming = null;
                                      this.requestUpdate();
                                    }}
                                  />`
                                : nothing
                            }
                            <button
                              class="link entry-name"
                              ?disabled=${blocked}
                              @click=${() => this.showDetail(row)}
                            >
                              ${String(row.title ?? row.id ?? row.request_id ?? "Dataset metadata")}
                              ${viewings ? html`<small>${row.deleted_at ? "Deleted" : "Visible"}</small>` : nothing}
                            </button>
                          </li>`,
                      )}
                    </ul>
                    ${!this.page.items.length ? html`<p>No rows.</p>` : nothing}
                    <div class="pagination database-pagination">
                      <small
                        >Rows
                        ${this.page.items.length ? this.page.offset + 1 : 0}–${this.page.offset + this.page.items.length}
                        of ${this.page.total} · Up to ${this.page.limit}
                        rows${viewings ? ` · ${this.selected.size} selected (maximum 100)` : ""}</small
                      >
                      <div class="actions">
                        <button
                          ?disabled=${blocked || this.page.offset === 0}
                          @click=${() => this.load()}
                        >
                          First
                        </button>
                        <button
                          ?disabled=${blocked || this.page.offset === 0}
                          @click=${() => this.load(Math.max(0, this.page!.offset - this.page!.limit), this.page!.revision)}
                        >
                          Previous
                        </button>
                        <button
                          ?disabled=${blocked || !this.page.has_more}
                          @click=${() => this.load(this.page!.offset + this.page!.limit, this.page!.revision)}
                        >
                          Next
                        </button>
                      </div>
                    </div>`
                : nothing
          }
        </section>
        <section class="database-detail" aria-label="Selected database entry">
          ${this.renderDetail(blocked)}
        </section>
      </div>
      <dialog
        id="purge-dialog"
        @click=${dismissBackdrop}
        class="database-dialog"
        aria-labelledby="purge-title"
        @cancel=${this.closePurge}
      >
        <div class="card-head"><h2 id="purge-title">Permanent purge</h2></div>
        <p>
          Remove viewing entries and associated sessions, edit audit references,
          and cached response content. This cannot be undone here. Backups,
          exports, and HA Recorder history remain.
        </p>
        ${this.scope?.tracking_enabled ? html`<p class="warning">Disable automatic tracking in Settings before purging.</p>` : nothing}
        ${this.error ? html`<p class="error" role="alert">${this.error}</p>` : nothing}
        ${
          this.pending
            ? html`<div class="warning" role="status">
                ${this.saving ? "Purging…" : "The purge result is unconfirmed. Retry the exact request to confirm it."}
                <div class="actions">
                  <button ?disabled=${this.saving} @click=${() => this.purge()}>
                    Retry same purge
                  </button>
                  <button ?disabled=${this.saving} @click=${this.discardRetry}>
                    Discard retry & refresh
                  </button>
                </div>
              </div>`
            : nothing
        }
        <div class="actions">
          <button
            class="danger"
            ?disabled=${blocked || !!this.scope?.tracking_enabled || !this.selected.size}
            @click=${() => {
              this.confirming = "selected";
              this.confirmation = "";
              this.requestUpdate();
            }}
          >
            Purge selected (${this.selected.size})
          </button>
          <button
            class="danger"
            ?disabled=${blocked || !!this.scope?.tracking_enabled || !this.page?.tables.viewings}
            @click=${() => {
              this.confirming = "all";
              this.confirmation = "";
              this.requestUpdate();
            }}
          >
            Purge all entries
          </button>
        </div>
        ${
          this.confirming && !this.pending
            ? html`<form @submit=${this.purge}>
                <h3>
                  ${this.confirming === "all" ? "Permanently purge all entries?" : `Permanently purge ${this.selected.size} selected entries?`}
                </h3>
                <label
                  >Type ${this.confirming === "all" ? "PURGE ALL" : "PURGE"} to
                  confirm
                  <input
                    name="purge_confirmation"
                    autocomplete="off"
                    .value=${this.confirmation}
                    ?disabled=${blocked}
                    @input=${(event: Event) => {
                      this.confirmation = (
                        event.target as HTMLInputElement
                      ).value;
                      this.requestUpdate();
                    }}
                  />
                </label>
                <div class="actions dialog-footer">
                  <button
                    type="submit"
                    class="danger"
                    ?disabled=${blocked || this.confirmation !== (this.confirming === "all" ? "PURGE ALL" : "PURGE")}
                  >
                    Confirm permanent purge
                  </button>
                </div>
              </form>`
            : nothing
        }
        <div class="actions dialog-footer">
          <button
            ?disabled=${this.saving || !!this.pending}
            @click=${this.closePurge}
          >
            Cancel purge
          </button>
        </div>
      </dialog>
    </section>`;
  }
}
if (!customElements.get("kaleidescape-advanced"))
  customElements.define("kaleidescape-advanced", KaleidescapeAdvanced);
