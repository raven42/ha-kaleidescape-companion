/** Schema-aware predicate completion and validation; never sends executable SQL. */
import { LitElement, html, nothing, css } from "lit";
import type { PropertyValues } from "lit";
import { errorCode, errorMessage } from "../core/api";
import type { JournalClient, Scope } from "../core/api";

export class DatabaseSearch extends LitElement {
  static properties = {
    client: { attribute: false },
    scope: { attribute: false },
    table: {},
    value: {},
    fields: { attribute: false },
    operators: { attribute: false },
    disabled: { type: Boolean },
  };
  static styles = css`
    :host {
      display: block;
      min-width: 0;
      flex: 1;
    }
    label {
      display: grid;
      gap: 6px;
      font: inherit;
    }
    input {
      font: inherit;
      color: inherit;
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 10px;
      width: 100%;
      box-sizing: border-box;
    }
    .search {
      position: relative;
    }
    .suggestions {
      position: absolute;
      z-index: 20;
      inset-inline: 0;
      top: 100%;
      max-height: 220px;
      overflow: auto;
      background: var(--surface);
      border: 1px solid var(--line);
      box-shadow: 0 4px 12px #0004;
      display: grid;
    }
    button {
      font: inherit;
      padding: 8px;
      text-align: left;
      color: inherit;
      background: transparent;
      border: 0;
    }
    button[aria-selected="true"] {
      background: var(--line);
    }
    small {
      display: block;
      margin-top: 5px;
      color: var(--muted);
    }
    .error {
      color: var(--error-color, #b3261e);
    }
  `;
  client?: JournalClient;
  scope?: Scope;
  table = "viewings";
  value = "";
  fields: { name: string; type: string }[] = [];
  operators: string[] = [];
  disabled = false;
  private open = false;
  private active = 0;
  private cursor = 0;
  private message = "";
  private invalid = false;
  private timer?: ReturnType<typeof setTimeout>;
  private generation = 0;
  disconnectedCallback() {
    super.disconnectedCallback();
    clearTimeout(this.timer);
    this.generation++;
    this.open = false;
  }
  protected willUpdate(changed: PropertyValues) {
    if (["client", "scope", "table"].some((key) => changed.has(key))) {
      clearTimeout(this.timer);
      this.generation++;
      this.message = "";
      this.invalid = false;
      this.open = false;
    }
  }
  private choices() {
    const prefix = this.value.slice(0, this.cursor);
    if ((prefix.match(/'/g)?.length ?? 0) % 2) return [];
    const tail = prefix.match(/[A-Za-z_0-9.<>!=]*$/)?.[0] ?? "";
    const before = prefix.slice(0, prefix.length - tail.length).trim();
    let options: string[];
    if (!before || /(?:\bAND|\bOR|\bNOT|\bWHERE|\()$/i.test(before))
      options = this.fields.map((field) => field.name);
    else if (
      this.fields.some((field) =>
        before.toLowerCase().endsWith(field.name.toLowerCase()),
      )
    )
      options = this.operators;
    else if (/(?:NULL|'|\d|TRUE|FALSE)$/i.test(before)) options = ["AND", "OR"];
    else options = ["''", "0", "TRUE", "FALSE"];
    return options
      .filter((option) => option.toLowerCase().startsWith(tail.toLowerCase()))
      .slice(0, 12);
  }
  private changed() {
    this.dispatchEvent(
      new CustomEvent("query-change", {
        detail: this.value,
        bubbles: true,
        composed: true,
      }),
    );
    clearTimeout(this.timer);
    const generation = ++this.generation;
    this.timer = setTimeout(async () => {
      try {
        await this.client?.validateDatabaseQuery(
          this.scope!,
          this.table,
          this.value,
        );
        if (generation === this.generation) {
          this.message = "";
          this.invalid = false;
        }
      } catch (error) {
        if (generation !== this.generation) return;
        this.invalid = true;
        this.message =
          errorCode(error) === "query_syntax" &&
          typeof (error as { message?: string }).message === "string"
            ? (error as { message: string }).message
            : errorMessage(error);
        if (errorCode(error) === "unauthorized")
          this.dispatchEvent(
            new CustomEvent("access-denied", { bubbles: true, composed: true }),
          );
      } finally {
        if (generation === this.generation) this.requestUpdate();
      }
    }, 250);
    this.requestUpdate();
  }
  private choose(option: string) {
    const prefix = this.value.slice(0, this.cursor),
      tail = prefix.match(/[A-Za-z_0-9.<>!=]*$/)?.[0] ?? "";
    const start = this.cursor - tail.length;
    this.value =
      this.value.slice(0, start) + option + " " + this.value.slice(this.cursor);
    this.cursor = start + (option === "''" ? 1 : option.length + 1);
    this.active = 0;
    this.changed();
    void this.updateComplete.then(() => {
      const input = this.renderRoot.querySelector("input")!;
      input.focus();
      input.setSelectionRange(this.cursor, this.cursor);
    });
  }
  protected render() {
    const choices = this.choices();
    return html`<div class="search">
        <label
          >Search rows / conditions<input
            name="database_query"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded=${this.open && !!choices.length}
            aria-controls="query-suggestions"
            aria-activedescendant=${this.open && choices.length ? `query-option-${this.active}` : nothing}
            aria-invalid=${this.invalid}
            aria-describedby="query-help"
            maxlength="2000"
            autocomplete="off"
            .value=${this.value}
            ?disabled=${this.disabled}
            @focus=${() => {
              this.open = true;
              this.requestUpdate();
            }}
            @blur=${() => {
              this.open = false;
              this.requestUpdate();
            }}
            @click=${(event: Event) => {
              this.cursor =
                (event.target as HTMLInputElement).selectionStart ??
                this.value.length;
              this.open = true;
              this.requestUpdate();
            }}
            @input=${(event: Event) => {
              const input = event.target as HTMLInputElement;
              this.value = input.value;
              this.cursor = input.selectionStart ?? input.value.length;
              this.active = 0;
              this.open = true;
              this.changed();
            }}
            @keydown=${(event: KeyboardEvent) => {
              if (event.key === "Escape") {
                this.open = false;
                this.requestUpdate();
              } else if (
                (event.key === "ArrowDown" || event.key === "ArrowUp") &&
                choices.length
              ) {
                event.preventDefault();
                this.open = true;
                this.active =
                  (this.active +
                    (event.key === "ArrowDown" ? 1 : -1) +
                    choices.length) %
                  choices.length;
                this.requestUpdate();
              } else if (event.key === "Tab" && this.open && choices.length) {
                event.preventDefault();
                this.choose(choices[this.active] ?? choices[0]);
              } else if (event.key === "Enter") {
                event.preventDefault();
                this.open = false;
                this.dispatchEvent(
                  new CustomEvent("query-submit", {
                    bubbles: true,
                    composed: true,
                  }),
                );
                this.requestUpdate();
              }
            }} /></label
        >${this.open && choices.length ? html`<div class="suggestions" id="query-suggestions" role="listbox">${choices.map((choice, index) => html`<button type="button" role="option" id=${`query-option-${index}`} aria-selected=${this.active === index} tabindex="-1" @mousedown=${(event: MouseEvent) => event.preventDefault()} @click=${() => this.choose(choice)}>${choice}</button>`)}</div>` : nothing}
      </div>
      <small id="query-help" class=${this.invalid ? "error" : ""} role="status"
        >${this.message || "Text searches every column. Conditions: purchased_on IS NULL · actors CONTAINS 'name' · title LIKE 'Star%'. Tab accepts a suggestion; Enter searches."}</small
      >`;
  }
}
if (!customElements.get("kaleidescape-database-search"))
  customElements.define("kaleidescape-database-search", DatabaseSearch);
