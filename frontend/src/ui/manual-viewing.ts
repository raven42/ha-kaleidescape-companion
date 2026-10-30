/** Exact Library selection for manual viewings; the worker derives all runtime facts. */
import { LitElement, html, nothing } from "lit";
import type { JournalClient, Scope } from "../core/api";
import { styles } from "./styles";
import { libraryStyles } from "../library/styles";
import { localDate } from "./editor";
import "./library-title-picker";
import type { TitleSelection } from "./library-title-picker";

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
  private runtime: number | null = null;
  private change(patch: Partial<ManualDraft>) {
    this.dispatchEvent(
      new CustomEvent("draft-change", {
        detail: { ...this.draft, ...patch },
        bubbles: true,
        composed: true,
      }),
    );
  }
  protected render() {
    return html`<fieldset ?disabled=${this.disabled}>
      <kaleidescape-library-title-picker
        .client=${this.client}
        .scope=${this.scope}
        .value=${this.draft.library_title_id}
        .disabled=${this.disabled}
        .fuzzySearch=${this.fuzzySearch}
        @title-selection=${(event: CustomEvent<TitleSelection>) => {
          this.runtime = event.detail.movie?.duration_seconds ?? null;
          this.change({ library_title_id: event.detail.movie?.id ?? "" });
        }}
      ></kaleidescape-library-title-picker>
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
        ${this.draft.status === "partial" ? html`<label>Watched minutes<input name="watched_minutes" type="number" min="0.01" step="0.01" max=${(this.runtime ?? 1e9) / 60} .value=${this.draft.watched_minutes} @input=${(event: Event) => this.change({ watched_minutes: (event.target as HTMLInputElement).value })} /></label>` : nothing}
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
