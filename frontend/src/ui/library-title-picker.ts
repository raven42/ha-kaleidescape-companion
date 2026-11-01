/** Shared, bounded Library autocomplete; typed text never establishes identity. */
import { LitElement, html, nothing } from "lit";
import type { PropertyValues } from "lit";
import type { JournalClient, LibraryTitle, Scope } from "../core/api";
import { errorCode, errorMessage } from "../core/api";
import { styles } from "./styles";
import { libraryStyles } from "../library/styles";
import { renderFormatBadges, renderRatingBadge } from "../library/badges";

export interface TitleSelection {
  query: string;
  movie: LibraryTitle | null;
}

export class LibraryTitlePicker extends LitElement {
  static properties = {
    client: { attribute: false },
    scope: { attribute: false },
    value: { type: String },
    initialTitle: { type: String },
    requireRuntime: { type: Boolean },
    disabled: { type: Boolean },
    fuzzySearch: { attribute: false },
  };
  static styles = [styles, libraryStyles];
  client?: JournalClient;
  scope?: Scope;
  value = "";
  initialTitle = "";
  requireRuntime = true;
  disabled = false;
  fuzzySearch = true;
  private query = "";
  private items: LibraryTitle[] = [];
  private selected?: LibraryTitle;
  private open = false;
  private active = 0;
  private error = "";
  private timer?: ReturnType<typeof setTimeout>;
  private request = 0;
  private bound = "";
  private boundClient?: JournalClient;
  protected willUpdate(changed: PropertyValues) {
    let rebound = false;
    if (changed.has("client") || changed.has("scope")) {
      const key = `${this.scope?.entry_id}:${this.scope?.dataset_id}`;
      if (key !== this.bound || this.client !== this.boundClient) {
        this.clear();
        this.bound = key;
        this.boundClient = this.client;
        rebound = true;
      }
    }
    if (changed.has("initialTitle")) this.clear();
    if (changed.has("fuzzySearch") && !rebound && !this.selected && this.query)
      this.search(this.query);
    if (
      changed.has("value") &&
      this.selected &&
      this.selected.id !== this.value
    )
      this.clear();
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    this.clear();
    this.bound = "";
    this.boundClient = undefined;
  }
  private clear() {
    clearTimeout(this.timer);
    this.request++;
    this.items = [];
    this.selected = undefined;
    this.query = this.initialTitle;
    this.open = false;
    this.error = "";
  }
  private change() {
    this.dispatchEvent(
      new CustomEvent<TitleSelection>("title-selection", {
        detail: { query: this.query, movie: this.selected ?? null },
        bubbles: true,
        composed: true,
      }),
    );
  }
  private search(value: string) {
    if (this.disabled || !this.client || !this.scope) return;
    this.query = value;
    this.selected = undefined;
    this.items = [];
    this.open = true;
    this.active = 0;
    this.error = "";
    this.change();
    clearTimeout(this.timer);
    const request = ++this.request;
    this.timer = setTimeout(async () => {
      try {
        const page = await this.client!.librarySearch(
          this.scope!,
          value,
          this.fuzzySearch,
        );
        if (request === this.request && this.isConnected) {
          this.items = page.items as LibraryTitle[];
          this.requestUpdate();
        }
      } catch (error) {
        if (request === this.request) {
          this.error = errorMessage(error);
          this.requestUpdate();
          if (errorCode(error) === "unauthorized")
            this.dispatchEvent(
              new CustomEvent("access-denied", {
                bubbles: true,
                composed: true,
              }),
            );
        }
      }
    }, 200);
    this.requestUpdate();
  }
  private choose(item: LibraryTitle) {
    if (this.disabled || (this.requireRuntime && !item.duration_seconds))
      return;
    this.selected = item;
    this.query = item.title;
    this.open = false;
    this.items = [];
    this.change();
    this.requestUpdate();
  }
  protected render() {
    return html`<fieldset ?disabled=${this.disabled}>
      <div class="manual-picker">
        <label
          >Movie from Library<input
            name="library_movie"
            maxlength="100"
            type="search"
            role="combobox"
            autocomplete="off"
            aria-autocomplete="list"
            aria-expanded=${this.open && !!this.items.length}
            aria-controls="movie-suggestions"
            aria-activedescendant=${this.open && this.items[this.active] ? `movie-option-${this.active}` : nothing}
            .value=${this.query}
            @input=${(event: Event) => this.search((event.target as HTMLInputElement).value)}
            @focus=${() => {
              if (!this.selected) this.search(this.query);
            }}
            @blur=${() => {
              this.open = false;
              this.requestUpdate();
            }}
            @keydown=${(event: KeyboardEvent) => {
              if (event.key === "Escape") {
                this.open = false;
                this.requestUpdate();
              } else if (
                ["ArrowDown", "ArrowUp"].includes(event.key) &&
                this.items.length
              ) {
                event.preventDefault();
                this.active =
                  (this.active +
                    (event.key === "ArrowDown" ? 1 : -1) +
                    this.items.length) %
                  this.items.length;
                this.open = true;
                this.requestUpdate();
              } else if (
                ["Enter", "Tab"].includes(event.key) &&
                this.open &&
                this.items[this.active]
              ) {
                event.preventDefault();
                this.choose(this.items[this.active]);
              }
            }}
        /></label>
        ${this.open ? html`<div class="movie-suggestions" id="movie-suggestions" role="listbox">${this.items.map((item, index) => html`<button type="button" role="option" id=${`movie-option-${index}`} aria-selected=${this.active === index} ?disabled=${this.requireRuntime && !item.duration_seconds} @pointerdown=${(event: PointerEvent) => event.preventDefault()} @click=${() => this.choose(item)}><strong>${item.title}</strong> · ${item.year ?? "Year unknown"} · ${(item.formats?.length ? item.formats : [item.edition]).filter(Boolean).join(", ")} · ${item.duration_seconds ? `${(item.duration_seconds / 60).toFixed(2)} min` : "Runtime unknown"}</button>`)}${!this.items.length ? html`<small>Type a title; only cached Library movies can be selected.</small>` : nothing}</div>` : nothing}
      </div>
      ${this.error ? html`<p class="error" role="alert">${this.error}</p>` : nothing}
      ${this.selected ? html`<p class="manual-metadata">${this.selected.year ?? ""} ${renderFormatBadges(this.selected)} ${renderRatingBadge(this.selected.rating)} · ${((this.selected.duration_seconds ?? 0) / 60).toFixed(2)} min</p>` : nothing}
    </fieldset>`;
  }
}
if (!customElements.get("kaleidescape-library-title-picker"))
  customElements.define(
    "kaleidescape-library-title-picker",
    LibraryTitlePicker,
  );
