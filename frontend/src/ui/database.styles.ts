/** Layout rules owned by the Database page. Shared forms/dialogs stay in styles. */
import { css } from "lit";

export const databaseStyles = css`
  .database {
    overflow: visible;
    margin-top: 24px;
  }
  .database-toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
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
    align-items: center;
    flex-wrap: wrap;
  }
  .database-filters {
    padding: 12px 16px;
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
    padding: 2px 12px 0;
  }
  .database-detail .editor {
    padding: 0;
  }
  .database .entry-list li {
    padding: 6px 10px;
  }
  @media (max-width: 900px) {
    .database-toolbar kaleidescape-transfers {
      margin-left: 0;
    }
  }
  @media (max-width: 700px) {
    .database {
      margin-top: 12px;
    }
    .database-toolbar {
      flex-wrap: nowrap;
      padding: 8px 10px;
      overflow-x: auto;
    }
    .database-toolbar > *,
    .database-toolbar .actions {
      flex-shrink: 0;
      flex-wrap: nowrap;
    }
    .database-toolbar button {
      padding-inline: 8px;
      font-size: 12px;
      white-space: nowrap;
    }
    .database-filters {
      padding: 8px 10px;
      gap: 8px;
    }
    .database-filters kaleidescape-database-search {
      flex-basis: 100%;
    }
    .database-filters > label {
      flex: 1;
      min-width: 0;
    }
    .database-filters select {
      width: 100%;
    }
    .table-tabs {
      padding-inline: 8px;
    }
    .database-options-button {
      position: sticky;
      right: 0;
      margin-left: auto;
      background: var(--surface);
      z-index: 1;
      box-shadow: -8px 0 8px var(--surface);
    }
  }
`;
