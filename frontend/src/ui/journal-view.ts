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
  .journal {
    margin-top: 24px;
    overflow: visible;
  }
  .journal-toolbar {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
    padding: 20px;
  }
  .journal-toolbar kaleidescape-journal-options {
    margin-left: auto;
  }
  .journal-filters {
    padding: 20px;
    border-block: 1px solid var(--line);
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
  @media (max-width: 600px) {
    .journal-summary {
      grid-template-columns: minmax(0, 1fr);
    }
  }
`;
