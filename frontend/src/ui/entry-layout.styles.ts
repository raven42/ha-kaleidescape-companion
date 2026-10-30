/** Shared split-view layout for human-facing Journal and raw Database rows. */
import { css } from "lit";

export const entryLayoutStyles = css`
  .entries-layout {
    display: grid;
    grid-template-columns: minmax(230px, 0.8fr) minmax(0, 1.2fr);
  }
  .entries-list,
  .entries-detail {
    padding: 20px;
    min-width: 0;
  }
  .entries-detail {
    border-left: 1px solid var(--line);
  }
  .entry-list {
    list-style: none;
    margin: 0;
    padding: 0;
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
  @media (max-width: 900px) {
    .entries-layout {
      grid-template-columns: minmax(0, 1fr);
    }
    .entries-detail {
      border-left: 0;
      border-top: 1px solid var(--line);
    }
  }
`;
