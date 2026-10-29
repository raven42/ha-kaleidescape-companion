/** Library browsing, covers, filters and purchase-preview layout. */
import { css } from "lit";

export const libraryStyles = css`
  .library-page {
    margin-top: 24px;
  }
  .library-toolbar,
  .library-toolbar form {
    display: flex;
    flex-wrap: wrap;
    align-items: end;
    gap: 12px;
  }
  .library-toolbar {
    padding: 20px;
  }
  .library-toolbar form {
    flex: 1;
  }
  .library-toolbar form label {
    flex: 1;
    min-width: 150px;
  }
  .view-switch {
    display: flex;
    gap: 0;
  }
  .view-switch button[aria-pressed="true"] {
    color: var(--accent);
    border-color: var(--accent);
  }
  .page-size {
    width: 130px;
  }
  .cover-size {
    width: 150px;
  }
  input[type="range"] {
    padding: 0;
  }
  .cover-grid {
    display: grid;
    grid-template-columns: repeat(var(--cover-columns, 1), minmax(0, 1fr));
    gap: 2px;
  }
  .cover-tile {
    position: relative;
    padding: 0;
    border: 0;
    border-radius: 0;
    min-width: 0;
    overflow: hidden;
  }
  .cover-tile span {
    position: absolute;
    bottom: 0;
    inset-inline: 0;
    color: white;
    background: rgb(0 0 0 / 65%);
    display: block;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    padding: 3px 2px;
  }
  .cover-image {
    aspect-ratio: 2 / 3;
  }
  .library-table {
    table-layout: fixed;
    width: var(--library-width);
    min-width: 100%;
  }
  .library-table td:first-child {
    min-width: 0;
    max-width: none;
  }
  .library-table th {
    position: relative;
    padding: 0;
  }
  .library-table td {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .library-table .link,
  .library-table td small {
    display: block;
    width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .library-table .sort-heading {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    min-height: 54px;
    padding: 12px 16px;
    border: 0;
    border-radius: 0;
    background: transparent;
    color: inherit;
    text-align: left;
    white-space: nowrap;
  }
  .sort-heading > span:first-child {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .sort-icon {
    flex-shrink: 0;
  }
  .column-resize {
    position: absolute;
    top: 0;
    right: 0;
    height: 100%;
    width: 8px;
    cursor: col-resize;
    touch-action: none;
    border-right: 1px solid var(--line);
  }
  .column-resize:hover {
    background: var(--line);
  }
  .library-table .collection-cell {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 3;
    overflow: hidden;
    white-space: normal;
    overflow-wrap: anywhere;
  }
  .version-tabs {
    margin-bottom: 16px;
  }
  .library-dialog {
    width: min(850px, calc(100% - 32px));
    overflow-wrap: anywhere;
  }
  .purchase-preview {
    max-height: 50vh;
    overflow: auto;
    margin-block: 16px;
  }
  .purchase-preview section {
    padding: 12px;
    border-bottom: 1px solid var(--line);
  }
  .library-dialog .playback-layout {
    padding: 24px 0 0;
  }
  .facet-groups {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(220px, 100%), 1fr));
    gap: 16px;
    margin-top: 20px;
  }
  .facet-groups fieldset {
    min-width: 0;
    border: 1px solid var(--line);
  }
  .facet-options {
    max-height: 220px;
    overflow: auto;
  }
  .facet-options .check {
    margin: 8px 0;
  }
`;
