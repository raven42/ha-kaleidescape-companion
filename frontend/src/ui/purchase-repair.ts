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

const FIELDS = [
  ["title", "Receipt title"],
  ["purchased_on", "Purchase date"],
  ["purchase_price", "Purchase price"],
  ["retail_price", "Retail price"],
  ["order_id", "Transaction ID"],
  ["href", "Store link"],
] as const;

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
        border: 1px solid var(--line);
        border-radius: 10px;
        padding: 1rem;
        margin-block: 1rem;
      }
      .fields {
        display: grid;
        gap: 0.7rem;
      }
      pre {
        max-height: 18rem;
        overflow: auto;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
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
  private close() {
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
  private async preview() {
    if (!this.client || !this.scope || this.busy) return;
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
      <h3>${this.reverse ? "Reverse purchase repair" : "Repair purchase"}</h3>
      <p>
        Review the invoice, its Library association and totals before applying a
        change. Similar purchases may be legitimate separate transactions.
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
                                        ?disabled=${this.busy}
                                        @input=${(event: Event) => {
                                          this.draft[key] = (
                                            event.target as HTMLInputElement
                                          ).value;
                                        }}
                                    /></label>
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
              <h4>Current purchase and Library association</h4>
              <pre>
${JSON.stringify({ purchase: this.review.before, library: this.review.before_library }, null, 2)}</pre>
              <h4>After this change</h4>
              <pre>
${JSON.stringify({ purchase: this.review.after, library: this.review.after_library }, null, 2)}</pre>
              <h4>Library totals before and after</h4>
              <pre>${JSON.stringify(this.review.totals_change, null, 2)}</pre>
              <label
                ><input
                  type="checkbox"
                  .checked=${this.confirmed}
                  ?disabled=${this.busy || !!this.pending}
                  @change=${(event: Event) => {
                    this.confirmed = (event.target as HTMLInputElement).checked;
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
    `;
  }
}
if (!customElements.get("kaleidescape-purchase-repair"))
  customElements.define(
    "kaleidescape-purchase-repair",
    KaleidescapePurchaseRepair,
  );
