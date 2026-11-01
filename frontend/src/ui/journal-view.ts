/** Shared presentation of the household-safe viewing fields. */
import { css, html, nothing } from "lit";
import type { ViewingSummary } from "../core/api";

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

export const journalStyles = css`
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
  }
  .journal-filter-tools {
    display: contents;
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
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 8px;
      padding: 8px 10px;
    }
    .journal-filters > label:first-child {
      min-width: 0;
      grid-column: 1;
      grid-row: 1;
    }
    .journal-filters > button:last-child {
      grid-column: 2;
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
