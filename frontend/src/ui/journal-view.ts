/** Shared presentation of the household-safe viewing fields. */
import { css, html, nothing } from "lit";
import { counted } from "../core/text";
import type { JournalInfo, ViewingSummary } from "../core/api";

export interface CalendarStatus {
  month: string;
  count?: number;
  watchedSeconds?: number;
  loading: boolean;
  error: string;
  empty: boolean;
}
function watchedTime(seconds = 0) {
  const minutes = Math.floor(seconds / 60);
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}
export function journalTotals(
  info?: JournalInfo | null,
  calendar?: CalendarStatus,
  calendarView = !!calendar,
) {
  const count = calendarView ? calendar?.count : info?.month_viewing_count;
  const seconds = calendarView
    ? calendar?.watchedSeconds
    : info?.month_watched_seconds;
  return html`<span class=${calendarView ? "calendar-totals-full" : ""}
      >Total Viewings ${info?.viewing_count ?? 0} ·
      ${calendarView ? (calendar?.month ?? "Selected Month") : "This Month"}
      ${count ?? "—"} · Watched Time: Total
      ${watchedTime(info?.watched_seconds)} ·
      ${calendarView ? "Selected Month" : "This Month"}
      ${seconds === undefined && calendarView ? "—" : watchedTime(seconds)}</span
    >
    ${calendarView ? html`<span class="calendar-totals-compact">${count === undefined ? "— viewings" : counted(count, "viewing")} · ${seconds === undefined ? "—" : watchedTime(seconds)} watched</span>` : nothing}`;
}
export function calendarNotice(
  state: CalendarStatus | undefined,
  retry: () => void,
) {
  if (!state) return nothing;
  return state.error
    ? html`<span class="error" role="alert"
        >${state.error} <button @click=${retry}>Retry month</button></span
      >`
    : state.loading
      ? html`<span role="status">Loading month…</span>`
      : state.empty
        ? html`<span class="calendar-empty-notice" role="status"
            >No viewings match this month</span
          >`
        : nothing;
}

export function viewingListRow(
  row: ViewingSummary,
  selected: string | undefined,
  select: (id: string) => void,
  disabled = false,
) {
  const date = new Date(row.started_at);
  const day = Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString();
  return html`<li
    class=${selected === row.id ? "journal-row selected" : "journal-row"}
  >
    <button
      class="link entry-name"
      title=${row.title}
      aria-current=${selected === row.id ? "true" : nothing}
      ?disabled=${disabled}
      @click=${() => select(row.id)}
    >
      ${row.title}
    </button>
    <time datetime=${row.started_at}>${day}</time
    ><span class="journal-row-status"
      >${row.status === "completed" ? "Completed" : "Partial"}</span
    >
  </li>`;
}

export function viewingDetails(
  row: ViewingSummary,
  date: (value: string | null) => string,
) {
  return html`<h3 class="journal-title">${row.title}</h3>
    <dl class="journal-summary">
      <div>
        <dt>Status</dt>
        <dd>${row.status === "completed" ? "Completed" : "Partial"}</dd>
      </div>
      <div>
        <dt>Started</dt>
        <dd>${date(row.started_at)}</dd>
      </div>
      <div>
        <dt>Ended</dt>
        <dd>${date(row.ended_at)}</dd>
      </div>
      <div>
        <dt>Watched</dt>
        <dd>${(row.watched_seconds / 60).toFixed(2)} min</dd>
      </div>
      <div>
        <dt>Runtime</dt>
        <dd>
          ${row.duration_seconds === null ? "—" : `${(row.duration_seconds / 60).toFixed(2)} min`}
        </dd>
      </div>
      <div>
        <dt>Origin</dt>
        <dd>${row.origin === "observed" ? "Recorded" : "Manual"}</dd>
      </div>
    </dl>`;
}

export const calendarTotalsStyles = css`
  .calendar-totals-compact {
    display: none;
  }
  @media (max-width: 700px) {
    .calendar-totals-full,
    .calendar-empty-notice {
      display: none;
    }
    .calendar-totals-compact {
      display: inline;
      white-space: nowrap;
    }
  }
`;

export const journalStyles = css`
  ${calendarTotalsStyles}
  .journal [hidden] {
    display: none;
  }
  .journal {
    margin-top: 24px;
    overflow: visible;
  }
  .journal-toolbar {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
    padding: 12px 16px;
  }
  .journal-toolbar kaleidescape-journal-options {
    margin-left: auto;
  }
  .journal-filters {
    padding: 12px 16px;
    border-block: 1px solid var(--line);
    align-items: end;
    gap: 8px;
    flex-wrap: wrap;
  }
  .journal-filters .journal-toolbar {
    display: contents;
  }
  .journal-filters kaleidescape-journal-options {
    margin-left: auto;
  }
  .journal-filter-tools {
    display: contents;
  }
  .journal-search-input {
    position: relative;
    display: block;
  }
  .journal-search-input input {
    padding-inline-end: 40px;
  }
  .journal-search-input input::-webkit-search-cancel-button {
    display: none;
  }
  .journal-clear-search {
    position: absolute;
    inset-inline-end: 2px;
    top: 50%;
    transform: translateY(-50%);
    width: 36px;
    min-height: 36px;
    padding: 0;
    border: 0;
    background: transparent;
    font-size: 22px;
  }
  .journal-search-chip {
    display: none;
  }
  .journal .card-head {
    padding: 0;
    margin-bottom: 16px;
    flex-wrap: wrap;
  }
  .journal .journal-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto auto;
    gap: 10px;
    padding: 4px 8px;
    font-size: 12px;
  }
  .journal-movie-filter {
    padding-inline: 20px;
  }
  .journal-row .entry-name {
    min-height: 32px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .journal-row time,
  .journal-row-status {
    white-space: nowrap;
    color: var(--muted);
  }
  .journal-status {
    padding: 12px 20px;
    border-top: 1px solid var(--line);
    color: var(--muted);
    font-size: 12px;
  }
  .journal-title {
    font-size: 20px;
    margin-top: 0;
    overflow-wrap: anywhere;
  }
  .journal-summary {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px;
    margin: 20px 0;
  }
  .journal-summary dt {
    color: var(--muted);
    font-size: 12px;
  }
  .journal-summary dd {
    margin: 4px 0 0;
    overflow-wrap: anywhere;
  }
  .journal-notes {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  .journal-dialog {
    width: min(860px, calc(100% - 32px));
  }
  .journal-dialog .editor {
    padding: 0;
  }
  .journal-dialog .delete-viewing {
    margin-inline-end: auto;
    order: 0;
  }
  @media (max-width: 700px) {
    .journal-clear-search {
      display: none;
    }
    .journal-search-chip {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      max-width: calc(100% - 20px);
      margin: 8px 10px 0;
    }
    .journal-search-chip span:first-child {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .journal-calendar-mode {
      --calendar-sticky-top: calc(
        max(
            var(--companion-sticky-top, 0px),
            var(--companion-viewport-top, 0px),
            env(safe-area-inset-top, 0px)
          ) +
          56px
      );
    }
    .journal-calendar-mode .entries-header {
      top: max(
        var(--companion-sticky-top, 0px),
        var(--companion-viewport-top, 0px),
        env(safe-area-inset-top, 0px)
      );
    }
    .journal-calendar-mode .journal-filters,
    .journal-calendar-mode .journal-toolbar {
      display: contents;
    }
    .journal-calendar-mode .journal-filters > label,
    .journal-calendar-mode .journal-filter-tools,
    .journal-calendar-mode .journal-search-button,
    .journal-calendar-mode .journal-toolbar > button,
    .journal-calendar-mode .journal-movie-filter,
    .journal-calendar-mode .journal-system-details {
      display: none;
    }
    .journal-calendar-mode .entries-footer {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      padding: 4px 8px max(4px, env(safe-area-inset-bottom));
      font-size: 11px;
      line-height: 16px;
    }
    .journal-calendar-mode .entries-footer > span {
      min-width: 0;
    }
    .journal-calendar-mode .entries-footer .error {
      white-space: normal;
    }
  }
  @media (max-width: 600px) {
    .journal-summary {
      gap: 10px;
      margin-block: 12px;
    }
    .journal {
      margin-top: 12px;
    }
    .journal-toolbar {
      padding: 8px 10px;
      gap: 8px;
      flex-wrap: nowrap;
    }
    .journal-toolbar button {
      padding-inline: 10px;
      font-size: 13px;
      white-space: nowrap;
    }
    .journal-filters {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto auto;
      gap: 8px;
      padding: 8px 10px;
    }
    .journal-filters > label:first-child {
      min-width: 0;
      grid-column: 1 / 3;
      grid-row: 1;
    }
    .journal-filters > .journal-search-button {
      grid-column: 3;
      grid-row: 1;
    }
    .journal-filter-tools {
      grid-column: 1 / -1;
      display: flex;
      align-items: end;
      gap: 8px;
      overflow-x: auto;
      padding-bottom: 2px;
    }
    .journal-filter-tools > * {
      flex: 0 0 auto;
    }
    .journal-filter-tools select {
      max-width: 170px;
    }
    .journal-title {
      font-size: 18px;
    }
  }
`;
