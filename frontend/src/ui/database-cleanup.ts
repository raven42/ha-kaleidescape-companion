/** Administrator review for conservative, selectable database maintenance. */
import { LitElement, css, html, nothing } from "lit";
import { errorCode, errorMessage } from "../core/api";
import type { JournalClient, Scope } from "../core/api";
import { styles } from "./styles";
import { closeButton } from "./dialog";
import { settingHint } from "./settings-hint";

const CATEGORIES = [
  [
    "calendar",
    "Calendar reconciliation history",
    "Finalized calendar reconciliation receipts; pending and uncertain changes are kept.",
  ],
  [
    "collections",
    "Collection change history",
    "Confirmed or acknowledged collection change receipts; active and uncertain changes are kept.",
  ],
  [
    "playback",
    "Playback control history",
    "Finished or reviewed playback control receipts; pending and uncertain commands are kept.",
  ],
] as const;
type CleanupReview = {
  as_of: string;
  counts: Record<string, number>;
  policies: Record<string, number>;
  revision: number;
};
export class DatabaseCleanup extends LitElement {
  static properties = {
    client: { attribute: false },
    scope: { attribute: false },
    disabled: { type: Boolean },
  };
  static styles = [
    styles,
    css`
      :host {
        display: inline-block;
      }
      .launch {
        display: flex;
        align-items: center;
        gap: 3px;
      }
      .cleanup-field {
        display: grid;
        gap: 6px;
        margin: 12px 0;
      }
      .cleanup-mode {
        display: flex;
        justify-content: flex-end;
      }
      .cleanup-label {
        display: flex;
        align-items: center;
        gap: 4px;
      }
    `,
  ];
  client?: JournalClient;
  scope?: Scope;
  disabled = false;
  private busy = false;
  private policies: Record<string, number> = {
    calendar: 180,
    collections: 180,
    playback: 90,
  };
  private advanced = false;
  private review?: CleanupReview;
  private error = "";
  private notice = "";
  private async open() {
    this.review = undefined;
    this.error = "";
    this.notice = "";
    this.requestUpdate();
    await this.updateComplete;
    this.renderRoot.querySelector<HTMLDialogElement>("dialog")?.showModal();
  }
  private report(error: unknown) {
    this.error =
      errorCode(error) === "conflict"
        ? "The database changed. Review cleanup again."
        : errorMessage(error);
    if (errorCode(error) === "unauthorized")
      this.dispatchEvent(
        new CustomEvent("access-denied", { bubbles: true, composed: true }),
      );
  }
  private async preview() {
    if (!this.client || !this.scope || this.busy) return;
    this.busy = true;
    this.error = "";
    this.requestUpdate();
    try {
      this.review = await this.client.cleanupPreview(this.scope, this.policies);
    } catch (error) {
      this.report(error);
    } finally {
      this.busy = false;
      this.requestUpdate();
    }
  }
  private async apply() {
    if (!this.client || !this.scope || !this.review || this.busy) return;
    this.busy = true;
    this.error = "";
    this.requestUpdate();
    try {
      const result = await this.client.cleanupDatabase(this.scope, this.review);
      const total = Object.values(result.removed).reduce((a, b) => a + b, 0);
      this.notice = `Database cleanup complete: ${total} records removed.`;
      this.review = undefined;
      this.renderRoot.querySelector<HTMLDialogElement>("dialog")?.close();
      this.dispatchEvent(
        new CustomEvent("cleanup-complete", { bubbles: true, composed: true }),
      );
    } catch (error) {
      this.review = undefined;
      this.report(error);
    } finally {
      this.busy = false;
      this.requestUpdate();
    }
  }
  protected updated() {
    for (const [key] of CATEGORIES) {
      const select = this.renderRoot.querySelector<HTMLSelectElement>(
        `#${key}`,
      );
      if (select) select.value = String(this.policies[key]);
    }
  }
  protected render() {
    const total = Object.values(this.review?.counts ?? {}).reduce(
      (a, b) => a + b,
      0,
    );
    return html`<div class="launch">
        <button
          type="button"
          ?disabled=${this.disabled || this.busy}
          @click=${this.open}
        >
          Database cleanup</button
        >${settingHint("Database cleanup", "Choose which finalized operation histories to remove and how long to retain each. Pending work, retry barriers, purchases, Library and Journal records are protected.")}
      </div>
      ${this.notice ? html`<small role="status">${this.notice}</small>` : nothing}
      <dialog
        aria-labelledby="cleanup-heading"
        @cancel=${(event: Event) => {
          if (this.busy) event.preventDefault();
        }}
      >
        <div class="card-head">
          <h2 id="cleanup-heading">Database cleanup</h2>
          ${closeButton(() => this.renderRoot.querySelector<HTMLDialogElement>("dialog")?.close(), this.busy)}
        </div>
        ${this.error ? html`<p class="error" role="alert">${this.error}</p>` : nothing}
        ${
          !this.review
            ? html`<p>
                  Choose which finalized histories to clean and how long to keep
                  them. Other records remain untouched.
                </p>
                <div class="cleanup-mode">
                  <button
                    type="button"
                    class="view-mode-switch"
                    role="switch"
                    aria-label="Advanced cleanup settings"
                    aria-checked=${this.advanced}
                    title=${this.advanced ? "Switch to Recommended settings" : "Switch to Advanced settings"}
                    ?disabled=${this.busy}
                    @click=${() => {
                      this.advanced = !this.advanced;
                      if (!this.advanced)
                        this.policies = {
                          calendar: 180,
                          collections: 180,
                          playback: 90,
                        };
                      this.requestUpdate();
                    }}
                  >
                    <span class="mode-label"
                      >${this.advanced ? "Advanced" : "Recommended"}</span
                    >
                    <span class="mode-track" aria-hidden="true"
                      ><span class="mode-thumb"></span
                    ></span>
                  </button>
                </div>
                ${CATEGORIES.map(
                  ([key, label, hint]) =>
                    html`<div class="cleanup-field">
                      <span class="cleanup-label"
                        ><label for=${key}>${label}</label
                        >${settingHint(label, hint)}</span
                      ><select
                        id=${key}
                        ?disabled=${this.busy || !this.advanced}
                        @change=${(event: Event) => {
                          this.policies = {
                            ...this.policies,
                            [key]: Number(
                              (event.target as HTMLSelectElement).value,
                            ),
                          };
                          this.requestUpdate();
                        }}
                      >
                        <option value="0">Keep all</option>
                        ${[7, 30, 90, 180, 365, 730, 3650].map((days) => html`<option value=${days}>Keep ${days} days</option>`)}
                      </select>
                    </div>`,
                )}
                <div class="actions">
                  <button
                    type="button"
                    ?disabled=${this.busy}
                    @click=${() => this.renderRoot.querySelector<HTMLDialogElement>("dialog")?.close()}
                  >
                    Cancel</button
                  ><button
                    type="button"
                    class="primary"
                    ?disabled=${this.busy || !Object.values(this.policies).some(Boolean)}
                    @click=${this.preview}
                  >
                    ${this.busy ? "Checking…" : "Review cleanup"}
                  </button>
                </div>`
            : html` <p>Review the records eligible for removal:</p>
                <ul>
                  ${CATEGORIES.filter(([key]) => this.review!.policies[key]).map(([key, label]) => html`<li>${label}: ${this.review!.counts[key]} older than ${this.review!.policies[key]} days</li>`)}
                </ul>
                <p>
                  Pending work and retry barriers are kept. Cleanup makes space
                  reusable inside SQLite but does not compact the file.
                </p>
                <div class="actions">
                  <button
                    type="button"
                    ?disabled=${this.busy}
                    @click=${() => {
                      this.review = undefined;
                      this.requestUpdate();
                    }}
                  >
                    Back</button
                  ><button
                    type="button"
                    class="primary"
                    ?disabled=${this.busy || !total}
                    @click=${this.apply}
                  >
                    ${this.busy ? "Cleaning…" : "Remove eligible records"}
                  </button>
                </div>`
        }
      </dialog>`;
  }
}
if (!customElements.get("kaleidescape-database-cleanup"))
  customElements.define("kaleidescape-database-cleanup", DatabaseCleanup);
