/** Layout rules owned by the Database page. Shared forms/dialogs stay in styles. */
import { css } from "lit";

export const databaseStyles = css`
  .database {
    overflow: visible;
    margin-top: 24px;
  }
  .database .entry-list li {
    height: 44px;
    box-sizing: border-box;
    padding: 4px 10px;
    gap: 8px;
  }
  .database .entry-list li.entry-spacer {
    display: block;
    min-height: 0;
    padding: 0;
    border: 0;
  }
  .database .entry-name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
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
  .database-table-heading {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .database-relationships {
    display: grid;
    gap: 12px;
    margin: 14px 0;
  }
  .database-references h3 {
    font-size: 13px;
    margin: 0 0 4px;
  }
  .database-references ul {
    display: grid;
    gap: 0;
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .database-references li {
    min-width: 0;
    line-height: 1.3;
  }
  .database-references button.link {
    font-size: 12px;
    display: inline;
    text-align: left;
    overflow-wrap: anywhere;
    padding: 0;
    min-height: 0;
    line-height: 1.3;
  }
  .database-references small {
    color: var(--muted);
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
  .database-table-selector {
    display: flex;
    align-items: end;
    gap: 12px;
    padding: 2px 12px 6px;
  }
  .table-tabs {
    flex: 1;
    min-width: 0;
    margin: 0;
    padding: 0;
  }
  .system-table-picker {
    flex: 0 1 270px;
    min-width: 150px;
    font-size: 12px;
  }
  .system-table-picker select {
    min-height: 36px;
    padding: 5px 8px;
  }
  .database-detail .editor {
    padding: 0;
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
    .database-table-selector {
      flex-wrap: wrap;
      padding-inline: 8px;
      gap: 6px;
    }
    .table-tabs {
      flex-basis: 100%;
    }
    .system-table-picker {
      flex: 1 1 100%;
    }
    .system-table-picker select {
      min-height: 44px;
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
