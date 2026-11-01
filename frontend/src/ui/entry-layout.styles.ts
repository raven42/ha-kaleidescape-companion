/** Shared split-view layout for human-facing Journal and raw Database rows. */
import { css } from "lit";

export const entryLayoutStyles = css`
  .entries-header {
    position: sticky;
    top: var(--companion-sticky-top, 0px);
    z-index: 15;
    background: var(--surface);
    border-radius: 12px 12px 0 0;
  }
  .entries-layout {
    display: grid;
    grid-template-columns: minmax(230px, 0.8fr) minmax(0, 1.2fr);
    height: var(--entries-height, clamp(240px, calc(100dvh - 240px), 820px));
    min-height: 0;
  }
  .entries-list,
  .entries-detail {
    padding: clamp(10px, 2vw, 20px);
    min-width: 0;
    min-height: 0;
  }
  .entries-list {
    display: flex;
    flex-direction: column;
  }
  .entries-list > .card-head {
    flex-shrink: 0;
  }
  .entries-detail {
    border-left: 1px solid var(--line);
    overflow: auto;
    overscroll-behavior: contain;
    scrollbar-gutter: stable;
  }
  .entry-list {
    list-style: none;
    margin: 0;
    padding: 4px;
    flex: 1;
    min-height: 0;
    overflow: auto;
    overscroll-behavior: contain;
    scrollbar-gutter: stable;
  }
  .entry-list li {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    border-top: 1px solid var(--line);
  }
  .entry-list li.selected {
    background: var(--secondary-background-color, #edf4f0);
  }
  .entry-list input {
    width: 20px;
    min-height: 20px;
    flex-shrink: 0;
  }
  .entry-name {
    min-width: 0;
    overflow-wrap: anywhere;
  }
  .entry-name small {
    display: block;
  }
  .entries-footer {
    position: sticky;
    bottom: 0;
    z-index: 14;
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 10px 16px;
    padding: 8px 14px max(8px, env(safe-area-inset-bottom));
    background: var(--surface);
    border-top: 1px solid var(--line);
    border-radius: 0 0 12px 12px;
    color: var(--muted);
    font-size: 12px;
  }
  .entries-footer .pagination {
    border: 0;
    padding: 0;
    margin: 0;
    gap: 8px;
  }
  .entries-footer .pagination .actions {
    flex-wrap: nowrap;
  }
  @media (max-width: 700px) {
    .entries-layout {
      grid-template-columns: minmax(0, 1fr);
      grid-template-rows: minmax(80px, 0.85fr) minmax(100px, 1.15fr);
    }
    .entries-detail {
      border-left: 0;
      border-top: 1px solid var(--line);
    }
    .entries-header {
      border-radius: 8px 8px 0 0;
    }
    .entries-footer {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 4px 8px;
      padding-inline: 10px;
    }
    .entries-footer > span {
      grid-column: 1 / -1;
    }
    .entries-footer > span,
    .entries-footer small {
      min-width: 0;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
      font-size: 11px;
    }
    .entries-footer .pagination {
      display: contents;
    }
    .entries-footer .actions {
      gap: 4px;
    }
    .entries-footer button {
      padding-inline: 8px;
      font-size: 12px;
    }
    .entry-list li {
      gap: 8px;
      padding: 8px;
    }
  }
`;
