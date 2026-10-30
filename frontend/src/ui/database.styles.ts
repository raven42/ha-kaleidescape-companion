/** Layout rules owned by the Database page. Shared forms/dialogs stay in styles. */
import { css } from "lit";

export const databaseStyles = css`
  .database-entries {
    padding: 20px;
  }
  .database {
    overflow: visible;
    margin-top: 24px;
  }
  .database-toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: start;
    gap: 12px;
    padding: 20px;
  }
  .database-toolbar kaleidescape-transfers {
    margin-left: auto;
    min-width: 0;
    max-width: 100%;
  }
  .database-messages {
    padding: 0 20px;
  }
  .database .card-head {
    padding: 0;
  }
  .database .card-head + .editor {
    margin-top: 20px;
  }
  .database-pagination {
    flex-direction: column;
    align-items: stretch;
    padding: 16px 0 0;
  }
  .database-filters {
    padding: 20px;
    border-bottom: 1px solid var(--line);
    align-items: start;
  }
  .database-edit-field {
    display: grid;
    gap: 8px;
    padding: 8px 4px;
    margin-bottom: 12px;
  }
  .database-edit-field .check {
    margin: 0;
  }
  .database-preview {
    display: block;
    width: 160px;
    height: 240px;
    margin: 16px 0;
  }
  .database-references {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 16px 0;
  }
  .database-options-button {
    margin-left: 0;
  }
  .database-filters select {
    width: auto;
    max-width: 250px;
  }
  .database-pagination .actions {
    flex-wrap: nowrap;
    gap: 6px;
  }
  .database-pagination button {
    flex: 1 0 auto;
    padding-inline: 6px;
    white-space: nowrap;
  }
  .table-tabs {
    margin: 0;
    padding: 4px 20px 0;
  }
  .database-layout {
    display: grid;
    grid-template-columns: minmax(230px, 0.8fr) minmax(0, 1.2fr);
  }
  .database-detail {
    padding: 20px;
    border-left: 1px solid var(--line);
  }
  .database-detail .editor {
    padding: 0;
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
    .database-layout {
      grid-template-columns: minmax(0, 1fr);
    }
    .database-detail {
      border-left: 0;
      border-top: 1px solid var(--line);
    }
    .database-toolbar kaleidescape-transfers {
      margin-left: 0;
    }
  }
`;
