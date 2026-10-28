/** Database toolbar transfers with private, bounded import/export dialogs. */
import { LitElement, css, html, nothing } from "lit";
import type { PropertyValues } from "lit";
import { errorCode, errorMessage } from "./api";
import type { JournalClient, JournalInfo, PreparedMutation } from "./api";
import { styles } from "./styles";

export class KaleidescapeTransfers extends LitElement {
  static properties = {
    client: { attribute: false },
    scope: { attribute: false },
    disabled: { type: Boolean },
  };
  static styles = [
    styles,
    css`
      :host {
        min-height: 0;
        background: transparent;
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
    this.renderRoot.querySelector<HTMLDialogElement>("dialog")?.close();
    this.dialog = null;
  }
  private closeDialog(event?: Event) {
    event?.preventDefault();
    if (this.working || this.pending) return;
    const dialog = this.dialog;
    this.hideDialog();
    this.file = undefined;
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
  private async importData() {
    if (
      !this.client ||
      !this.scope ||
      !this.file ||
      this.working ||
      this.disabled ||
      !!this.scope.tracking_enabled
    )
      return;
    try {
      this.pending ??= this.client.prepareImport(
        this.scope,
        this.file,
        this.scope.revision,
      );
      const generation = this.generation;
      const controller = (this.controller = new AbortController());
      const timeout = setTimeout(() => controller.abort(), 65000);
      this.working = true;
      this.error = this.notice = "";
      this.busy();
      this.requestUpdate();
      try {
        const result = await this.client.importFile(
          this.pending,
          this.file,
          controller.signal,
        );
        if (generation !== this.generation) return;
        this.pending = undefined;
        this.file = undefined;
        const input =
          this.renderRoot.querySelector<HTMLInputElement>('input[type="file"]');
        if (input) input.value = "";
        this.notice = `Imported ${result.imported_count} entries; skipped ${result.skipped_count} existing entries.`;
        this.hideDialog();
        this.dispatchEvent(
          new CustomEvent("database-changed", {
            bubbles: true,
            composed: true,
          }),
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
            "import_too_large",
          ].includes(errorCode(error))
        )
          this.pending = undefined;
        this.fail(error);
      } finally {
        clearTimeout(timeout);
        if (generation === this.generation) {
          this.working = false;
          this.controller = undefined;
          this.busy();
          this.requestUpdate();
        }
      }
    } catch (error) {
      this.fail(error);
    }
  }
  protected render() {
    const blocked = this.disabled || this.working || !!this.pending;
    return html`<div class="actions" aria-label="Import and export">
        <button
          data-transfer="import"
          ?disabled=${blocked}
          @click=${() => this.openDialog("import")}
        >
          Import
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
        aria-labelledby="transfer-title"
        @cancel=${this.closeDialog}
      >
        <div class="card-head">
          <h2 id="transfer-title">
            ${this.dialog === "export" ? "Export database" : "Import viewings"}
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
              ? html`<p>
                    Merge compatible JSON or SQLite exports, including prior
                    versions. Existing IDs stay unchanged. Restores viewing
                    snapshots and deleted status; session evidence, audit
                    records, and retry state stay local. Maximum 32 MiB and
                    10,000 entries.
                  </p>
                  ${this.scope?.tracking_enabled ? html`<p class="warning">Disable automatic tracking in Settings before importing.</p>` : nothing}
                  <label
                    >JSON or SQLite export<input
                      type="file"
                      accept=".json,.sqlite,.sqlite3,.db"
                      ?disabled=${blocked || !!this.scope?.tracking_enabled}
                      @change=${(event: Event) => {
                        this.file = (event.target as HTMLInputElement)
                          .files?.[0];
                        this.error = this.notice = "";
                        this.requestUpdate();
                      }}
                  /></label>
                  ${this.file ? html`<p>${this.file.name} · ${(this.file.size / 1024).toFixed(1)} KiB</p>` : nothing}
                  <div class="actions">
                    <button
                      class="primary"
                      ?disabled=${blocked || !this.file || !!this.scope?.tracking_enabled}
                      @click=${this.importData}
                    >
                      Import new entries
                    </button>
                  </div>
                  ${
                    this.pending
                      ? html`<div class="warning">
                          ${this.working ? "Importing…" : "The import result is unconfirmed. Retry the same file and request to confirm it."}
                          <div class="actions">
                            <button
                              ?disabled=${this.working}
                              @click=${this.importData}
                            >
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
                                  this.file = undefined;
                                  const input =
                                    this.renderRoot.querySelector<HTMLInputElement>(
                                      'input[type="file"]',
                                    );
                                  if (input) input.value = "";
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
                  }`
              : nothing
        }
        <div class="actions dialog-footer">
          <button
            ?disabled=${this.working || !!this.pending}
            @click=${this.closeDialog}
          >
            Cancel
          </button>
        </div>
      </dialog>`;
  }
}
if (!customElements.get("kaleidescape-transfers"))
  customElements.define("kaleidescape-transfers", KaleidescapeTransfers);
