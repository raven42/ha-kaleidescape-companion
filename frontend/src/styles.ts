import { css } from "lit";

export const styles = css`
  :host {
    display: block;
    min-height: 0;
    color: var(--primary-text-color, #20302c);
    background: var(--primary-background-color, #f5f7f6);
    font-family: var(--paper-font-body1_-_font-family, system-ui, sans-serif);
    --accent: var(--primary-color, #256b59);
    --line: var(--divider-color, #dbe3df);
    --surface: var(--card-background-color, #fff);
    --muted: var(--secondary-text-color, #52645d);
  }
  :host(kaleidescape-panel),
  :host(kaleidescape-reader) {
    min-height: 100dvh;
  }
  * {
    box-sizing: border-box;
  }
  main {
    max-width: 1400px;
    margin: auto;
    padding: 24px clamp(16px, 4vw, 48px) 48px;
  }
  header {
    display: flex;
    align-items: center;
    gap: 16px;
    padding-bottom: 24px;
    border-bottom: 1px solid var(--line);
    flex-wrap: wrap;
  }
  h1 {
    margin: 4px 0 6px;
    font-size: clamp(24px, 3vw, 32px);
    letter-spacing: -0.035em;
    font-weight: 650;
  }
  h2 {
    font-size: 18px;
    margin: 0 0 16px;
  }
  h3 {
    font-size: 14px;
    margin: 20px 0 10px;
  }
  p {
    line-height: 1.6;
  }
  header p {
    margin: 0;
    color: var(--muted);
  }
  .eyebrow {
    color: var(--accent);
    font-size: 11px;
    font-weight: 750;
    letter-spacing: 0.15em;
    text-transform: uppercase;
  }
  .grow {
    flex: 1;
  }
  .muted,
  small {
    color: var(--muted);
  }
  small {
    font-size: 12px;
    line-height: 1.6;
  }
  button,
  input,
  select,
  textarea {
    font: inherit;
  }
  button {
    min-height: 40px;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: var(--surface);
    color: inherit;
    padding: 9px 14px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 550;
  }
  button:hover:not(:disabled) {
    border-color: var(--accent);
  }
  button:disabled {
    opacity: 0.5;
    cursor: default;
  }
  .primary {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--text-primary-color, #fff);
  }
  .danger {
    color: var(--error-color, #b5262c);
  }
  .link {
    padding: 0;
    border: 0;
    min-height: 36px;
    background: none;
    color: var(--accent);
    text-align: left;
  }
  :focus-visible {
    outline: 3px solid var(--accent);
    outline-offset: 3px;
  }
  .metrics {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
    margin: 24px 0;
  }
  .metric,
  .card {
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 12px;
  }
  .metric {
    padding: 16px 20px;
  }
  .metric strong {
    display: block;
    font-size: 21px;
    margin: 5px 0 0;
    font-weight: 600;
  }
  .metric small {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.07em;
  }
  .layout {
    display: grid;
    grid-template-columns: minmax(0, 1.3fr) minmax(340px, 1fr);
    align-items: start;
    gap: 20px;
  }
  .card {
    min-width: 0;
    overflow: hidden;
  }
  .card-head {
    padding: 20px;
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .card-head h2 {
    margin: 0;
    flex: 1;
  }
  .filters {
    padding: 0 20px 20px;
    display: flex;
    align-items: end;
    gap: 10px;
    flex-wrap: wrap;
  }
  .filters label:first-child {
    flex: 1;
    min-width: 150px;
  }
  label {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 12px;
    font-weight: 600;
  }
  input,
  select,
  textarea {
    width: 100%;
    min-width: 0;
    max-width: 100%;
    min-height: 40px;
    border: 1px solid var(--line);
    border-radius: 6px;
    background: var(--surface);
    color: inherit;
    padding: 9px 10px;
    font-size: 14px;
  }
  textarea {
    resize: vertical;
    min-height: 100px;
  }
  input:disabled,
  select:disabled,
  textarea:disabled {
    opacity: 0.65;
  }
  .table-wrap {
    overflow-x: auto;
  }
  table {
    border-collapse: collapse;
    width: 100%;
    font-size: 13px;
  }
  th {
    text-align: left;
    color: var(--muted);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    font-weight: 600;
    background: var(--secondary-background-color, #f7f9f8);
  }
  td,
  th {
    padding: 12px 16px;
    border-top: 1px solid var(--line);
  }
  td:first-child {
    min-width: 150px;
    max-width: 260px;
  }
  td .link {
    font-weight: 600;
    overflow-wrap: anywhere;
  }
  tr.selected {
    background: var(--secondary-background-color, #edf4f0);
  }
  td small {
    display: block;
  }
  .badge {
    display: inline-block;
    padding: 4px 8px;
    border: 1px solid var(--line);
    border-radius: 20px;
    font-size: 11px;
    white-space: nowrap;
    color: var(--muted);
  }
  .complete {
    color: var(--accent);
  }
  .pagination {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 16px 20px;
    border-top: 1px solid var(--line);
  }
  .actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    align-items: center;
  }
  .editor {
    container: viewing-editor / inline-size;
    padding: 0 20px 20px;
  }
  fieldset {
    padding: 0;
    border: 0;
    margin: 0;
    min-width: 0;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px;
    margin-bottom: 14px;
  }
  .grid > * {
    min-width: 0;
  }
  .settings-grid {
    align-items: end;
  }
  .full {
    grid-column: 1/-1;
  }
  .editor .actions {
    margin-top: 20px;
  }
  .metadata {
    font-size: 12px;
    line-height: 1.8;
    color: var(--muted);
    overflow-wrap: anywhere;
  }
  .notice,
  .error,
  .warning {
    padding: 12px 16px;
    margin: 16px 0;
    border: 1px solid var(--line);
    border-left: 4px solid var(--accent);
    border-radius: 6px;
    background: var(--surface);
    line-height: 1.6;
    font-size: 14px;
  }
  .error {
    border-left-color: var(--error-color, #b5262c);
  }
  .warning {
    border-left-color: var(--warning-color, #a66712);
  }
  .empty {
    padding: 40px 24px;
    text-align: center;
    color: var(--muted);
  }
  .empty strong {
    display: block;
    color: var(--primary-text-color, #20302c);
    margin-bottom: 8px;
    font-size: 16px;
  }
  .check {
    flex-direction: row;
    align-items: center;
    margin: 12px 0;
  }
  .check input {
    width: 20px;
    min-height: 20px;
    flex-shrink: 0;
  }
  .page-tabs {
    display: flex;
    gap: 4px;
    overflow-x: auto;
    border-bottom: 1px solid var(--line);
    margin: 20px 0;
    padding: 4px 0 0;
  }
  .page-tabs button {
    flex-shrink: 0;
    border: 0;
    border-bottom: 3px solid transparent;
    border-radius: 6px 6px 0 0;
    background: transparent;
  }
  .page-tabs [aria-selected="true"] {
    color: var(--accent);
    border-bottom-color: var(--accent);
    background: var(--surface);
  }
  .section-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-top: 24px;
  }
  .section-head h2 {
    margin: 0;
  }
  .settings-page {
    padding: 20px;
    max-width: 900px;
    margin-top: 24px;
  }
  .settings-page .card-head {
    padding: 0;
  }
  .settings-page form > button {
    margin-top: 12px;
  }
  .database-entries {
    padding: 20px;
  }
  .database {
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
  .database-dialog {
    width: min(560px, calc(100% - 32px));
    max-height: calc(100dvh - 48px);
    overflow: auto;
    padding: 24px;
    border: 1px solid var(--line);
    border-radius: 12px;
    background: var(--surface);
    color: inherit;
  }
  .database-dialog::backdrop {
    background: rgb(0 0 0 / 60%);
  }
  .database-dialog .card-head {
    padding: 0;
  }
  .dialog-footer {
    margin-top: 20px;
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
  pre {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    font-size: 12px;
  }
  details {
    margin-top: 20px;
  }
  summary {
    cursor: pointer;
    font-weight: 600;
    font-size: 13px;
    padding: 4px 0;
  }
  details .grid {
    margin-top: 14px;
  }
  ul {
    padding-left: 18px;
    font-size: 13px;
    line-height: 1.8;
  }
  .session {
    padding: 10px 0;
    border-top: 1px solid var(--line);
    font-size: 12px;
    line-height: 1.8;
  }
  .menu {
    font-size: 20px;
    padding: 6px 12px;
  }
  .now-playing {
    margin-top: 24px;
  }
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

  .playback-message {
    padding: 0 20px 20px;
    margin: 0;
  }
  .playback-layout {
    display: grid;
    grid-template-columns: 120px minmax(0, 1fr);
    gap: 20px;
    padding: 0 20px 20px;
  }
  .cover {
    aspect-ratio: 2 / 3;
    background: var(--secondary-background-color, #f7f9f8);
    border-radius: 6px;
    overflow: hidden;
    display: grid;
    place-items: center;
    align-self: start;
  }
  .cover img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
  .cover span {
    padding: 12px;
    text-align: center;
    color: var(--muted);
    font-size: 12px;
  }
  .playback-detail h3 {
    margin: 4px 0 12px;
    font-size: 21px;
    overflow-wrap: anywhere;
  }
  .playback-detail p {
    margin: 8px 0;
  }
  [hidden] {
    display: none !important;
  }
  @container viewing-editor (max-width: 640px) {
    .grid {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  @media (max-width: 1000px) {
    .layout {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  @media (max-width: 600px) {
    .playback-layout {
      grid-template-columns: 80px minmax(0, 1fr);
      gap: 12px;
      padding-left: 16px;
      padding-right: 16px;
    }
    main {
      padding-top: 16px;
    }
    header {
      flex-wrap: wrap;
    }
    header .primary {
      width: 100%;
    }
    .metrics {
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      margin: 16px 0;
    }
    .metric {
      padding: 12px;
    }
    .metric strong {
      font-size: 18px;
    }
    .grid {
      grid-template-columns: minmax(0, 1fr);
    }
    .card-head,
    .editor {
      padding-left: 16px;
      padding-right: 16px;
    }
  }
`;
