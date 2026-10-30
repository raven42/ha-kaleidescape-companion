/** Review-scoped completion for a purchase's explicitly chosen Library movie. */
import { LitElement, css, html, nothing } from "lit";
import { errorCode, errorMessage } from "../core/api";
import type {
  ImportMatchTitle,
  ImportReview,
  ImportReviewRow,
  JournalClient,
  JournalInfo,
} from "../core/api";
import { counted } from "../core/text";
import { styles } from "./styles";

export class KaleidescapeImportMatcher extends LitElement {
  static properties = {
    client: { attribute: false },
    scope: { attribute: false },
    review: { attribute: false },
    row: { attribute: false },
    disabled: { type: Boolean },
  };
  static styles = [
    styles,
    css`
      :host {
        display: block;
        border: 1px solid var(--line);
        border-radius: 10px;
        padding: 16px;
        margin-block: 16px;
      }
      h3 {
        margin-top: 0;
      }
      .suggestions {
        list-style: none;
        padding: 0;
        margin: 8px 0;
        max-height: 240px;
        overflow: auto;
      }
      .suggestions button {
        width: 100%;
        text-align: left;
        margin-block: 2px;
      }
      .suggestions button[aria-selected="true"] {
        border-color: var(--accent);
      }
      small {
        display: block;
      }
      .actions {
        justify-content: flex-end;
      }
    `,
  ];
  client?: JournalClient;
  scope?: JournalInfo;
  review?: ImportReview;
  row?: ImportReviewRow;
  disabled = false;
  private bound = "";
  private boundClient?: JournalClient;
  private request = 0;
  private timer?: ReturnType<typeof setTimeout>;
  private query = "";
  private items: ImportMatchTitle[] = [];
  private active = -1;
  private loading = false;
  private more = false;
  private error = "";
  protected willUpdate() {
    const key = `${this.scope?.entry_id}:${this.scope?.dataset_id}:${this.review?.plan_id}:${this.row?.key}`;
    if (key === this.bound && this.client === this.boundClient) return;
    this.bound = key;
    this.boundClient = this.client;
    this.reset();
    this.query = this.row?.title.slice(0, 100) ?? "";
    if (this.client && this.scope && this.review && this.row)
      void this.search();
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    this.reset();
    this.bound = "";
    this.boundClient = undefined;
  }
  async focusSearch() {
    await this.updateComplete;
    if (this.isConnected)
      this.renderRoot.querySelector<HTMLInputElement>("input")?.focus();
  }
  private reset() {
    clearTimeout(this.timer);
    this.request++;
    this.query = "";
    this.items = [];
    this.active = -1;
    this.loading = false;
    this.more = false;
    this.error = "";
  }
  private async search() {
    if (
      !this.client ||
      !this.scope ||
      !this.review ||
      !this.row ||
      this.disabled
    )
      return;
    const request = ++this.request;
    this.loading = true;
    this.error = "";
    this.requestUpdate();
    try {
      const result = await this.client.searchImportMatches(
        this.scope,
        this.review,
        this.row.key,
        this.query,
      );
      if (request !== this.request || !this.isConnected) return;
      this.items = result.items;
      this.more = result.has_more;
    } catch (error) {
      if (request !== this.request || !this.isConnected) return;
      this.error = errorMessage(error);
      if (errorCode(error) === "unauthorized")
        this.dispatchEvent(
          new CustomEvent("access-denied", { bubbles: true, composed: true }),
        );
    } finally {
      if (request === this.request) {
        this.loading = false;
        this.requestUpdate();
      }
    }
  }
  private choose(id: string | null) {
    if (!this.disabled)
      this.dispatchEvent(
        new CustomEvent("match-choice", {
          detail: id,
          bubbles: true,
          composed: true,
        }),
      );
  }
  private cancel() {
    if (!this.disabled)
      this.dispatchEvent(
        new CustomEvent("match-cancel", { bubbles: true, composed: true }),
      );
  }
  private key(event: KeyboardEvent) {
    if (this.disabled) return;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      this.cancel();
    }
    if (["ArrowDown", "ArrowUp"].includes(event.key) && this.items.length) {
      event.preventDefault();
      this.active =
        this.active < 0
          ? event.key === "ArrowDown"
            ? 0
            : this.items.length - 1
          : (this.active +
              (event.key === "ArrowDown" ? 1 : -1) +
              this.items.length) %
            this.items.length;
      this.requestUpdate();
      void this.updateComplete.then(() =>
        this.renderRoot
          .querySelector<HTMLElement>(`#purchase-match-${this.active}`)
          ?.scrollIntoView?.({ block: "nearest" }),
      );
    }
    if (event.key === "Enter" && this.active >= 0) {
      event.preventDefault();
      this.choose(this.items[this.active].id);
    }
  }
  protected render() {
    return html`<h3>Match purchase: ${this.row?.title}</h3>
      <label
        >Find a Library movie<input
          type="search"
          role="combobox"
          aria-autocomplete="list"
          aria-controls="purchase-matches"
          aria-expanded=${!!this.items.length}
          aria-activedescendant=${this.active >= 0 ? `purchase-match-${this.active}` : nothing}
          maxlength="100"
          .value=${this.query}
          ?disabled=${this.disabled}
          @keydown=${this.key}
          @input=${(event: Event) => {
            this.query = (event.target as HTMLInputElement).value;
            clearTimeout(this.timer);
            this.request++;
            this.items = [];
            this.active = -1;
            this.more = false;
            this.error = "";
            this.timer = setTimeout(() => void this.search(), 250);
            this.requestUpdate();
          }}
      /></label>
      ${this.loading ? html`<p role="status">Searching cached Library…</p>` : nothing}
      ${
        this.error
          ? html`<p class="error" role="alert">${this.error}</p>
              <button ?disabled=${this.disabled} @click=${() => this.search()}>
                Retry search
              </button>`
          : nothing
      }
      <ul
        id="purchase-matches"
        class="suggestions"
        role="listbox"
        aria-label="Matching Library movies"
      >
        ${this.items.map(
          (item, index) =>
            html`<li role="presentation">
              <button
                role="option"
                id=${`purchase-match-${index}`}
                aria-selected=${this.active === index}
                ?disabled=${this.disabled}
                @click=${() => this.choose(item.id)}
              >
                ${item.title} · ${item.year ?? "Year unknown"}<small
                  >${item.directors.join(", ") || "Director unknown"} ·
                  ${counted(item.version_count, "version")} · Source
                  ${item.source_hint}</small
                >
              </button>
            </li>`,
        )}
      </ul>
      ${!this.loading && !this.error && !this.items.length ? html`<p class="muted">No matching titles. Try part of the Library title.</p>` : nothing}
      ${this.more ? html`<p class="muted">Showing 20 movies. Refine the search for more specific results.</p>` : nothing}
      <div class="actions">
        <button ?disabled=${this.disabled} @click=${this.cancel}>
          Cancel match</button
        ><button ?disabled=${this.disabled} @click=${() => this.choose(null)}>
          Clear match
        </button>
      </div>`;
  }
}
if (!customElements.get("kaleidescape-import-matcher"))
  customElements.define(
    "kaleidescape-import-matcher",
    KaleidescapeImportMatcher,
  );
