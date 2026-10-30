/** Database toolbar transfers with private, bounded import/export dialogs. */
import { counted } from "../core/text";
import { LitElement, css, html, nothing } from "lit";
import type { PropertyValues } from "lit";
import { errorCode, errorMessage } from "../core/api";
import type {
  JournalClient,
  JournalInfo,
  PreparedMutation,
  ImportReview,
  ImportReviewRow,
} from "../core/api";
import { styles } from "./styles";
import { dismissBackdrop } from "./dialog";
import "./import-matcher";
import type { KaleidescapeImportMatcher } from "./import-matcher";

export class KaleidescapeTransfers extends LitElement {
  static properties = {
    client: { attribute: false },
    scope: { attribute: false },
    disabled: { type: Boolean },
  };
  static styles = [
    styles,
    css`
      .database-dialog {
        width: min(1100px, calc(100% - 32px));
      }
      table {
        table-layout: fixed;
      }
      th:first-child {
        width: 56px;
      }
      th:nth-child(2) {
        width: 30%;
      }
      th:nth-child(3) {
        width: 90px;
      }
      td:first-child {
        min-width: 0;
        max-width: none;
      }
      td {
        padding: 8px;
        vertical-align: top;
        overflow-wrap: anywhere;
      }
      th {
        padding: 8px;
      }
      td input[type="checkbox"] {
        width: auto;
      }
      details {
        margin-top: 4px;
      }
      .table-wrap {
        max-height: 55dvh;
        overflow: auto;
      }
      th {
        position: sticky;
        top: 0;
      }
    `,
  ];
  client?: JournalClient;
  scope?: JournalInfo;
  disabled = false;
  private boundClient?: JournalClient;
  private bound = "";
  private generation = 0;
  private controller?: AbortController;
  private file?: File;
  private pending?: PreparedMutation;
  private review?: ImportReview;
  private matching?: ImportReviewRow;
  private selected = new Set<string>();
  private query = "";
  private changesOnly = false;
  private page = 0;
  private pageSize = 100;
  private working = false;
  private error = "";
  private notice = "";
  private dialog: "import" | "export" | null = null;
  protected willUpdate(changed: PropertyValues) {
    if (!changed.has("client") && !changed.has("scope")) return;
    const key = `${this.scope?.entry_id}:${this.scope?.dataset_id}`;
    if (this.boundClient === this.client && this.bound === key) return;
    this.clear();
    this.bound = key;
    this.boundClient = this.client;
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    this.clear();
    this.boundClient = undefined;
  }
  private clear() {
    this.generation++;
    this.controller?.abort();
    this.controller = undefined;
    this.file = undefined;
    this.review = undefined;
    this.matching = undefined;
    this.selected.clear();
    const input =
      this.renderRoot.querySelector<HTMLInputElement>('input[type="file"]');
    if (input) input.value = "";
    this.pending = undefined;
    this.working = false;
    this.hideDialog();
    this.error = this.notice = "";
    this.busy();
  }
  private async openDialog(dialog: "import" | "export") {
    if (this.disabled || this.working || this.pending) return;
    if (
      !this.dispatchEvent(
        new CustomEvent("transfer-open", {
          detail: dialog,
          bubbles: true,
          composed: true,
          cancelable: true,
        }),
      )
    )
      return;
    const generation = this.generation;
    this.dialog = dialog;
    this.error = this.notice = "";
    this.requestUpdate();
    await this.updateComplete;
    if (generation !== this.generation || !this.isConnected) return;
    this.renderRoot.querySelector<HTMLDialogElement>("dialog")?.showModal();
  }
  private hideDialog() {
    this.matching = undefined;
    this.renderRoot.querySelector<HTMLDialogElement>("dialog")?.close();
    this.dialog = null;
  }
  private closeDialog(event?: Event) {
    event?.preventDefault();
    if (this.working || this.pending) return;
    const dialog = this.dialog;
    this.hideDialog();
    this.file = undefined;
    this.review = undefined;
    this.matching = undefined;
    this.selected.clear();
    const input =
      this.renderRoot.querySelector<HTMLInputElement>('input[type="file"]');
    if (input) input.value = "";
    this.requestUpdate();
    this.renderRoot
      .querySelector<HTMLButtonElement>(`[data-transfer="${dialog}"]`)
      ?.focus();
  }
  private busy() {
    this.dispatchEvent(
      new CustomEvent("transfer-busy", {
        detail: this.working || !!this.pending,
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
  private async exportData(format: "json" | "sqlite") {
    if (
      !this.client ||
      !this.scope ||
      this.working ||
      this.pending ||
      this.disabled
    )
      return;
    const generation = this.generation;
    const controller = (this.controller = new AbortController());
    const timeout = setTimeout(() => controller.abort(), 65000);
    this.working = true;
    this.error = this.notice = "";
    this.busy();
    this.requestUpdate();
    try {
      const blob = await this.client.download(
        this.scope,
        format,
        controller.signal,
      );
      if (generation !== this.generation) return;
      const url = URL.createObjectURL(blob),
        anchor = document.createElement("a");
      try {
        anchor.href = url;
        anchor.download = `kaleidescape-journal.${format}`;
        anchor.click();
      } finally {
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
      this.notice =
        "Export downloaded. Keep this private copy in a protected location.";
      this.hideDialog();
    } catch (error) {
      if (generation === this.generation) this.fail(error);
    } finally {
      clearTimeout(timeout);
      if (generation === this.generation) {
        this.working = false;
        this.controller = undefined;
        this.busy();
        this.requestUpdate();
      }
    }
  }
  private async previewData() {
    if (
      !this.client ||
      !this.scope ||
      !this.file ||
      this.working ||
      this.disabled ||
      this.scope.tracking_enabled
    )
      return;
    const generation = this.generation;
    const controller = (this.controller = new AbortController());
    const timeout = setTimeout(() => controller.abort(), 65000);
    this.working = true;
    this.error = this.notice = "";
    this.review = undefined;
    this.matching = undefined;
    this.selected.clear();
    this.busy();
    this.requestUpdate();
    try {
      const review = await this.client.previewImport(
        this.scope,
        this.file,
        controller.signal,
      );
      if (generation !== this.generation) return;
      this.review = review;
      this.selected = new Set(
        review.rows
          .filter(
            (row) =>
              ["new", "merge"].includes(row.action) &&
              row.selected_by_default !== false,
          )
          .map((row) => row.key),
      );
      this.page = 0;
      this.query = "";
      this.changesOnly = false;
    } catch (error) {
      if (generation === this.generation) this.fail(error);
    } finally {
      clearTimeout(timeout);
      if (generation === this.generation) {
        this.working = false;
        this.controller = undefined;
        this.busy();
        this.requestUpdate();
      }
    }
  }
  private async importData() {
    if (
      !this.client ||
      !this.scope ||
      !this.review ||
      this.matching ||
      this.working ||
      this.disabled ||
      this.scope.tracking_enabled
    )
      return;
    this.pending ??= this.client.prepareImport(this.scope, this.review, [
      ...this.selected,
    ]);
    const generation = this.generation;
    this.working = true;
    this.error = this.notice = "";
    this.busy();
    this.requestUpdate();
    try {
      const result = await this.client.applyImport(this.pending);
      if (generation !== this.generation) return;
      this.pending = undefined;
      this.review = undefined;
      this.matching = undefined;
      this.file = undefined;
      this.selected.clear();
      this.notice = `Imported ${counted(result.imported_count, "new entry", "new entries")}; filled missing data in ${result.updated_count}; left ${result.skipped_count} unchanged or unselected.`;
      this.hideDialog();
      this.dispatchEvent(
        new CustomEvent("database-changed", { bubbles: true, composed: true }),
      );
    } catch (error) {
      if (generation !== this.generation) return;
      if (
        [
          "invalid_request",
          "unauthorized",
          "conflict",
          "not_found",
          "tracking_enabled",
        ].includes(errorCode(error))
      ) {
        this.pending = undefined;
        this.review = undefined;
        this.matching = undefined;
        this.selected.clear();
      }
      this.fail(error);
    } finally {
      if (generation === this.generation) {
        this.working = false;
        this.busy();
        this.requestUpdate();
      }
    }
  }
  private async openMatch(row: ImportReviewRow) {
    if (this.scope?.tracking_enabled) return;
    this.matching = row;
    this.requestUpdate();
    await this.updateComplete;
    if (this.matching === row)
      await this.renderRoot
        .querySelector<KaleidescapeImportMatcher>("kaleidescape-import-matcher")
        ?.focusSearch();
  }
  private async chooseMatch(titleId: string | null) {
    if (
      !this.client ||
      !this.scope ||
      !this.review ||
      !this.matching ||
      this.scope.tracking_enabled ||
      this.working ||
      this.pending ||
      this.disabled
    )
      return;
    const generation = this.generation,
      key = this.matching.key;
    this.working = true;
    this.error = "";
    this.busy();
    this.requestUpdate();
    try {
      const result = await this.client.matchImportPurchase(
        this.scope,
        this.review,
        key,
        titleId,
      );
      if (generation !== this.generation) return;
      const { row: matchedRow, ...metadata } = result;
      this.review = {
        ...this.review,
        ...metadata,
        rows: this.review.rows.map((row) =>
          row.key === key ? matchedRow : row,
        ),
      };
      this.matching = undefined;
      if (["new", "merge"].includes(result.row.action)) this.selected.add(key);
      else this.selected.delete(key);
      this.page = 0;
    } catch (error) {
      if (generation !== this.generation) return;
      // A lost response may have rotated the review token. Require fresh review.
      this.review = undefined;
      this.matching = undefined;
      this.selected.clear();
      this.fail(error);
    } finally {
      if (generation === this.generation) {
        this.working = false;
        this.busy();
        this.requestUpdate();
      }
    }
  }
  private renderReview(blocked: boolean) {
    if (!this.review) return nothing;
    const review = this.review;
    const query = this.query.trim().toLocaleLowerCase();
    const rows = review.rows
      .filter(
        (row) =>
          (!this.changesOnly ||
            row.needs_match ||
            ["new", "merge"].includes(row.action)) &&
          `${row.title} ${row.detail ?? ""} ${row.table} ${Object.keys(row.changes).join(" ")}`
            .toLocaleLowerCase()
            .includes(query),
      )
      .sort(
        (left, right) =>
          Number(!!right.needs_match) - Number(!!left.needs_match),
      );
    const lastPage = Math.max(0, Math.ceil(rows.length / this.pageSize) - 1);
    const page = Math.min(this.page, lastPage);
    const visible = rows.slice(
      page * this.pageSize,
      (page + 1) * this.pageSize,
    );
    return html`${
        this.matching
          ? html`<kaleidescape-import-matcher
              .client=${this.client}
              .scope=${this.scope}
              .review=${review}
              .row=${this.matching}
              .disabled=${blocked}
              @match-choice=${(event: CustomEvent<string | null>) => this.chooseMatch(event.detail)}
              @match-cancel=${() => {
                this.matching = undefined;
                this.requestUpdate();
              }}
              @access-denied=${() => this.fail({ code: "unauthorized" })}
            ></kaleidescape-import-matcher>`
          : nothing
      }
      <p role="status">
        ${review.counts.new} new · ${review.counts.merge} mergeable ·
        ${review.counts.unchanged} unchanged · ${review.counts.skip} skipped.
        ${this.selected.size} selected.
        ${review.rows.some((row) => row.needs_match) ? html`${counted(review.rows.filter((row) => row.needs_match).length, "unlinked purchase")} shown first.` : nothing}
      </p>
      <div class="actions">
        <label
          >Search review<input
            type="search"
            .value=${this.query}
            ?disabled=${blocked}
            @input=${(event: Event) => {
              this.query = (event.target as HTMLInputElement).value;
              this.page = 0;
              this.requestUpdate();
            }}
        /></label>
        <label class="check"
          ><input
            type="checkbox"
            .checked=${this.changesOnly}
            ?disabled=${blocked}
            @change=${(event: Event) => {
              this.changesOnly = (event.target as HTMLInputElement).checked;
              this.page = 0;
              this.requestUpdate();
            }}
          />Changes only</label
        >
        <button
          ?disabled=${blocked}
          @click=${() => {
            this.selected = new Set(
              review.rows
                .filter((row) => ["new", "merge"].includes(row.action))
                .map((row) => row.key),
            );
            this.requestUpdate();
          }}
        >
          Select all changes
        </button>
        <button
          ?disabled=${blocked}
          @click=${() => {
            this.selected.clear();
            this.requestUpdate();
          }}
        >
          Select none
        </button>
      </div>
      <div class="table-wrap">
        <table aria-label="Import review">
          <thead>
            <tr>
              <th>Select</th>
              <th>Entry</th>
              <th>Action</th>
              <th>Fields / details</th>
            </tr>
          </thead>
          <tbody>
            ${visible.map(
              (row) =>
                html`<tr>
                  <td>
                    <input
                      type="checkbox"
                      aria-label=${`Import ${row.title}`}
                      .checked=${this.selected.has(row.key)}
                      ?disabled=${blocked || !["new", "merge"].includes(row.action)}
                      @change=${(event: Event) => {
                        if ((event.target as HTMLInputElement).checked)
                          this.selected.add(row.key);
                        else this.selected.delete(row.key);
                        this.requestUpdate();
                      }}
                    />
                  </td>
                  <td>
                    ${row.title}<small class="muted" title=${row.key}
                      >${row.detail}</small
                    ><small class="muted">${row.table}</small>
                  </td>
                  <td>${row.action}</td>
                  <td>
                    ${row.reason || Object.keys(row.changes).join(", ") || "No missing data"}
                    ${row.needs_match ? html`<small class="warning">No Library match selected</small>` : nothing}
                    ${
                      row.can_match
                        ? html`<button
                            ?disabled=${blocked || !!this.matching || !!this.scope?.tracking_enabled}
                            @click=${() => this.openMatch(row)}
                          >
                            Match title…
                          </button>`
                        : nothing
                    }
                    ${row.conflicts.length ? html`<small class="muted">Existing values kept: ${row.conflicts.join(", ")}</small>` : nothing}
                    ${
                      Object.keys(row.changes).length
                        ? html`<details>
                            <summary>Changes</summary>
                            <pre>${JSON.stringify(row.changes, null, 2)}</pre>
                          </details>`
                        : nothing
                    }
                  </td>
                </tr>`,
            )}
          </tbody>
        </table>
      </div>
      <p class="muted">
        ${visible.length === 1 ? "Row" : "Rows"}
        ${rows.length ? page * this.pageSize + 1 : 0}–${Math.min((page + 1) * this.pageSize, rows.length)}
        of ${rows.length}. Selection covers all review pages.
      </p>
      <div class="actions">
        <button
          ?disabled=${blocked || !page}
          @click=${() => {
            this.page = page - 1;
            this.requestUpdate();
          }}
        >
          Previous</button
        ><button
          ?disabled=${blocked || page >= lastPage}
          @click=${() => {
            this.page = page + 1;
            this.requestUpdate();
          }}
        >
          Next
        </button>
        <label
          >Rows per page<select
            ?disabled=${blocked}
            .value=${String(this.pageSize)}
            @change=${(event: Event) => {
              this.pageSize = Number((event.target as HTMLSelectElement).value);
              this.page = 0;
              this.requestUpdate();
            }}
          >
            ${[25, 100, 500].map((count) => html`<option value=${count}>${count}</option>`)}
          </select></label
        >
      </div>`;
  }
  private renderImport(blocked: boolean) {
    return html`<p>
        Add new IDs and fill missing data in existing viewings and Library
        versions. Populated values, manual corrections and deletion status are
        kept. Only known Library sources match. Newly imported versions stay
        inactive until a server sync verifies them. Session evidence, collection
        membership, artwork files, audit and retry state are not restored.
        Maximum 32 MiB / 10,000 records. Review expires after 10 minutes or any
        database change. Purchase JSON keeps separate orders and proposes
        exact-name Library group links for review. Ambiguous names stay
        unlinked. Purchase rows start unchecked; select the purchases and links
        you approve.
      </p>
      ${this.scope?.tracking_enabled ? html`<p class="warning">Disable automatic tracking in Settings before importing.</p>` : nothing}
      <label
        >JSON or SQLite file<input
          type="file"
          accept=".json,.sqlite,.sqlite3,.db"
          ?disabled=${blocked || !!this.scope?.tracking_enabled}
          @change=${(event: Event) => {
            this.file = (event.target as HTMLInputElement).files?.[0];
            this.review = undefined;
            this.matching = undefined;
            this.selected.clear();
            this.error = this.notice = "";
            this.requestUpdate();
          }}
      /></label>
      ${this.file ? html`<p>${this.file.name} · ${(this.file.size / 1024).toFixed(1)} KiB</p>` : nothing}
      <div class="actions">
        <button
          ?disabled=${blocked || !this.file || !!this.scope?.tracking_enabled}
          @click=${this.previewData}
        >
          Review import
        </button>
      </div>
      ${this.renderReview(blocked)}
      ${
        this.pending
          ? html`<div class="warning">
              ${this.working ? "Importing…" : "The import result is unconfirmed. Retry the same selection and request to confirm it."}
              <div class="actions">
                <button ?disabled=${this.working} @click=${this.importData}>
                  Retry same import</button
                ><button
                  ?disabled=${this.working}
                  @click=${() => {
                    if (
                      window.confirm(
                        "The import may already have committed. Discard its retry and inspect the database before importing again?",
                      )
                    ) {
                      this.pending = undefined;
                      this.review = undefined;
                      this.matching = undefined;
                      this.file = undefined;
                      this.selected.clear();
                      this.hideDialog();
                      this.busy();
                      this.dispatchEvent(
                        new CustomEvent("database-changed", {
                          bubbles: true,
                          composed: true,
                        }),
                      );
                      this.requestUpdate();
                    }
                  }}
                >
                  Discard import retry & inspect
                </button>
              </div>
            </div>`
          : nothing
      }`;
  }
  protected render() {
    const blocked = this.disabled || this.working || !!this.pending;
    return html`<div class="actions" aria-label="Import and export">
        <button
          data-transfer="import"
          ?disabled=${blocked}
          @click=${() => this.openDialog("import")}
        >
          Merge Import
        </button>
        <button
          data-transfer="export"
          ?disabled=${blocked}
          @click=${() => this.openDialog("export")}
        >
          Export
        </button>
      </div>
      ${!this.dialog && this.error ? html`<p class="error" role="alert">${this.error}</p>` : nothing}
      ${!this.dialog && this.notice ? html`<p class="notice" role="status">${this.notice}</p>` : nothing}
      <dialog
        class="database-dialog"
        @click=${dismissBackdrop}
        aria-labelledby="transfer-title"
        @cancel=${this.closeDialog}
      >
        <div class="card-head">
          <h2 id="transfer-title">
            ${this.dialog === "export" ? "Export database" : "Merge Import"}
          </h2>
        </div>
        ${this.error && this.dialog ? html`<p class="error" role="alert">${this.error}</p>` : nothing}
        ${
          this.dialog === "export"
            ? html`<p>
                  Exports include private history and deleted records. SQLite
                  also includes catalog and source metadata. Store downloads
                  securely.
                </p>
                <div class="actions">
                  <button
                    ?disabled=${blocked}
                    @click=${() => this.exportData("json")}
                  >
                    Export JSON</button
                  ><button
                    ?disabled=${blocked}
                    @click=${() => this.exportData("sqlite")}
                  >
                    Export SQLite
                  </button>
                </div>`
            : this.dialog === "import"
              ? this.renderImport(blocked)
              : nothing
        }
        <div class="actions dialog-footer">
          <button
            ?disabled=${this.working || !!this.pending}
            @click=${this.closeDialog}
          >
            Cancel</button
          >${this.dialog === "import" && this.review ? html`<button class="primary" ?disabled=${blocked || !!this.matching || !this.selected.size} @click=${this.importData}>Apply ${counted(this.selected.size, "selected change")}</button>` : nothing}
        </div>
      </dialog>`;
  }
}
if (!customElements.get("kaleidescape-transfers"))
  customElements.define("kaleidescape-transfers", KaleidescapeTransfers);
