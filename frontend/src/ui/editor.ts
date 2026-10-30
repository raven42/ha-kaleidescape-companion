/** Form conversion preserves untouched observed fields and opaque source IDs. */
import { html, nothing } from "lit";
import type { TemplateResult } from "lit";
import type { Viewing, ViewingData } from "../core/api";

export interface Draft {
  title: string;
  started_at: string;
  ended_at: string;
  duration_seconds: string;
  watched_seconds: string;
  status: "partial" | "completed";
  notes: string;
  source_id: string;
  player_id: string;
  raw_content_id: string;
}
export function localDate(value: string): string {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 19);
}
export function draftFrom(record?: Viewing): Draft {
  return {
    title: record?.title ?? "",
    started_at: localDate(record?.started_at ?? new Date().toISOString()),
    ended_at: record?.ended_at ? localDate(record.ended_at) : "",
    duration_seconds:
      record?.duration_seconds == null
        ? ""
        : (record.duration_seconds / 60).toFixed(2),
    watched_seconds: ((record?.watched_seconds ?? 0) / 60).toFixed(2),
    status: record?.status ?? "partial",
    notes: record?.notes ?? "",
    source_id: record?.source_id ?? "",
    player_id: record?.player_id ?? "",
    raw_content_id: record?.raw_content_id ?? "",
  };
}
export function draftData(
  draft: Draft,
  original?: Draft,
): Partial<ViewingData> {
  const result: Record<string, unknown> = {};
  for (const [field, value] of Object.entries(draft)) {
    // Do not lock an observed field just because the form displays it.
    if (original && value === original[field as keyof Draft]) continue;
    if (field === "started_at" || field === "ended_at") {
      result[field] = value ? new Date(value).toISOString() : null;
    } else if (field === "duration_seconds" || field === "watched_seconds") {
      result[field] = value === "" ? null : Number(value) * 60;
    } else if (["source_id", "player_id", "raw_content_id"].includes(field)) {
      result[field] = value === "" ? null : value;
    } else {
      result[field] = value;
    }
  }
  return result;
}

/** Shared validated viewing fields for journal and Advanced corrections. */
export function renderDraftFields(
  draft: Draft,
  change: (key: keyof Draft, event: Event) => void,
  titleField?: TemplateResult,
) {
  function field(
    key: keyof Draft,
    label: string,
    type = "text",
    required = false,
    maxLength?: number,
  ) {
    return html`<label
      >${label}<input
        id=${key === "title" ? "title" : key}
        name=${key}
        type=${type}
        .value=${draft[key]}
        ?required=${required}
        maxlength=${maxLength ?? nothing}
        min=${type === "number" ? "0" : nothing}
        max=${type === "number" ? String(1e9 / 60) : nothing}
        step=${type === "datetime-local" ? "1" : type === "number" ? "0.01" : nothing}
        @input=${(event: Event) => change(key, event)}
    /></label>`;
  }
  return html`
    <div class="grid">
      <div class="full">
        ${titleField ?? field("title", "Title", "text", true, 500)}
      </div>
      ${field("started_at", "Started · local time", "datetime-local", true)}
      ${field("ended_at", "Ended · local time", "datetime-local")}
      ${field("watched_seconds", "Watched minutes", "number", true)}
      ${field("duration_seconds", "Runtime minutes · optional", "number")}
      <label
        >Status<select
          name="record_status"
          .value=${draft.status}
          @change=${(event: Event) => change("status", event)}
        >
          <option value="partial">Partial</option>
          <option value="completed">Completed</option>
        </select></label
      >
      <label class="full"
        >Notes<textarea
          name="notes"
          maxlength="10000"
          .value=${draft.notes}
          @input=${(event: Event) => change("notes", event)}
        ></textarea>
      </label>
    </div>
    <details>
      <summary>Source identifiers</summary>
      <div class="grid">
        ${field("source_id", "Source ID", "text", false, 255)}
        ${field("player_id", "Player ID", "text", false, 255)}
        <div class="full">
          ${field("raw_content_id", "Raw content ID", "text", false, 255)}
        </div>
      </div>
      <small
        >Keep source identifiers exact. Titles do not establish movie
        identity.</small
      >
    </details>
  `;
}
