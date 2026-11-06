/** Administrator-only reviewed correction, void, and reversal of purchases. */
import { LitElement, css, html, nothing } from "lit";
import { errorCode, errorMessage } from "../core/api";
import type {
  JournalClient,
  JournalInfo,
  LibraryTitle,
  PreparedMutation,
  PurchaseRepairReview,
} from "../core/api";
import { styles } from "./styles";
import { closeButton, dismissBackdrop } from "./dialog";

const FIELDS = [
  ["title", "Receipt title"],
  ["purchased_on", "Purchase date"],
  ["purchase_price", "Purchase price"],
  ["retail_price", "Retail price"],
  ["order_id", "Transaction ID"],
  ["href", "Store link"],
] as const;

function flatten(value: unknown, prefix = ""): Record<string, unknown> {
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).flatMap(([key, child]) =>
        Object.entries(flatten(child, prefix ? `${prefix}.${key}` : key)),
      ),
    );
  }
  return prefix ? { [prefix]: value } : {};
}

function displayValue(value: unknown): string {
  if (value === undefined) return "—";
  if (value === null) return "null";
  return typeof value === "string" ? value : JSON.stringify(value);
}

function comparison(title: string, before: unknown, after: unknown) {
  const left = flatten(before);
  const right = flatten(after);
  const keys = [...new Set([...Object.keys(left), ...Object.keys(right)])];
  return html`<h4>${title}</h4>
    <div class="diff" role="table" aria-label=${title}>
      <div class="diff-row" role="row">
        <strong role="columnheader">Field</strong>
        <strong role="columnheader">Before</strong>
        <strong role="columnheader">After</strong>
      </div>
      ${
        keys.length
          ? keys.map((key) => {
              const changed =
                JSON.stringify(left[key]) !== JSON.stringify(right[key]);
              const label = FIELDS.find(([field]) => field === key)?.[1] ?? key;
              return html`<div
                class=${changed ? "diff-row changed" : "diff-row"}
                role="row"
              >
                <span role="rowheader"
                  >${label}${changed ? " (changed)" : ""}</span
                >
                <span class="before" role="cell"
                  >${displayValue(left[key])}</span
                >
                <span class="after" role="cell"
                  >${displayValue(right[key])}</span
                >
              </div>`;
            })
          : html`<p>No values to compare.</p>`
      }
    </div>`;
}

export class KaleidescapePurchaseRepair extends LitElement {
  static properties = {
    client: { attribute: false },
    scope: { attribute: false },
    row: { attribute: false },
    token: { type: String },
    reverse: { type: Boolean },
  };
  static styles = [
    styles,
    css`
      :host {
        display: block;
      }
      dialog {
        width: min(1000px, calc(100% - 24px));
      }
      .fields {
        display: grid;
        gap: 0.7rem;
      }
      .diff {
        overflow-x: auto;
        border: 1px solid var(--line);
        border-radius: 6px;
      }
      .diff-row {
        display: grid;
        grid-template-columns: minmax(9rem, 1fr) minmax(13rem, 2fr) minmax(
            13rem,
            2fr
          );
        min-width: 35rem;
      }
      .diff-row > * {
        padding: 0.5rem;
        border-bottom: 1px solid var(--line);
        overflow-wrap: anywhere;
        white-space: pre-wrap;
      }
      .diff-row.changed .before {
        background: rgba(190, 45, 45, 0.2);
        border-left: 3px solid #c64141;
      }
      .diff-row.changed .after {
        background: rgba(36, 145, 76, 0.2);
        border-left: 3px solid #319653;
      }
      .search-results {
        max-height: 16rem;
        overflow: auto;
      }
    `,
  ];
  client?: JournalClient;
  scope?: JournalInfo;
  row: Record<string, unknown> = {};
  token = "";
  reverse = false;
  private action: "correct" | "void" = "correct";
  private draft: Record<string, string> = {};
  private query = "";
  private results: LibraryTitle[] = [];
  private owner: string | null = null;
  private ownerLabel = "";
  private review?: PurchaseRepairReview;
  private pending?: PreparedMutation;
  private confirmed = false;
  private busy = false;
  private error = "";
  private fieldErrors: Record<string, string> = {};
  private generation = 0;

  connectedCallback() {
    super.connectedCallback();
    this.draft = Object.fromEntries(
      FIELDS.map(([key]) => [key, String(this.row[key] ?? "")]),
    );
    this.owner =
      typeof this.row.library_id === "string" ? this.row.library_id : null;
    this.ownerLabel = this.owner ? "Current Library entry" : "Unlinked";
  }
  protected firstUpdated() {
    this.renderRoot.querySelector<HTMLDialogElement>("dialog")?.showModal();
  }
  disconnectedCallback() {
    this.generation++;
    super.disconnectedCallback();
  }
  confirmNavigation() {
    if (this.busy || this.pending) return false;
    return (
      (!this.review && (this.reverse || !Object.keys(this.changes()).length)) ||
      window.confirm("Discard this purchase repair review?")
    );
  }
  private close(event?: Event) {
    event?.preventDefault();
    if (!this.confirmNavigation()) return;
    this.dispatchEvent(
      new CustomEvent("repair-cancel", { bubbles: true, composed: true }),
    );
  }
  private notifyBusy() {
    this.dispatchEvent(
      new CustomEvent("repair-busy", {
        detail: this.busy || !!this.pending,
        bubbles: true,
        composed: true,
      }),
    );
  }
  private report(error: unknown) {
    this.error = errorMessage(error);
    if (errorCode(error) === "unauthorized") {
      this.pending = undefined;
      this.review = undefined;
      this.dispatchEvent(
        new CustomEvent("access-denied", { bubbles: true, composed: true }),
      );
    }
  }
  private async search() {
    if (!this.client || !this.scope || this.busy) return;
    const generation = ++this.generation;
    this.busy = true;
    this.notifyBusy();
    this.error = "";
    this.requestUpdate();
    try {
      const result = await this.client.librarySearch(
        this.scope,
        this.query,
        false,
      );
      if (generation === this.generation) this.results = result.items;
    } catch (error) {
      if (generation === this.generation) this.report(error);
    } finally {
      if (generation === this.generation) {
        this.busy = false;
        this.notifyBusy();
        this.requestUpdate();
      }
    }
  }
  private changes(): Record<string, unknown> {
    const changes: Record<string, unknown> = {};
    for (const [key] of FIELDS) {
      const value = this.draft[key] || null;
      if (value !== (this.row[key] ?? null)) changes[key] = value;
    }
    if (this.owner !== (this.row.library_id ?? null))
      changes.library_id = this.owner;
    return changes;
  }
  private validate(): boolean {
    const errors: Record<string, string> = {};
    const title = this.draft.title ?? "";
    if (!title.trim()) errors.title = "Enter a receipt title.";
    else if ([...title].length > 500)
      errors.title = "The receipt title must be at most 500 characters.";
    const date = this.draft.purchased_on ?? "";
    const dateInput = this.renderRoot.querySelector<HTMLInputElement>(
      '[name="purchased_on"]',
    );
    if (
      dateInput?.validity.badInput ||
      (date &&
        (date < "1990-01-01" || date > new Date().toISOString().slice(0, 10)))
    )
      errors.purchased_on =
        "Enter a valid date between January 1, 1990 and today (UTC).";
    for (const field of ["purchase_price", "retail_price"]) {
      const value = this.draft[field] ?? "";
      if (
        value &&
        (value.length > 64 ||
          !/^[^\d\s.,+-]{1,8}\s*(?:[0-9]{1,3}(?:,[0-9]{3})+|[0-9]+)\.[0-9]{2}$/u.test(
            value,
          ))
      )
        errors[field] =
          "Enter a nonnegative price with a currency symbol and two decimal places, such as $19.99.";
    }
    const order = this.draft.order_id ?? "";
    if (order && (!order.trim() || [...order].length > 256))
      errors.order_id =
        "Enter a transaction ID of up to 256 characters, or leave it empty.";
    const href = this.draft.href ?? "";
    if (href) {
      let valid =
        href.startsWith("/movie-store/") || href.startsWith("movie-store/");
      try {
        const url = new URL(href);
        valid =
          ["http:", "https:"].includes(url.protocol) &&
          !!url.hostname &&
          !url.username &&
          !url.password;
      } catch {
        /* A Store-relative path is also accepted. */
      }
      if (
        !valid ||
        [...href].length > 2048 ||
        [...href].some((char) => char.charCodeAt(0) < 32)
      )
        errors.href =
          "Enter an HTTP(S) link without credentials or a /movie-store/ path, or leave it empty.";
    }
    this.fieldErrors = errors;
    if (Object.keys(errors).length) {
      this.error =
        "Correct the highlighted fields before reviewing the change.";
      return false;
    }
    if (!Object.keys(this.changes()).length) {
      this.error =
        "Change a purchase field or its Library association before reviewing.";
      return false;
    }
    return true;
  }
  private async preview() {
    if (!this.client || !this.scope || this.busy) return;
    if (!this.reverse && this.action === "correct" && !this.validate()) {
      this.requestUpdate();
      return;
    }
    const generation = ++this.generation;
    this.busy = true;
    this.notifyBusy();
    this.error = "";
    this.requestUpdate();
    try {
      const action = this.reverse ? "reverse" : this.action;
      const key = String(this.reverse ? this.row.request_id : this.row.id);
      const review = await this.client.previewPurchaseRepair(
        this.scope,
        action,
        key,
        this.token,
        action === "correct" ? this.changes() : {},
      );
      if (generation === this.generation) {
        this.review = review;
        this.confirmed = false;
      }
    } catch (error) {
      if (generation === this.generation) this.report(error);
    } finally {
      if (generation === this.generation) {
        this.busy = false;
        this.notifyBusy();
        this.requestUpdate();
      }
    }
  }
  private async apply() {
    if (
      !this.client ||
      !this.scope ||
      !this.review ||
      this.busy ||
      !this.confirmed
    )
      return;
    this.pending ??= this.client.preparePurchaseRepair(this.scope, this.review);
    const generation = ++this.generation;
    this.busy = true;
    this.notifyBusy();
    this.error = "";
    this.requestUpdate();
    try {
      await this.client.applyPurchaseRepair(this.pending);
      if (generation !== this.generation) return;
      this.pending = undefined;
      this.dispatchEvent(
        new CustomEvent("repair-complete", { bubbles: true, composed: true }),
      );
    } catch (error) {
      if (generation !== this.generation) return;
      if (
        ["conflict", "invalid_request", "not_found", "unauthorized"].includes(
          errorCode(error),
        )
      ) {
        this.pending = undefined;
        this.review = undefined;
      }
      this.report(error);
    } finally {
      if (generation === this.generation) {
        this.busy = false;
        this.notifyBusy();
        this.requestUpdate();
      }
    }
  }
  protected render() {
    return html`
      <dialog
        @click=${dismissBackdrop}
        @cancel=${this.close}
        aria-labelledby="repair-heading"
      >
        <div class="card-head">
          <h2 id="repair-heading">
            ${this.reverse ? "Reverse purchase repair" : "Repair purchase"}
          </h2>
          ${closeButton((event) => this.close(event), this.busy || !!this.pending)}
        </div>
        <p>
          Review the invoice, its Library association and totals before applying
          a change. Similar purchases may be legitimate separate transactions.
        </p>
        ${this.error ? html`<p class="error" role="alert">${this.error}</p>` : nothing}
        ${
          !this.review
            ? html`
                ${
                  !this.reverse
                    ? html`
                        <label
                          >Action<select
                            .value=${this.action}
                            ?disabled=${this.busy}
                            @change=${(event: Event) => {
                              this.action = (event.target as HTMLSelectElement)
                                .value as "correct" | "void";
                              this.requestUpdate();
                            }}
                          >
                            <option value="correct">Correct purchase</option>
                            <option value="void">Void purchase</option>
                          </select></label
                        >
                        ${
                          this.action === "correct"
                            ? html`
                                <div class="fields">
                                  ${FIELDS.map(
                                    ([key, label]) => html`
                                      <label
                                        >${label}<input
                                          name=${key}
                                          type=${key === "purchased_on" ? "date" : "text"}
                                          .value=${this.draft[key] ?? ""}
                                          aria-invalid=${this.fieldErrors[key] ? "true" : "false"}
                                          aria-describedby=${this.fieldErrors[key] ? `error-${key}` : nothing}
                                          ?disabled=${this.busy}
                                          @input=${(event: Event) => {
                                            this.draft[key] = (
                                              event.target as HTMLInputElement
                                            ).value;
                                            if (this.fieldErrors[key]) {
                                              delete this.fieldErrors[key];
                                              this.requestUpdate();
                                            }
                                          }}
                                        />${this.fieldErrors[key] ? html`<span class="error" id=${`error-${key}`}>${this.fieldErrors[key]}</span>` : nothing}</label
                                      >
                                    `,
                                  )}
                                </div>
                                <p>Library association: ${this.ownerLabel}</p>
                                <label
                                  >Find a Library movie<input
                                    type="search"
                                    .value=${this.query}
                                    ?disabled=${this.busy}
                                    @input=${(event: Event) => {
                                      this.query = (
                                        event.target as HTMLInputElement
                                      ).value;
                                    }}
                                /></label>
                                <button
                                  type="button"
                                  ?disabled=${this.busy}
                                  @click=${this.search}
                                >
                                  Search Library
                                </button>
                                <button
                                  type="button"
                                  ?disabled=${this.busy}
                                  @click=${() => {
                                    this.owner = null;
                                    this.ownerLabel = "Unlinked";
                                    this.requestUpdate();
                                  }}
                                >
                                  Unlink purchase
                                </button>
                                <div class="search-results">
                                  ${this.results.map(
                                    (item) => html`
                                      <button
                                        type="button"
                                        ?disabled=${this.busy}
                                        @click=${() => {
                                          this.owner = item.id;
                                          this.ownerLabel = item.title;
                                          this.results = [];
                                          this.requestUpdate();
                                        }}
                                      >
                                        ${item.title} ${item.year ?? ""}
                                      </button>
                                    `,
                                  )}
                                </div>
                              `
                            : html`<p class="warning">
                                Voiding removes this invoice from active totals
                                and prevents its identity from being imported
                                again.
                              </p>`
                        }
                      `
                    : nothing
                }
                <div class="actions">
                  <button ?disabled=${this.busy} @click=${this.close}>
                    Cancel</button
                  ><button ?disabled=${this.busy} @click=${this.preview}>
                    Review change
                  </button>
                </div>
              `
            : html`
                ${comparison("Purchase", this.review.before, this.review.after)}
                ${comparison("Library association", this.review.before_library, this.review.after_library)}
                ${comparison(
                  "Library totals",
                  this.review.totals_change.map((entry) => ({
                    source_id: entry.source_id,
                    totals: entry.before,
                  })),
                  this.review.totals_change.map((entry) => ({
                    source_id: entry.source_id,
                    totals: entry.after,
                  })),
                )}
                <label class="check"
                  ><input
                    type="checkbox"
                    .checked=${this.confirmed}
                    ?disabled=${this.busy || !!this.pending}
                    @change=${(event: Event) => {
                      this.confirmed = (
                        event.target as HTMLInputElement
                      ).checked;
                      this.requestUpdate();
                    }}
                  />I reviewed this change and its totals.</label
                >
                <div class="actions">
                  <button
                    ?disabled=${this.busy || !!this.pending}
                    @click=${() => {
                      this.review = undefined;
                      this.requestUpdate();
                    }}
                  >
                    Back
                  </button>
                  <button
                    ?disabled=${this.busy || !this.confirmed}
                    @click=${this.apply}
                  >
                    ${this.pending ? "Retry change" : "Apply reviewed change"}
                  </button>
                </div>
              `
        }
      </dialog>
    `;
  }
}
if (!customElements.get("kaleidescape-purchase-repair"))
  customElements.define(
    "kaleidescape-purchase-repair",
    KaleidescapePurchaseRepair,
  );
