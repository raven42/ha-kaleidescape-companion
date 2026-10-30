/** Exact Library selection for manual viewings; the worker derives all runtime facts. */
import { LitElement, html, nothing } from "lit";
import type { PropertyValues } from "lit";
import type { JournalClient, LibraryTitle, Scope } from "../core/api";
import { errorCode, errorMessage } from "../core/api";
import { styles } from "./styles";
import { libraryStyles } from "../library/styles";
import { localDate } from "./editor";
import { renderFormatBadges, renderRatingBadge } from "../library/badges";

export interface ManualDraft {
  library_title_id: string;
  date: string;
  time: string;
  status: "completed" | "partial";
  watched_minutes: string;
  notes: string;
}
export function manualDraft(): ManualDraft {
  const now = localDate(new Date().toISOString());
  return {
    library_title_id: "",
    date: now.slice(0, 10),
    time: now.slice(11, 16),
    status: "completed",
    watched_minutes: "",
    notes: "",
  };
}
export function manualData(draft: ManualDraft) {
  if (!/^[a-f0-9]{64}$/.test(draft.library_title_id))
    throw new Error("Select a Library movie from the suggestions.");
  const time = draft.time.trim().match(/^(\d{1,2})(?::?(\d{2}))?\s*(am|pm)?$/i);
  if (!time || !/^\d{4}-\d{2}-\d{2}$/.test(draft.date))
    throw new Error("Enter a date and time such as 19:30 or 7:30 PM.");
  let hour = Number(time[1]);
  const minute = Number(time[2] ?? 0),
    meridian = time[3]?.toLowerCase();
  if (minute > 59 || hour > (meridian ? 12 : 23) || (meridian && hour < 1))
    throw new Error("Enter a valid local time.");
  if (meridian) hour = (hour % 12) + (meridian === "pm" ? 12 : 0);
  const local = `${draft.date}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`;
  const date = new Date(local);
  if (
    !Number.isFinite(date.getTime()) ||
    localDate(date.toISOString()) !== local
  )
    throw new Error(
      "That local date/time does not exist. Check the date or daylight-saving transition.",
    );
  const watched = Number(draft.watched_minutes) * 60;
  if (
    draft.status === "partial" &&
    (!draft.watched_minutes.trim() || !Number.isFinite(watched) || watched <= 0)
  )
    throw new Error("Enter positive watched minutes for a partial viewing.");
  return {
    library_title_id: draft.library_title_id,
    started_at: date.toISOString(),
    status: draft.status,
    notes: draft.notes,
    ...(draft.status === "partial" ? { watched_seconds: watched } : {}),
  };
}

export class ManualViewingFields extends LitElement {
  static properties = {
    client: { attribute: false },
    scope: { attribute: false },
    draft: { attribute: false },
    disabled: { type: Boolean },
    fuzzySearch: { attribute: false },
  };
  static styles = [styles, libraryStyles];
  client?: JournalClient;
  scope?: Scope;
  draft = manualDraft();
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
    if (changed.has("client") || changed.has("scope")) {
      const key = `${this.scope?.entry_id}:${this.scope?.dataset_id}`;
      if (key !== this.bound || this.client !== this.boundClient) {
        this.clear();
        this.bound = key;
        this.boundClient = this.client;
      }
    }
    if (changed.has("fuzzySearch") && !this.selected && this.query)
      this.search(this.query);
    if (
      changed.has("draft") &&
      this.selected &&
      this.selected.id !== this.draft.library_title_id
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
    this.query = "";
    this.open = false;
    this.error = "";
  }
  private change(patch: Partial<ManualDraft>) {
    this.dispatchEvent(
      new CustomEvent("draft-change", {
        detail: { ...this.draft, ...patch },
        bubbles: true,
        composed: true,
      }),
    );
  }
  private search(value: string) {
    this.query = value;
    this.selected = undefined;
    this.items = [];
    this.open = true;
    this.active = 0;
    this.error = "";
    this.change({ library_title_id: "" });
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
    if (this.disabled || !item.duration_seconds) return;
    this.selected = item;
    this.query = item.title;
    this.open = false;
    this.items = [];
    this.change({ library_title_id: item.id });
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
        ${this.open ? html`<div class="movie-suggestions" id="movie-suggestions" role="listbox">${this.items.map((item, index) => html`<button type="button" role="option" id=${`movie-option-${index}`} aria-selected=${this.active === index} ?disabled=${!item.duration_seconds} @mousedown=${(event: Event) => event.preventDefault()} @click=${() => this.choose(item)}><strong>${item.title}</strong> · ${item.year ?? "Year unknown"} · ${(item.formats ?? []).join(", ")} · ${item.duration_seconds ? `${(item.duration_seconds / 60).toFixed(2)} min` : "Runtime missing—sync details"}</button>`)}${!this.items.length ? html`<small>Type a title; only cached Library movies can be selected.</small>` : nothing}</div>` : nothing}
      </div>
      ${this.error ? html`<p class="error" role="alert">${this.error}</p>` : nothing}
      ${this.selected ? html`<p class="manual-metadata">${this.selected.year ?? ""} ${renderFormatBadges(this.selected)} ${renderRatingBadge(this.selected.rating)} · ${((this.selected.duration_seconds ?? 0) / 60).toFixed(2)} min</p>` : nothing}
      <div class="grid">
        <label
          >Started · local date<input
            name="viewing_date"
            type="date"
            .value=${this.draft.date}
            @input=${(event: Event) => this.change({ date: (event.target as HTMLInputElement).value })}
        /></label>
        <label
          >Started · local time<input
            name="viewing_time"
            type="text"
            placeholder="19:30 or 7:30 PM"
            maxlength="16"
            .value=${this.draft.time}
            @input=${(event: Event) => this.change({ time: (event.target as HTMLInputElement).value })}
        /></label>
        <label
          >Status<select
            name="record_status"
            .value=${this.draft.status}
            @change=${(event: Event) => this.change({ status: (event.target as HTMLSelectElement).value as ManualDraft["status"] })}
          >
            <option value="completed">Completed</option>
            <option value="partial">Partial</option>
          </select></label
        >
        ${this.draft.status === "partial" ? html`<label>Watched minutes<input name="watched_minutes" type="number" min="0.01" step="0.01" max=${(this.selected?.duration_seconds ?? 1e9) / 60} .value=${this.draft.watched_minutes} @input=${(event: Event) => this.change({ watched_minutes: (event.target as HTMLInputElement).value })} /></label>` : nothing}
        <label class="full"
          >Notes<textarea
            name="notes"
            maxlength="10000"
            .value=${this.draft.notes}
            @input=${(event: Event) => this.change({ notes: (event.target as HTMLTextAreaElement).value })}
          ></textarea>
        </label>
      </div>
      <small
        >Runtime comes from the selected version. End time is start plus watched
        time; completed viewings use the full runtime.</small
      >
    </fieldset>`;
  }
}
if (!customElements.get("kaleidescape-manual-viewing"))
  customElements.define("kaleidescape-manual-viewing", ManualViewingFields);
