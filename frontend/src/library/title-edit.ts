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
import { EDITABLE_FORMATS, renderFormatBadges } from "./badges";
import { textDiff } from "./text-diff";

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
];
const PURCHASE_FIELDS = [
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
    purchaseOnly: { type: Boolean },
    dateOnly: { type: Boolean },
    optionsOnly: { type: Boolean },
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
      .edited-note {
        color: var(--muted);
        font-weight: normal;
        font-size: 0.9em;
      }
      .diff-head,
      .diff-values {
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      }
      .diff-head {
        font-weight: 600;
        gap: 12px;
      }
      .diff-field {
        margin-top: 14px;
      }
      .diff-field h3 {
        margin: 0 0 5px;
        font-size: 14px;
      }
      .diff-value {
        white-space: pre-wrap;
        overflow-wrap: anywhere;
        padding: 8px;
        min-width: 0;
        background: var(--secondary-background-color, #f7f9f8);
      }
      .diff-value + .diff-value {
        border-left: 1px solid var(--line);
      }
      .diff-removed {
        background: #b4233b70;
      }
      .diff-added {
        background: #16804770;
      }
      .diff-empty {
        color: var(--muted);
        font-style: italic;
      }
      .purchase-edit-link {
        font-size: inherit;
      }
      .edit-fields {
        display: grid;
        gap: 16px;
        padding-block: 8px 16px;
      }
      textarea {
        min-height: 90px;
      }
      .format-options {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 8px;
        margin: 10px 0;
      }
      .format-options label {
        display: inline-flex;
        flex-direction: row;
        align-items: center;
        gap: 8px;
      }
      .format-options input[type="checkbox"] {
        width: 20px;
        height: 20px;
        min-height: 20px;
        flex: 0 0 20px;
        margin: 0;
        padding: 0;
      }
      .format-options .format-badge {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 2px 6px;
        border: 1px solid var(--line);
        border-radius: 4px;
        font-size: 12px;
      }
      .format-options .dolby-symbol,
      .format-options .hdr-symbol {
        width: 16px;
        height: 11px;
      }
    `,
  ];
  client?: JournalClient;
  scope?: JournalInfo;
  versionId = "";
  blocked = false;
  purchaseOnly = false;
  dateOnly = false;
  optionsOnly = false;
  private review?: LibraryEdit;
  private draft: Record<string, string> = {};
  private pending?: PreparedMutation;
  private busy = false;
  private opened = false;
  private restoring = false;
  private reviewingEdits = false;
  private restoredFields = new Map<string, string>();
  private formatMode: "auto" | "original" | "custom" = "auto";
  private formatBadges: string[] = [];
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
    this.restoredFields.clear();
    this.pending = undefined;
    this.busy = false;
    this.opened = this.restoring = this.reviewingEdits = false;
    this.formatMode = "auto";
    this.formatBadges = [];
    this.error = "";
    this.renderRoot.querySelector<HTMLDialogElement>("dialog")?.close();
    this.lock();
  }
  private close() {
    if (!this.confirmNavigation()) return;
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
      if (
        this.purchaseOnly &&
        !this.dateOnly &&
        !this.optionsOnly &&
        review.has_invoices !== false
      ) {
        this.error =
          "Purchase records changed. Close and reopen the movie details to edit the receipt.";
        return;
      }
      this.review = review;
      this.formatMode = review.format_mode ?? "auto";
      this.formatBadges = EDITABLE_FORMATS.filter((name) =>
        review.format_badges?.includes(name),
      );
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
  private fields() {
    if (!this.purchaseOnly) return FIELDS;
    if (this.optionsOnly) return [];
    return this.dateOnly
      ? PURCHASE_FIELDS.filter(([key]) => key === "purchased_on")
      : PURCHASE_FIELDS;
  }
  private patch() {
    const patch: Record<string, unknown> = {};
    for (const [key] of this.fields()) {
      if (this.restoredFields.has(key)) continue;
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
    if (this.restoredFields.size)
      patch.restore_fields = [...this.restoredFields.keys()];
    const unavailable = this.draft.purchase_information_unavailable === "true";
    if (
      this.purchaseOnly &&
      unavailable !== !!this.review!.values.purchase_information_unavailable
    )
      patch.purchase_information_unavailable = unavailable;
    if (!this.purchaseOnly && this.review) {
      const initial = EDITABLE_FORMATS.filter((name) =>
        this.review?.format_badges?.includes(name),
      );
      if (
        this.formatMode !== (this.review.format_mode ?? "auto") ||
        JSON.stringify(this.formatBadges) !== JSON.stringify(initial)
      ) {
        patch.format_override =
          this.formatMode === "custom"
            ? { mode: "custom", badges: this.formatBadges }
            : { mode: this.formatMode };
      }
    }
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
      this.reset();
      this.requestUpdate();
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
  private editedFields() {
    if (!this.review || this.purchaseOnly) return [];
    const saved = new Set(this.review.edited_fields ?? []);
    const unsaved = this.patch();
    return FIELDS.filter(([key]) => saved.has(key) || key in unsaved);
  }
  private restoreField(key: string) {
    if (!this.review || this.busy || this.pending) return;
    if (this.restoredFields.has(key)) {
      this.draft[key] = this.restoredFields.get(key)!;
      this.restoredFields.delete(key);
    } else if ((this.review.edited_fields ?? []).includes(key)) {
      this.restoredFields.set(key, this.draft[key] ?? "");
      const original = this.review.original_values?.[key];
      this.draft[key] = Array.isArray(original)
        ? original.join("\n")
        : String(original ?? "");
    } else {
      const current = this.review.values[key];
      this.draft[key] = Array.isArray(current)
        ? current.join("\n")
        : String(current ?? "");
    }
    this.requestUpdate();
  }
  private renderEdits() {
    const fields = this.editedFields();
    return html`<p class="muted">
        Compare the original scanned metadata with the current values, including
        unsaved changes. Fields are included when a manual edit was recorded;
        older edits may not have recorded provenance. Restore changes are
        applied when you save; restoring a field uses its scanned value.
      </p>
      <div class="diff-head">
        <span>Original scanned</span><span>Current</span>
      </div>
      ${
        fields.length
          ? fields.map(([key, label]) => {
              const raw = this.review?.original_values?.[key];
              const original = Array.isArray(raw)
                ? raw.join("\n")
                : String(raw ?? "");
              const current = this.draft[key] ?? "";
              const diff = textDiff(original, current);
              return html`<section class="diff-field">
                <h3>
                  ${label} <span aria-hidden="true">·</span>
                  <button
                    type="button"
                    class="link"
                    aria-label=${`${this.restoredFields.has(key) ? "Undo restore" : "Restore"} ${label}`}
                    ?disabled=${this.busy || !!this.pending}
                    @click=${() => this.restoreField(key)}
                  >
                    ${this.restoredFields.has(key) ? "undo restore" : "restore"}
                  </button>
                </h3>
                <div class="diff-values">
                  ${(
                    [
                      [diff.original, "diff-removed"],
                      [diff.current, "diff-added"],
                    ] as const
                  ).map(([segments, className]) => {
                    const content = segments.length
                      ? segments.map(
                          (part) =>
                            html`<span class=${part.changed ? className : ""}
                              >${part.text}</span
                            >`,
                        )
                      : html`<span class="diff-empty">Empty</span>`;
                    return html`<div class="diff-value">${content}</div>`;
                  })}
                </div>
              </section>`;
            })
          : html`<p class="muted">No edited fields.</p>`
      }`;
  }
  protected render() {
    if (!this.scope?.permissions.edit) return nothing;
    return html`${this.purchaseOnly ? html`<button type="button" class="link purchase-edit-link" ?disabled=${this.blocked || this.busy || !!this.pending} @click=${this.open}>edit</button>` : iconAction("Edit details", "edit", this.blocked || this.busy || !!this.pending, () => this.open())}
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
          <h2 id="library-edit-title">
            ${this.purchaseOnly ? "Edit purchase details" : "Edit Library details"}
          </h2>
          ${closeButton(() => this.close())}
        </div>
        ${this.error ? html`<p class="error" role="alert">${this.error}</p>` : nothing}
        ${this.busy ? html`<p role="status">${this.pending ? "Saving changes…" : "Loading details…"}</p>` : nothing}
        ${
          this.review && this.reviewingEdits
            ? this.renderEdits()
            : this.review && this.restoring
              ? html`<p class="warning">
                    Restore scanned metadata for every matching version,
                    including unavailable versions. This clears saved edit
                    history, metadata selections and other fields listed below
                    from the local database.
                  </p>
                  ${
                    this.review.restore_summary
                      ? html`
                          <p>
                            The following fields will be cleared on each
                            version:
                          </p>
                          ${this.review.restore_summary.versions.map(
                            (version, index) => html`
                              <section class="restore-version">
                                <h3>
                                  Version ${index + 1}:
                                  ${version.edition}${version.available ? "" : " (unavailable)"}
                                </h3>
                                ${
                                  version.removed_fields.length
                                    ? html`<ul>
                                        ${version.removed_fields.map((field) => html`<li>${field}</li>`)}
                                      </ul>`
                                    : html`<p class="muted">
                                        No fields to clear.
                                      </p>`
                                }
                                ${version.pause_scraping ? html`<p>Background scraping will be paused for this version.</p>` : html`<p>Background scraping is already paused.</p>`}
                              </section>
                            `,
                          )}
                          <p>
                            The Library and database revision counters will
                            advance, and a restore request record will be saved
                            for safe retries.
                          </p>
                          <p>
                            Scanned metadata, cached image files, cover artwork
                            links, purchase records, and Journal entries will be
                            retained. Background scraping stays paused until you
                            explicitly scrape and apply data again.
                          </p>
                        `
                      : html`<p class="error">
                          The restore summary is unavailable. Reload details
                          before restoring.
                        </p>`
                  }`
              : this.review
                ? html`<p class="muted">
                      ${this.purchaseOnly ? "Saved purchase details appear for the whole movie group." : html`Display details apply to ${counted(this.review.version_count, "version")}; format badges apply only to the selected version. Changes survive scans. Source IDs, runtime, purchases and viewing records are protected. Enter one name per line for credits and genres.`}
                    </p>
                    <div class="edit-fields">
                      ${this.fields().map(
                        ([key, label]) =>
                          html`<label
                            >${label}${this.editedFields().some(([field]) => field === key) ? html` <span class="edited-note">(edited)</span>` : nothing}${
                              LISTS.has(key) || key === "synopsis"
                                ? html`<textarea
                                    name=${key}
                                    .value=${this.draft[key] ?? ""}
                                    ?disabled=${!!this.pending || this.busy}
                                    @input=${(e: Event) => {
                                      this.restoredFields.delete(key);
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
                                      this.restoredFields.delete(key);
                                      this.draft[key] = (
                                        e.target as HTMLInputElement
                                      ).value;
                                      this.requestUpdate();
                                    }}
                                  />`
                            }</label
                          >`,
                      )}
                      ${
                        !this.purchaseOnly
                          ? html`<fieldset>
                              <legend>Format badges · selected version</legend>
                              <p class="muted">
                                Choose the badges shown for this version.
                                Automatic Store matches use compatible editions;
                                HD audio is never inferred from a higher-quality
                                listing.
                              </p>
                              <div class="format-options">
                                ${EDITABLE_FORMATS.map(
                                  (name) =>
                                    html`<label>
                                      <input
                                        type="checkbox"
                                        name="format_badge"
                                        value=${name}
                                        .checked=${this.formatBadges.includes(name)}
                                        ?disabled=${!!this.pending || this.busy}
                                        @change=${(event: Event) => {
                                          const checked = (
                                            event.target as HTMLInputElement
                                          ).checked;
                                          this.formatBadges =
                                            EDITABLE_FORMATS.filter((badge) =>
                                              badge === name
                                                ? checked
                                                : this.formatBadges.includes(
                                                    badge,
                                                  ),
                                            );
                                          this.formatMode = "custom";
                                          this.requestUpdate();
                                        }}
                                      />
                                      ${renderFormatBadges({ formats: [name] })}
                                    </label>`,
                                )}
                              </div>
                              <p class="muted">
                                Source:
                                ${this.formatMode === "original" ? "Server scan only" : this.formatMode === "custom" ? "Manual selection" : "Server scan and compatible Store data"}
                              </p>
                              <div class="actions">
                                <button
                                  type="button"
                                  ?disabled=${!!this.pending || this.busy}
                                  @click=${() => {
                                    this.formatMode = "original";
                                    this.formatBadges = EDITABLE_FORMATS.filter(
                                      (name) =>
                                        this.review?.scanned_format_badges?.includes(
                                          name,
                                        ),
                                    );
                                    this.requestUpdate();
                                  }}
                                >
                                  Restore server formats
                                </button>
                                <button
                                  type="button"
                                  ?disabled=${!!this.pending || this.busy}
                                  @click=${() => {
                                    this.formatMode = "auto";
                                    this.formatBadges = EDITABLE_FORMATS.filter(
                                      (name) =>
                                        this.review?.automatic_format_badges?.includes(
                                          name,
                                        ),
                                    );
                                    this.requestUpdate();
                                  }}
                                >
                                  Use automatic matches
                                </button>
                              </div>
                              <p class="muted">
                                Choose Save changes to apply the selected format
                                source.
                              </p>
                            </fieldset>`
                          : nothing
                      }
                      ${
                        this.purchaseOnly
                          ? html`
                              <label class="check"
                                ><input
                                  name="purchase_information_unavailable"
                                  type="checkbox"
                                  .checked=${this.draft.purchase_information_unavailable === "true"}
                                  ?disabled=${!!this.pending || this.busy}
                                  @change=${(e: Event) => {
                                    this.draft.purchase_information_unavailable =
                                      String(
                                        (e.target as HTMLInputElement).checked,
                                      );
                                    this.requestUpdate();
                                  }}
                                />Purchase information unavailable</label
                              >
                              <p class="muted">
                                These details appear for the movie group. The
                                unavailable option applies to the whole movie.
                              </p>
                            `
                          : nothing
                      }
                    </div>`
                : nothing
        }
        <div class="dialog-footer">
          <button ?disabled=${this.busy || !!this.pending} @click=${this.close}>
            Cancel
          </button>
          ${
            this.review &&
            !this.purchaseOnly &&
            !this.restoring &&
            !this.reviewingEdits &&
            !this.pending
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
          ${
            this.review && !this.purchaseOnly && !this.restoring
              ? html`<button
                  type="button"
                  ?disabled=${this.busy || !!this.pending}
                  @click=${() => {
                    this.reviewingEdits = !this.reviewingEdits;
                    this.requestUpdate();
                  }}
                >
                  ${this.reviewingEdits ? "Back to editing" : "Review Edits"}
                </button>`
              : nothing
          }
          ${this.error && !this.pending ? html`<button ?disabled=${this.busy} @click=${this.open}>Reload details</button>` : nothing}
          <button
            class=${this.restoring ? "danger" : "primary"}
            ?disabled=${this.busy || !this.review || (this.restoring && !this.review.restore_summary) || (!this.pending && !this.restoring && !Object.keys(this.patch()).length)}
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
