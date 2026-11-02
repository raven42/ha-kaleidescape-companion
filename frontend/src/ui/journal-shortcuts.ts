/** Mobile calendar controls; all reads/mutations stay with the existing host. */
import { LitElement, css, html } from "lit";
import type { PropertyValues } from "lit";
import { styles } from "./styles";
import { actionIcon } from "./action-icons";
import { closeButton, dismissBackdrop } from "./dialog";

export class JournalShortcuts extends LitElement {
  static properties = {
    value: {},
    disabled: { type: Boolean },
    allowAdd: { type: Boolean },
    filtered: { type: Boolean },
    filterLabel: {},
    context: { attribute: false },
    scopeKey: {},
  };
  static styles = [
    styles,
    css`
      :host {
        display: none;
      }
      .shortcuts {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 6px;
        padding: 6px 8px;
      }
      .shortcuts button {
        width: 44px;
        height: 44px;
        min-height: 44px;
        padding: 10px;
        display: grid;
        place-items: center;
        border-radius: 7px;
      }
      .shortcuts svg {
        width: 22px;
        height: 22px;
      }
      .active {
        color: var(--primary-color, #03a9f4);
        border-color: currentColor;
      }
      dialog {
        width: min(380px, calc(100% - 24px));
      }
      @media (max-width: 700px) {
        :host {
          display: block;
        }
      }
    `,
  ];
  value = "";
  disabled = false;
  allowAdd = false;
  filtered = false;
  filterLabel = "";
  context?: object;
  scopeKey = "";
  private draft = "";
  private generation = 0;
  protected willUpdate(changed: PropertyValues) {
    if (changed.has("context") || changed.has("scopeKey")) this.close();
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    this.close();
  }
  private signal(name: string, detail?: string) {
    if (!this.disabled)
      this.dispatchEvent(
        new CustomEvent(name, { detail, bubbles: true, composed: true }),
      );
  }
  private close(event?: Event) {
    event?.preventDefault();
    this.generation++;
    this.draft = "";
    this.renderRoot.querySelector("dialog")?.close();
  }
  private async search() {
    if (this.disabled) return;
    const generation = ++this.generation;
    this.draft = this.value;
    this.requestUpdate();
    await this.updateComplete;
    if (!this.isConnected || generation !== this.generation) return;
    this.renderRoot.querySelector("dialog")?.showModal();
    this.renderRoot.querySelector<HTMLInputElement>("input")?.focus();
  }
  protected render() {
    return html`<div
        class="shortcuts"
        role="toolbar"
        aria-label="Journal calendar shortcuts"
      >
        <button
          type="button"
          aria-label="Search Journal"
          title="Search Journal"
          aria-haspopup="dialog"
          ?disabled=${this.disabled}
          class=${this.value ? "active" : ""}
          @click=${this.search}
        >
          ${actionIcon("search")}
        </button>
        <button
          type="button"
          aria-label="Clear Journal search and filters"
          title="Clear search and filters"
          ?disabled=${this.disabled}
          @click=${() => this.signal("journal-clear")}
        >
          ${actionIcon("clear")}
        </button>
        ${this.allowAdd ? html`<button type="button" aria-label="Add viewing" title="Add viewing" ?disabled=${this.disabled} @click=${() => this.signal("journal-add")}>${actionIcon("add")}</button>` : ""}
        <button
          type="button"
          aria-label="Journal options"
          title="Options"
          aria-haspopup="dialog"
          ?disabled=${this.disabled}
          class=${this.filtered ? "active" : ""}
          @click=${() => this.signal("journal-open-options")}
        >
          ${actionIcon("options")}
        </button>
      </div>
      <dialog
        aria-labelledby="journal-search-title"
        @click=${dismissBackdrop}
        @cancel=${this.close}
      >
        <div class="card-head">
          <h2 id="journal-search-title">Search Journal</h2>
          ${closeButton((event) => this.close(event))}
        </div>
        ${this.filterLabel ? html`<p class="muted">${this.filterLabel}</p>` : ""}
        <form
          @submit=${(event: Event) => {
            event.preventDefault();
            if (this.disabled) return;
            this.signal("journal-search", this.draft);
            this.close();
          }}
        >
          <label
            >Title<input
              name="journal_mobile_search"
              type="search"
              maxlength="500"
              .value=${this.draft}
              @input=${(event: Event) => {
                this.draft = (event.target as HTMLInputElement).value;
              }}
          /></label>
          <div class="dialog-footer">
            <button class="primary" type="submit" ?disabled=${this.disabled}>
              Search
            </button>
          </div>
        </form>
      </dialog>`;
  }
}
if (!customElements.get("kaleidescape-journal-shortcuts"))
  customElements.define("kaleidescape-journal-shortcuts", JournalShortcuts);
