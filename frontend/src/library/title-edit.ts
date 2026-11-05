/** Administrator display overrides; source identities remain read-only. */
import { LitElement, css, html, nothing } from "lit";
import type { PropertyValues } from "lit";
import { errorCode, errorMessage } from "../core/api";
import type {
  JournalClient,
  JournalInfo,
  LibraryEdit,
  PreparedMutation,
} from "../core/api";
import { styles } from "../ui/styles";
import { iconAction, iconActionStyles } from "../ui/action-icons";
import { closeButton, dismissBackdrop } from "../ui/dialog";
import { counted } from "../core/text";

const FIELDS = [
  ["title", "Display title"],
  ["sort_title", "Sort title (blank uses display title)"],
  ["year", "Year"],
  ["rating", "Rating"],
  ["synopsis", "Synopsis"],
  ["actors", "Cast · billing order"],
  ["directors", "Directors"],
  ["writers", "Writers"],
  ["producers", "Producers"],
  ["studios", "Studios"],
  ["genres", "Genres"],
  ["purchased_on", "Purchase date"],
  ["purchase_price", "Purchase price"],
  ["retail_price", "Retail price"],
];
const LISTS = new Set([
  "actors",
  "directors",
  "writers",
  "producers",
  "studios",
  "genres",
]);

export class TitleEdit extends LitElement {
  static properties = {
    client: { attribute: false },
    scope: { attribute: false },
    versionId: {},
    blocked: { type: Boolean },
  };
  static styles = [
    styles,
    iconActionStyles,
    css`
      :host {
        display: inline-block;
      }
      dialog {
        width: min(640px, calc(100% - 24px));
      }
      .edit-fields {
        display: grid;
        gap: 16px;
        padding-block: 8px 16px;
      }
      textarea {
        min-height: 90px;
      }
    `,
  ];
  client?: JournalClient;
  scope?: JournalInfo;
  versionId = "";
  blocked = false;
  private review?: LibraryEdit;
  private draft: Record<string, string> = {};
  private pending?: PreparedMutation;
  private busy = false;
  private opened = false;
  private restoring = false;
  private error = "";
  private generation = 0;
  protected willUpdate(changed: PropertyValues) {
    if (
      changed.has("scope") ||
      changed.has("client") ||
      changed.has("versionId")
    )
      this.reset();
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    this.reset();
  }
  private lock() {
    this.dispatchEvent(
      new CustomEvent("edit-lock", {
        detail: this.opened || this.busy || !!this.pending,
        bubbles: true,
        composed: true,
      }),
    );
  }
  private reset() {
    this.generation++;
    this.review = undefined;
    this.draft = {};
    this.pending = undefined;
    this.busy = false;
    this.opened = this.restoring = false;
    this.error = "";
    this.renderRoot.querySelector<HTMLDialogElement>("dialog")?.close();
    this.lock();
  }
  private close() {
    this.reset();
    this.requestUpdate();
  }
  confirmNavigation() {
    if (this.busy || this.pending) return false;
    return (
      !this.opened ||
      !this.review ||
      (!this.restoring && !Object.keys(this.patch()).length) ||
      window.confirm("Discard your unsaved Library changes?")
    );
  }
  private report(error: unknown) {
    this.error = errorMessage(error);
    if (errorCode(error) === "unauthorized") {
      this.reset();
      this.dispatchEvent(
        new CustomEvent("access-denied", { bubbles: true, composed: true }),
      );
    }
  }
  private async open() {
    if (!this.client || !this.scope?.permissions.edit || this.blocked) return;
    this.reset();
    this.busy = true;
    this.opened = true;
    this.lock();
    this.requestUpdate();
    await this.updateComplete;
    this.renderRoot.querySelector<HTMLDialogElement>("dialog")!.showModal();
    const generation = this.generation;
    try {
      const review = await this.client.libraryEdit(this.scope, this.versionId);
      if (generation !== this.generation) return;
      this.review = review;
      this.draft = Object.fromEntries(
        Object.entries(review.values).map(([key, value]) => [
          key,
          Array.isArray(value) ? value.join("\n") : String(value ?? ""),
        ]),
      );
    } catch (error) {
      if (generation === this.generation) this.report(error);
    } finally {
      if (generation === this.generation) {
        this.busy = false;
        this.lock();
        this.requestUpdate();
      }
    }
  }
  private patch() {
    const patch: Record<string, unknown> = {};
    for (const [key] of FIELDS) {
      const current = this.draft[key] ?? "";
      const value = LISTS.has(key)
        ? current
            .split("\n")
            .map((item) => item.trim())
            .filter(Boolean)
        : key === "year"
          ? current.trim()
            ? Number(current)
            : null
          : [
                "sort_title",
                "purchased_on",
                "purchase_price",
                "retail_price",
              ].includes(key)
            ? current.trim() || null
            : current;
      if (
        JSON.stringify(value) !==
        JSON.stringify(
          this.review!.values[key] ??
            (LISTS.has(key)
              ? []
              : [
                    "sort_title",
                    "year",
                    "purchased_on",
                    "purchase_price",
                    "retail_price",
                  ].includes(key)
                ? null
                : ""),
        )
      )
        patch[key] = value;
    }
    const unavailable = this.draft.purchase_information_unavailable === "true";
    if (unavailable !== !!this.review!.values.purchase_information_unavailable)
      patch.purchase_information_unavailable = unavailable;
    return patch;
  }
  private async save() {
    if (
      !this.client ||
      !this.scope?.permissions.edit ||
      !this.review ||
      this.busy
    )
      return;
    const generation = this.generation;
    try {
      this.pending ??= this.restoring
        ? this.client.prepareLibraryReset(
            this.scope,
            this.versionId,
            this.review.snapshot,
          )
        : this.client.prepareLibraryEdit(
            this.scope,
            this.versionId,
            this.review.snapshot,
            this.patch(),
          );
      this.busy = true;
      this.error = "";
      this.lock();
      this.requestUpdate();
      await this.client.saveLibraryEdit(this.pending);
      if (generation !== this.generation) return;
      this.pending = undefined;
      this.busy = false;
      this.close();
      this.dispatchEvent(
        new CustomEvent("metadata-changed", { bubbles: true, composed: true }),
      );
    } catch (error) {
      if (generation !== this.generation) return;
      if (
        [
          "invalid_request",
          "conflict",
          "refresh_required",
          "not_found",
          "backup_in_progress",
          "busy",
        ].includes(errorCode(error))
      )
        this.pending = undefined;
      this.report(error);
    } finally {
      if (generation === this.generation) {
        this.busy = false;
        this.lock();
        this.requestUpdate();
      }
    }
  }
  protected render() {
    if (!this.scope?.permissions.edit) return nothing;
    return html`${iconAction("Edit details", "edit", this.blocked || this.busy || !!this.pending, () => this.open())}
      <dialog
        data-admin-dialog
        class="inset-dialog"
        aria-labelledby="library-edit-title"
        @click=${dismissBackdrop}
        @cancel=${(event: Event) => {
          event.preventDefault();
          this.close();
        }}
      >
        <div class="card-head">
          <h2 id="library-edit-title">Edit Library details</h2>
          ${closeButton(() => this.close())}
        </div>
        ${this.error ? html`<p class="error" role="alert">${this.error}</p>` : nothing}
        ${this.busy ? html`<p role="status">${this.pending ? "Saving changes…" : "Loading details…"}</p>` : nothing}
        ${
          this.review && this.restoring
            ? html`<p class="warning">
                Restore the original scanned metadata for all versions? This
                removes provider metadata, downloaded poster/hero selections,
                manual display changes and sort titles. Purchases and viewings
                remain intact. Background scraping stays paused for this movie
                until you explicitly scrape and apply data again.
              </p>`
            : this.review
              ? html`<p class="muted">
                    Applies to ${counted(this.review.version_count, "version")}.
                    Changes survive scans. Source IDs, runtime, formats,
                    purchases and viewing records are protected. Enter one name
                    per line for credits and genres.
                  </p>
                  <div class="edit-fields">
                    ${FIELDS.map(
                      ([key, label]) =>
                        html`<label
                          >${label}${
                            LISTS.has(key) || key === "synopsis"
                              ? html`<textarea
                                  name=${key}
                                  .value=${this.draft[key] ?? ""}
                                  ?disabled=${!!this.pending || this.busy}
                                  @input=${(e: Event) => {
                                    this.draft[key] = (
                                      e.target as HTMLTextAreaElement
                                    ).value;
                                    this.requestUpdate();
                                  }}
                                ></textarea>`
                              : html`<input
                                  name=${key}
                                  type=${key === "year" ? "number" : key === "purchased_on" ? "date" : "text"}
                                  .value=${this.draft[key] ?? ""}
                                  ?disabled=${!!this.pending || this.busy}
                                  @input=${(e: Event) => {
                                    this.draft[key] = (
                                      e.target as HTMLInputElement
                                    ).value;
                                    this.requestUpdate();
                                  }}
                                />`
                          }</label
                        >`,
                    )}
                    <label class="check"
                      ><input
                        name="purchase_information_unavailable"
                        type="checkbox"
                        .checked=${this.draft.purchase_information_unavailable === "true"}
                        ?disabled=${!!this.pending || this.busy}
                        @change=${(e: Event) => {
                          this.draft.purchase_information_unavailable = String(
                            (e.target as HTMLInputElement).checked,
                          );
                          this.requestUpdate();
                        }}
                      />Purchase information unavailable</label
                    >
                    <p class="muted">
                      Purchase date and prices apply to this version. The
                      unavailable option applies to the whole movie.
                    </p>
                  </div>`
              : nothing
        }
        <div class="dialog-footer">
          <button ?disabled=${this.busy || !!this.pending} @click=${this.close}>
            Cancel
          </button>
          ${
            this.review && !this.restoring && !this.pending
              ? html`<button
                  class="danger"
                  ?disabled=${this.busy}
                  @click=${() => {
                    this.restoring = true;
                    this.requestUpdate();
                  }}
                >
                  Restore original metadata…
                </button>`
              : nothing
          }
          ${
            this.restoring && !this.pending
              ? html`<button
                  ?disabled=${this.busy}
                  @click=${() => {
                    this.restoring = false;
                    this.requestUpdate();
                  }}
                >
                  Keep metadata
                </button>`
              : nothing
          }
          ${this.error && !this.pending ? html`<button ?disabled=${this.busy} @click=${this.open}>Reload details</button>` : nothing}
          <button
            class=${this.restoring ? "danger" : "primary"}
            ?disabled=${this.busy || !this.review || (!this.pending && !this.restoring && !Object.keys(this.patch()).length)}
            @click=${this.save}
          >
            ${this.pending ? "Retry exact save" : this.restoring ? "Restore original metadata" : "Save changes"}
          </button>
        </div>
      </dialog>`;
  }
}
if (!customElements.get("kaleidescape-title-edit"))
  customElements.define("kaleidescape-title-edit", TitleEdit);
