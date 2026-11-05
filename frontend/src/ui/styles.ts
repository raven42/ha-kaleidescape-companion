import { css } from "lit";

export const styles = css`
  :host {
    display: block;
    min-height: 0;
    min-width: 0;
    color: var(--primary-text-color, #20302c);
    background: transparent;
    font-family: var(--paper-font-body1_-_font-family, system-ui, sans-serif);
    --accent: var(--primary-color, #256b59);
    --line: var(--divider-color, #dbe3df);
    --surface: var(--card-background-color, #fff);
    --muted: var(--secondary-text-color, #52645d);
  }
  :host(kaleidescape-panel),
  :host(kaleidescape-reader) {
    min-height: 100dvh;
    background: var(--primary-background-color, #f5f7f6);
  }
  * {
    box-sizing: border-box;
  }
  main {
    max-width: 1400px;
    margin: auto;
    padding: 16px clamp(10px, 3vw, 40px) max(16px, env(safe-area-inset-bottom));
  }
  header {
    display: flex;
    align-items: center;
    gap: 16px;
    padding-bottom: 14px;
    border-bottom: 1px solid var(--line);
    flex-wrap: wrap;
  }
  header .companion-icon {
    width: 60px;
    height: 60px;
    object-fit: contain;
    flex: 0 0 60px;
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
  .card {
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 12px;
    min-width: 0;
    overflow: hidden;
  }
  .card-head {
    padding: 20px;
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
  }
  .card-head h2 {
    margin: 0;
    flex: 1;
    min-width: 0;
    overflow-wrap: anywhere;
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
  .manual-picker {
    position: relative;
    margin-bottom: 16px;
  }
  .movie-suggestions {
    position: absolute;
    top: 100%;
    inset-inline: 0;
    z-index: 20;
    display: grid;
    max-height: min(
      260px,
      calc(var(--companion-viewport-height, 100dvh) * 0.35)
    );
    overflow: auto;
    overscroll-behavior: contain;
    background: var(--surface);
    border: 1px solid var(--line);
    box-shadow: 0 4px 12px #0004;
  }
  .movie-suggestions button {
    text-align: left;
    border-radius: 0;
    white-space: normal;
    overflow-wrap: anywhere;
  }
  .movie-suggestions [aria-selected="true"] {
    background: var(--line);
  }
  .manual-metadata {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
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
    min-width: 0;
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
    margin: 12px 0;
    padding: 4px 0 0;
  }
  .page-navigation {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }
  .page-navigation > .page-tabs {
    flex: 1;
    min-width: 0;
  }
  .view-mode-slot,
  .mode-control {
    flex: none;
  }
  .view-mode-pill {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--line);
    border-radius: 999px;
    padding: 6px 9px;
    gap: 6px;
    min-height: 34px;
    background: var(--divider-color, #666);
    color: var(--primary-text-color);
    font-size: 12px;
    line-height: 1;
    white-space: nowrap;
  }
  .mode-track {
    position: relative;
    display: inline-block;
    width: 30px;
    height: 16px;
    border-radius: 999px;
    background: #0003;
    flex: none;
  }
  .mode-thumb {
    position: absolute;
    inset-block-start: 2px;
    inset-inline-start: 2px;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: #fff;
    transition: transform 0.15s;
  }
  .view-mode-pill[aria-checked="true"] {
    background: var(--primary-color, #03a9f4);
    color: var(--text-primary-color, #fff);
  }
  .view-mode-pill[aria-checked="true"] .mode-thumb {
    transform: translateX(14px);
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
  .settings-page {
    padding: 20px;
    max-width: 900px;
    overflow: visible;
    margin-top: 24px;
  }
  dialog {
    --dialog-background: var(--surface);
    --dialog-gutter: clamp(12px, 2vw, 20px);
    width: min(560px, calc(100% - 24px));
    max-width: calc(100% - 16px);
    max-height: calc(
      var(--companion-viewport-height, 100dvh) -
        24px - env(safe-area-inset-top) - env(safe-area-inset-bottom)
    );
    overflow: auto;
    overscroll-behavior: contain;
    scroll-padding-block: 68px;
    padding: var(--dialog-gutter);
    border: 1px solid var(--line);
    border-radius: 12px;
    background: var(--dialog-background);
    color: inherit;
  }
  dialog:modal {
    inset-block-start: var(--companion-viewport-top, 0px);
    inset-block-end: var(--companion-viewport-bottom, 0px);
  }
  dialog.inset-dialog {
    --dialog-top-gap: max(
      calc(var(--companion-viewport-height, 100dvh) * 0.15),
      calc(env(safe-area-inset-top) + 8px)
    );
    max-height: calc(
      var(--companion-viewport-height, 100dvh) - var(--dialog-top-gap) - env(
          safe-area-inset-bottom
        ) -
        12px
    );
  }
  dialog.inset-dialog:modal {
    inset-block-start: calc(
      var(--companion-viewport-top, 0px) + var(--dialog-top-gap)
    );
    inset-block-end: auto;
    margin-block: 0;
  }
  dialog > .card-head,
  dialog > .movie-heading {
    position: sticky;
    top: calc(0px - var(--dialog-gutter));
    z-index: 25;
    margin: calc(0px - var(--dialog-gutter)) calc(0px - var(--dialog-gutter))
      14px;
    padding: 10px var(--dialog-gutter);
    background: var(--dialog-background);
    border-bottom: 1px solid var(--line);
  }
  dialog::backdrop {
    background: rgb(0 0 0 / 60%);
  }
  dialog .card-head {
    align-items: flex-start;
  }
  dialog .card-head h2 {
    margin: 0;
  }
  .dialog-close {
    display: grid;
    place-items: center;
    flex: 0 0 36px;
    width: 36px;
    min-height: 36px;
    padding: 6px;
    background: transparent;
    border: 0;
    color: var(--muted);
  }
  .dialog-close svg {
    width: 24px;
    height: 24px;
  }
  .dialog-footer {
    margin: 14px calc(0px - var(--dialog-gutter))
      calc(0px - var(--dialog-gutter));
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: 10px;
    padding: 8px var(--dialog-gutter) max(8px, env(safe-area-inset-bottom));
    position: sticky;
    bottom: calc(0px - var(--dialog-gutter));
    background: var(--dialog-background, var(--surface));
    z-index: 12;
  }
  .dialog-footer button {
    white-space: normal;
    max-width: 100%;
  }
  .dialog-footer .primary,
  .dialog-footer .danger {
    order: 1;
  }
  .field-actions {
    align-items: end;
  }
  .settings-actions {
    position: sticky;
    top: var(--companion-sticky-top, 0px);
    z-index: 15;
    background: var(--surface);
    padding: 8px 0;
    margin-bottom: 12px;
    display: flex;
    gap: 10px;
    align-items: center;
    flex-wrap: wrap;
    border-bottom: 1px solid var(--line);
  }
  .settings-actions h2 {
    margin: 0;
    flex: 1;
  }
  .settings-actions .actions {
    flex-wrap: nowrap;
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
  @media (max-width: 600px) {
    header .companion-icon {
      display: none;
    }
    button,
    input,
    select {
      min-height: 44px;
    }
    input,
    select,
    textarea {
      font-size: 16px;
    }
    input[type="checkbox"],
    input[type="radio"] {
      min-height: 20px;
    }
    .check {
      min-height: 44px;
      margin: 4px 0;
    }
    .dialog-close {
      flex-basis: 44px;
      width: 44px;
      min-height: 44px;
    }
    dialog {
      width: min(560px, calc(100% - 16px));
      max-height: calc(
        var(--companion-viewport-height, 100dvh) -
          16px - env(safe-area-inset-top) - env(safe-area-inset-bottom)
      );
    }
    dialog h2 {
      font-size: 17px;
      line-height: 1.3;
      align-self: center;
    }
    .dialog-footer {
      gap: 8px;
    }
    .dialog-footer button {
      padding-inline: 10px;
      min-width: 0;
      font-size: 13px;
    }
    .notice,
    .warning,
    .error {
      padding: 10px 12px;
      margin-block: 12px;
      line-height: 1.45;
    }
    .page-tabs {
      margin: 8px 0;
      gap: 0;
    }
    .page-tabs button {
      padding: 8px 10px;
    }
    .view-mode-pill {
      min-height: 36px;
    }
    header .eyebrow,
    header p {
      display: none;
    }
    h1 {
      font-size: 21px;
      letter-spacing: -0.025em;
    }
    header {
      gap: 8px;
      padding-bottom: 8px;
    }
    .settings-page {
      padding: 12px;
      margin-top: 12px;
    }
    .settings-actions h2 {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
    }
    .settings-actions .actions {
      flex: 1;
      justify-content: flex-end;
    }
    .settings-actions {
      gap: 6px;
    }
    .playback-layout {
      grid-template-columns: 80px minmax(0, 1fr);
      gap: 12px;
      padding-left: 16px;
      padding-right: 16px;
    }
    main {
      padding-top: 8px;
    }
    header {
      flex-wrap: wrap;
    }
    header .primary {
      width: 100%;
    }
    .grid {
      grid-template-columns: minmax(0, 1fr);
    }
    .card-head:not(dialog > .card-head),
    .editor {
      padding: 12px;
    }
  }
  @media (max-height: 540px) {
    dialog {
      --dialog-gutter: 12px;
    }
    dialog > .card-head,
    dialog > .movie-heading {
      padding-block: 6px;
    }
    .dialog-footer {
      margin-top: 10px;
      padding-block: 6px;
    }
  }
`;
