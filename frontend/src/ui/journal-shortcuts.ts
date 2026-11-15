/** Compact list commands; actions remain owned by the Journal host. */
import { LitElement, css, html, nothing } from "lit";
import { styles } from "./styles";
import { actionIcon } from "./action-icons";

export class JournalShortcuts extends LitElement {
  static properties = {
    disabled: { type: Boolean },
    allowAdd: { type: Boolean },
    filtered: { type: Boolean },
    filterLabel: {},
    count: { type: Number },
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
        gap: 6px;
        padding: 6px 8px;
      }
      h2 {
        flex: 1;
        min-width: 0;
        margin: 0;
        font-size: 16px;
        white-space: nowrap;
      }
      .shortcuts button {
        width: 40px;
        height: 40px;
        min-height: 40px;
        padding: 8px;
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
      @media (max-width: 700px) {
        :host {
          display: block;
        }
      }
    `,
  ];
  disabled = false;
  allowAdd = false;
  filtered = false;
  filterLabel = "";
  count = 0;
  private signal(name: string) {
    if (!this.disabled)
      this.dispatchEvent(
        new CustomEvent(name, { bubbles: true, composed: true }),
      );
  }
  protected render() {
    return html`<div
      class="shortcuts"
      role="toolbar"
      aria-label="Journal shortcuts"
    >
      <h2>Viewings (${this.count})</h2>
      ${this.allowAdd ? html`<button type="button" aria-label="Add viewing" title="Add viewing" ?disabled=${this.disabled} @click=${() => this.signal("journal-add")}>${actionIcon("add")}</button>` : nothing}
      ${this.filterLabel ? html`<button type="button" aria-label="Show all viewings" title="Show all viewings" ?disabled=${this.disabled} @click=${() => this.signal("journal-clear-movie")}>All</button>` : nothing}
      <button
        type="button"
        aria-label="Refresh Journal"
        title="Refresh Journal"
        ?disabled=${this.disabled}
        @click=${() => this.signal("journal-refresh")}
      >
        ${actionIcon("refresh")}
      </button>
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
    </div>`;
  }
}
if (!customElements.get("kaleidescape-journal-shortcuts"))
  customElements.define("kaleidescape-journal-shortcuts", JournalShortcuts);
