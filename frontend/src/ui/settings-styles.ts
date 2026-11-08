/** Shared visual language for settings sections and their embedded editors. */
import { css } from "lit";

export const settingLabelStyles = css`
  .setting-label {
    display: flex;
    align-items: center;
    gap: 4px;
    min-width: 0;
  }
  .setting-label label {
    display: inline;
    font-size: 14px;
    font-weight: 600;
  }
  .setting-description {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
`;

export const settingsStyles = css`
  ${settingLabelStyles}
  .spaced {
    margin-top: 22px;
  }
  h3 {
    font-size: 18px;
    font-weight: 650;
    letter-spacing: -0.02em;
    margin: 0 0 6px;
  }
  h4 {
    font-size: 15px;
    margin: 0 0 8px;
  }
  p {
    margin: 8px 0 16px;
  }
  .settings-card {
    border: 1px solid var(--line);
    border-radius: 14px;
    padding: clamp(16px, 2.5vw, 24px);
    margin-bottom: 18px;
    background: var(--surface);
    min-width: 0;
  }
  .settings-card > :last-child {
    margin-bottom: 0;
  }
  .section-heading {
    display: flex;
    gap: 12px;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 18px;
    flex-wrap: wrap;
  }
  .section-heading p {
    margin: 6px 0 0;
    max-width: 70ch;
    color: var(--muted);
    font-size: 14px;
  }
  .scope-tag {
    display: inline-flex;
    padding: 4px 9px;
    border: 1px solid var(--line);
    border-radius: 20px;
    color: var(--muted);
    font-size: 11px;
    font-weight: 650;
    white-space: nowrap;
  }
  .scope-tag.immediate {
    color: var(--accent);
  }
  .setting-field {
    display: flex;
    flex-direction: column;
    gap: 7px;
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    min-width: 0;
  }
  .setting-field small {
    font-weight: 400;
    font-size: 12px;
  }
  .credential-row {
    display: flex;
    align-items: flex-end;
    gap: 12px;
  }
  .credential-row .setting-field {
    flex: 1;
  }
  .credential-actions {
    display: flex;
    align-items: center;
  }
  .check {
    display: flex;
  }
  .settings-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 20px;
    align-items: start;
  }
  .settings-grid .full {
    grid-column: 1 / -1;
  }
  .field-input {
    display: flex;
    align-items: center;
    position: relative;
  }
  .field-input input {
    min-width: 0;
  }
  .field-input:has(.unit) input {
    padding-inline-end: 80px;
  }
  .field-input .unit {
    position: absolute;
    inset-inline-end: 12px;
    color: var(--muted);
    font-size: 12px;
    font-weight: 400;
    pointer-events: none;
  }
  .switch-row {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 18px;
    padding: 16px 0;
    border-bottom: 1px solid var(--line);
    margin: 0;
    cursor: pointer;
  }
  .switch-row:last-child {
    border-bottom: 0;
  }
  .switch-row > span {
    flex: 1;
    min-width: 0;
  }
  .switch-row strong {
    display: block;
    font-size: 14px;
    font-weight: 600;
  }
  .switch-row small {
    display: block;
    margin-top: 5px;
  }
  .switch-row input {
    appearance: none;
    flex: 0 0 40px;
    width: 40px;
    height: 24px;
    min-height: 24px;
    padding: 0;
    margin: 0;
    border-radius: 14px;
    border: 1px solid var(--muted);
    background: var(--line);
    position: relative;
    cursor: pointer;
  }
  .switch-row input::before {
    content: "";
    position: absolute;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    top: 3px;
    left: 3px;
    background: var(--muted);
    transition: transform 0.15s;
  }
  .switch-row input:checked {
    border-color: var(--accent);
    background: var(--accent);
  }
  .switch-row input:checked::before {
    background: var(--surface);
    transform: translateX(16px);
  }
  .switch-row input:disabled {
    opacity: 0.5;
    cursor: default;
  }
  .setting-help {
    border: 1px solid var(--line);
    border-radius: 10px;
    padding: 12px 14px;
    margin-top: 18px;
    font-size: 13px;
  }
  .setting-help summary {
    color: var(--accent);
    font-weight: 550;
    cursor: pointer;
  }
  .setting-help p:last-child {
    margin-bottom: 0;
  }
  .settings-note {
    border-inline-start: 3px solid var(--accent);
    padding: 10px 14px;
    color: var(--muted);
    font-size: 13px;
    background: var(--primary-background-color, #f5f7f6);
  }
  .settings-grid input,
  .settings-grid textarea,
  .settings-grid select {
    width: 100%;
  }
  .settings-card a {
    color: var(--accent);
    text-underline-offset: 3px;
  }
  @media (max-width: 600px) {
    .settings-grid {
      grid-template-columns: minmax(0, 1fr);
      gap: 16px;
    }
    .settings-card {
      border-radius: 10px;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .switch-row input::before {
      transition: none;
    }
  }
  @media (forced-colors: active) {
    .switch-row input {
      appearance: auto;
    }
    .switch-row input::before {
      display: none;
    }
  }
`;
