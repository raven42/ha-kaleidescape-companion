/** Local, inert line icons and keyboard-accessible action tooltips. */
import { css, html, svg } from "lit";

export type ActionIcon =
  | "add"
  | "collection"
  | "refresh"
  | "edit"
  | "scrape"
  | "artwork"
  | "power"
  | "play"
  | "search"
  | "filter"
  | "clear"
  | "shuffle"
  | "ascending"
  | "descending"
  | "options"
  | "first"
  | "previous"
  | "next";
export function actionIcon(kind: ActionIcon) {
  const paths = {
    add: svg`<path d="M12 4v16M4 12h16"/>`,
    search: svg`<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>`,
    filter: svg`<path d="M3 5h18l-7 8v6l-4 2v-8z"/>`,
    clear: svg`<path d="m6 6 12 12M18 6 6 18"/>`,
    shuffle: svg`<path d="M3 6h3c5 0 7 12 12 12h3m-4-4 4 4-4 4M3 18h3c2 0 4-3 6-6s4-6 6-6h3m-4-4 4 4-4 4"/>`,
    ascending: svg`<path d="M7 20V4m-4 4 4-4 4 4m3-1h7m-7 5h5m-5 5h3"/>`,
    descending: svg`<path d="M7 4v16m-4-4 4 4 4-4m3-9h3m-3 5h5m-5 5h7"/>`,
    options: svg`<path d="M4 6h16M4 12h16M4 18h16"/><circle cx="9" cy="6" r="2" fill="var(--surface)"/><circle cx="15" cy="12" r="2" fill="var(--surface)"/><circle cx="8" cy="18" r="2" fill="var(--surface)"/>`,
    first: svg`<path d="M5 5v14m13-14-7 7 7 7"/>`,
    previous: svg`<path d="m15 5-7 7 7 7"/>`,
    next: svg`<path d="m9 5 7 7-7 7"/>`,
    collection: svg`<path fill="#ffca28" stroke="#ffca28" d="M6 2h12v20l-6-4-6 4z"/><path fill="#302b16" stroke="none" d="m12 5 1.5 3 3.3.5-2.4 2.3.6 3.3-3-1.6-3 1.6.6-3.3-2.4-2.3 3.3-.5z"/>`,
    refresh: svg`<path d="M20 7v5h-5M4 17v-5h5"/><path d="M5.6 9A7 7 0 0 1 18 6l2 6M4 12l2 6a7 7 0 0 0 12.4-3"/>`,
    edit: svg`<path d="m15 4 5 5M4 20l4-1 12-12a2.1 2.1 0 0 0-3-3L5 16zM4 20h8"/>`,
    scrape: svg`<path d="M3 9h15v4M3 9l-1-4 14-3 1 4zM6 4l3 4m3-5 3 4M3 9v11h8"/><circle cx="16" cy="16" r="4"/><path d="m19 19 3 3M6 13h3m-3 3h2"/>`,
    artwork: svg`<rect x="8" y="2" width="13" height="9" rx="1"/><path d="m10 9 3-3 2 2 2-3 2 2"/><rect x="3" y="14" width="13" height="9" rx="1"/><path d="m5 21 3-3 2 2 2-3 2 2M3 10V6h3m0 0L4 4m2 2L4 8m17 6v4h-3m0 0 2-2m-2 2 2 2"/>`,
    power: svg`<path d="M12 2v10M6 5a9 9 0 1 0 12 0"/>`,
    play: svg`<path fill="currentColor" stroke="none" d="M7 3v18l15-9z"/>`,
  };
  return svg`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[kind]}</svg>`;
}

export const iconActionStyles = css`
  .icon-action-wrap {
    position: relative;
    display: inline-flex;
  }
  .icon-action {
    width: 44px;
    height: 44px;
    min-height: 44px;
    padding: 9px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
  }
  .icon-action svg {
    width: 24px;
    height: 24px;
    flex: none;
  }
  .icon-action-label {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
  .action-tooltip {
    position: absolute;
    inset-block-end: calc(100% + 8px);
    inset-inline-end: 0;
    z-index: 30;
    width: max-content;
    max-width: min(220px, 70vw);
    padding: 6px 10px;
    border: 1px solid var(--line);
    border-radius: 7px;
    background: var(--surface, #202020);
    color: var(--primary-text-color, #fff);
    font: 12px/1.4 system-ui;
    box-shadow: 0 3px 12px #0006;
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
  }
  .action-tooltip::after {
    content: "";
    position: absolute;
    top: 100%;
    right: 15px;
    border: 5px solid transparent;
    border-top-color: var(--surface, #202020);
  }
  .icon-action-wrap:not([data-tooltip-dismissed]):hover .action-tooltip,
  .icon-action-wrap:not([data-tooltip-dismissed]):has(
      .icon-action:focus-visible
    )
    .action-tooltip {
    opacity: 1;
    visibility: visible;
  }
`;

export function iconAction(
  label: string,
  icon: ActionIcon,
  disabled: boolean,
  activate: () => unknown,
  className = "",
) {
  return html`<span
    class="icon-action-wrap"
    @pointerenter=${(event: PointerEvent) => (event.currentTarget as HTMLElement).removeAttribute("data-tooltip-dismissed")}
    @focusin=${(event: FocusEvent) => {
      if ((event.target as HTMLElement).matches(":focus-visible"))
        (event.currentTarget as HTMLElement).removeAttribute(
          "data-tooltip-dismissed",
        );
    }}
    ><button
      type="button"
      class=${`icon-action ${className}`}
      aria-label=${label}
      aria-describedby="action-tooltip"
      ?disabled=${disabled}
      @click=${(event: MouseEvent) => {
        (event.currentTarget as HTMLElement).parentElement!.setAttribute(
          "data-tooltip-dismissed",
          "",
        );
        void activate();
      }}
    >
      ${actionIcon(icon)}<span class="icon-action-label">${label}</span></button
    ><span class="action-tooltip" id="action-tooltip" role="tooltip"
      >${label}</span
    ></span
  >`;
}
