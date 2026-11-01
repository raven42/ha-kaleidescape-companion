/** Selectable private settings files; native HA changes are staged for Save settings. */
import { LitElement, html, nothing } from "lit";
import type { PropertyValues } from "lit";
import { errorCode, errorMessage, randomId } from "../core/api";
import type { JournalClient, JournalInfo, SettingsTransfer } from "../core/api";
import { styles } from "./styles";
import { closeButton, dismissBackdrop } from "./dialog";

const categories = [
  ["rules", "Runtime rules and feature enablement"],
  ["browsing", "Personal browsing preferences · may include searches/names"],
  ["shared", "Shared hidden collection names"],
  ["logging", "Logging level and movie-value opt-in"],
  ["connections", "Network addresses, player and HA entity choices · private"],
  ["templates", "Custom calendar text templates · private"],
] as const;

export class SettingsTransferPanel extends LitElement {
  static properties = {
    client: { attribute: false },
    scope: { attribute: false },
    disabled: { type: Boolean },
  };
  static styles = styles;
  client?: JournalClient;
  scope?: JournalInfo;
  disabled = false;
  private generation = 0;
  private selected = new Set<string>(["rules", "browsing"]);
  private artifact?: Record<string, unknown>;
  private preview?: SettingsTransfer;
  private request = "";
  private busy = false;
  private pending = false;
  private error = "";
  private notice = "";
  protected willUpdate(changed: PropertyValues) {
    if (changed.has("client") || changed.has("scope")) this.reset();
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    this.reset();
  }
  private reset() {
    this.generation++;
    this.artifact = this.preview = undefined;
    this.request = "";
    this.busy = this.pending = false;
    this.error = this.notice = "";
    this.renderRoot.querySelector<HTMLDialogElement>("dialog")?.close();
  }
  private fail(error: unknown) {
    this.error = errorMessage(error);
    if (errorCode(error) === "unauthorized") {
      this.reset();
      this.dispatchEvent(
        new CustomEvent("access-denied", { bubbles: true, composed: true }),
      );
    }
  }
  private async file(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    const generation = this.generation;
    this.artifact = this.preview = undefined;
    this.error = "";
    try {
      if (!file || file.size > 262144) throw new Error("Invalid settings file");
      const artifact: unknown = JSON.parse(await file.text());
      if (generation !== this.generation) return;
      if (!artifact || typeof artifact !== "object" || Array.isArray(artifact))
        throw new Error("Invalid settings file");
      this.artifact = artifact as Record<string, unknown>;
    } catch {
      if (generation === this.generation)
        this.error = "Choose a settings JSON file, at most 256 KiB.";
    }
    this.requestUpdate();
  }
  private async run(operation: "export" | "preview" | "apply") {
    if (!this.client || !this.scope || this.busy || !this.selected.size) return;
    const generation = this.generation;
    this.busy = true;
    this.error = "";
    this.requestUpdate();
    try {
      if (operation === "apply") {
        this.request ||= randomId();
        this.pending = true;
      }
      const result = await this.client.settingsTransfer(
        this.scope,
        operation,
        [...this.selected],
        this.artifact,
        this.request,
      );
      if (generation !== this.generation) return;
      if (operation === "export") {
        const url = URL.createObjectURL(
          new Blob([JSON.stringify(result, null, 2)], {
            type: "application/json",
          }),
        );
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = "companion-settings.json";
        anchor.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } else if (operation === "preview") {
        this.preview = result;
      } else {
        this.pending = false;
        this.request = "";
        this.dispatchEvent(
          new CustomEvent("settings-imported", {
            detail: result.patch ?? {},
            bubbles: true,
            composed: true,
          }),
        );
        this.preview = undefined;
        this.notice =
          "Browsing/shared/logging choices applied. Runtime changes are staged below: review and click Save settings. Full Sync requires a fresh dedicated-calendar acknowledgement.";
        this.renderRoot.querySelector<HTMLDialogElement>("dialog")?.close();
      }
    } catch (error) {
      if (generation === this.generation) this.fail(error);
    } finally {
      if (generation === this.generation) {
        this.busy = false;
        this.requestUpdate();
      }
    }
  }
  protected render() {
    if (!this.scope?.permissions.edit) return nothing;
    const blocked = this.busy || this.disabled || this.pending;
    return html`<button
        type="button"
        ?disabled=${this.disabled || this.busy}
        @click=${() => this.renderRoot.querySelector<HTMLDialogElement>("dialog")?.showModal()}
      >
        Export / import settings
      </button>
      ${this.notice ? html`<p class="notice" role="status">${this.notice}</p>` : nothing}
      <dialog
        class="database-dialog"
        @click=${dismissBackdrop}
        @cancel=${(event: Event) => {
          if (this.busy || this.pending) event.preventDefault();
        }}
      >
        <div class="card-head">
          <h2>Export / import settings</h2>
          ${closeButton(() => this.renderRoot.querySelector<HTMLDialogElement>("dialog")?.close(), this.busy || this.pending)}
        </div>
        <p>
          Choose the categories to transfer. Credentials are always excluded.
          Connection choices, searches, names and templates can contain private
          information; protect the downloaded file.
        </p>
        ${categories.map(
          ([key, label]) =>
            html`<label class="check"
              ><input
                type="checkbox"
                .checked=${this.selected.has(key)}
                ?disabled=${blocked}
                @change=${(e: Event) => {
                  if ((e.target as HTMLInputElement).checked)
                    this.selected.add(key);
                  else this.selected.delete(key);
                  this.preview = undefined;
                  this.requestUpdate();
                }}
              />
              ${label}</label
            >`,
        )}
        <div class="actions">
          <button
            type="button"
            ?disabled=${blocked || !this.selected.size}
            @click=${() => this.run("export")}
          >
            Export selected
          </button>
        </div>
        <label
          >Import settings JSON<input
            type="file"
            accept=".json,application/json"
            ?disabled=${blocked}
            @change=${this.file}
        /></label>
        <button
          type="button"
          ?disabled=${blocked || !this.artifact || !this.selected.size}
          @click=${() => this.run("preview")}
        >
          Review selected categories
        </button>
        ${this.error ? html`<p class="error" role="alert">${this.error}</p>` : nothing}
        ${
          this.preview
            ? html`<h3>Review import</h3>
                <p>
                  Applying updates personal/shared/logging settings immediately.
                  Runtime fields are staged on the Settings page for validation
                  and Save settings. Credentials and database contents are
                  unaffected.
                </p>
                <div style="max-height:35vh;overflow:auto">
                  ${Object.entries(this.preview.categories).map(
                    ([name, values]) =>
                      html`<details>
                        <summary>
                          ${name} · ${Object.keys(values).length} fields
                        </summary>
                        <pre
                          style="white-space:pre-wrap;overflow-wrap:anywhere"
                        >
${JSON.stringify(values, null, 2)}</pre>
                      </details>`,
                  )}
                </div>`
            : nothing
        }
        ${this.pending && !this.busy ? html`<p class="warning">Result unconfirmed. Retry the same import before changing the selection.</p>` : nothing}
        <div class="dialog-footer">
          <button
            type="button"
            class="primary"
            ?disabled=${this.busy || !this.preview}
            @click=${() => this.run("apply")}
          >
            ${this.pending ? "Retry same import" : "Apply selected settings"}
          </button>
        </div>
      </dialog>`;
  }
}
customElements.define("kaleidescape-settings-transfer", SettingsTransferPanel);
