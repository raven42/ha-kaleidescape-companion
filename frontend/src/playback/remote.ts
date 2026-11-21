/** Controls shared by the remote dialog and dashboard card. */
import { css, html, nothing, svg } from "lit";
import { actionIcon } from "../ui/action-icons";

export const REMOTE_VISIBILITY_OPTIONS = [
  ["remote_covers", "Covers"],
  ["remote_movies", "List"],
  ["remote_collections", "Collections"],
  ["remote_search", "Search"],
  ["remote_settings", "Settings"],
  ["remote_screensaver", "Screensaver"],
  ["remote_transport", "Transport Controls"],
  ["remote_intermission", "Intermission"],
  ["remote_collection_shortcuts", "Collection Shortcuts"],
] as const;
export type RemoteVisibilityKey = (typeof REMOTE_VISIBILITY_OPTIONS)[number][0];
export type RemoteVisibility = Record<RemoteVisibilityKey, boolean>;
export const DEFAULT_REMOTE_VISIBILITY = Object.fromEntries(
  REMOTE_VISIBILITY_OPTIONS.map(([key]) => [key, true]),
) as RemoteVisibility;

const icons = {
  pausedCollection: svg`<circle cx="12" cy="12" r="9"/><path d="M9 8v8m6-8v8"/>`,
  watchSoon: svg`<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>`,
  newCollection: svg`<path d="m12 2 2.2 5.2L20 9l-4.5 3.8.3 5.8L12 15.4 7.2 18.6l.3-5.8L3 9l5.8-1.8z"/>`,
  favorites: svg`<path d="M12 20S3 15 3 9a4.5 4.5 0 0 1 9-1 4.5 4.5 0 0 1 9 1c0 6-9 11-9 11z"/>`,
  screensaver: svg`<rect x="3" y="4" width="18" height="14" rx="2"/><path d="M8 21h8M12 18v3m0-13v5M9.5 10.5h5"/>`,
  standby: svg`<path d="M20 15A8 8 0 0 1 9 4a8 8 0 1 0 11 11Z"/>`,
  covers: svg`<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>`,
  movies: svg`<rect x="3" y="4" width="18" height="16" rx="1"/><path d="M7 4v16M17 4v16M3 9h4m10 0h4M3 15h4m10 0h4"/>`,
  collections: svg`<path d="m2 8 10-5 10 5-10 5-10-5Zm0 4 10 5 10-5M2 16l10 5 10-5"/>`,
  settings: svg`<circle cx="12" cy="12" r="3"/><path d="m10 2 4 0 .5 2.5 2 1 2.2-1 2.8 2.8-1 2.2 1 2L24 12l-2.5 2-.8 2 1 2.2-2.8 2.8-2.2-1-2 1L14 23h-4l-.5-2.5-2-1-2.2 1-2.8-2.8 1-2.2-1-2L0 12l2.5-2 .8-2-1-2.2L5.3 3l2.2 1 2-1z" transform="translate(1 0) scale(.92 1)"/>`,
  menu: svg`<path d="M4 6h16M4 12h16M4 18h16"/>`,
  back: svg`<path d="m9 5-6 6 6 6M3 11h11a6 6 0 0 1 0 12"/>`,
  up: svg`<path d="m5 15 7-7 7 7"/>`,
  down: svg`<path d="m5 9 7 7 7-7"/>`,
  left: svg`<path d="m15 5-7 7 7 7"/>`,
  right: svg`<path d="m9 5 7 7-7 7"/>`,
  intermission: svg`<path d="M3 9h18v11H3zM3 9 2 5l17-3 1 4zM6 4l3 4m3-5 3 4"/>`,
  previous: svg`<path fill="currentColor" stroke="none" d="M4 4h2v16H4zM20 4 8 12l12 8z"/>`,
  reverse: svg`<path fill="currentColor" stroke="none" d="M12 5 2 12l10 7zm10 0-10 7 10 7z"/>`,
  toggle: svg`<path fill="currentColor" stroke="none" d="M3 4v16l11-8zM16 4h2v16h-2zM21 4h2v16h-2z"/>`,
  forward: svg`<path fill="currentColor" stroke="none" d="m2 5 10 7-10 7zm10 0 10 7-10 7z"/>`,
  next: svg`<path fill="currentColor" stroke="none" d="M18 4h2v16h-2zM4 4l12 8-12 8z"/>`,
  replay: svg`<path d="M4 11a8 8 0 1 1 2.3 6M4 5v6h6"/>`,
  stop: svg`<rect x="5" y="5" width="14" height="14" rx="1" fill="currentColor" stroke="none"/>`,
};

function icon(name: keyof typeof icons) {
  return svg`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;
}

export const remoteStyles = css`
  .remote-dialog {
    width: min(440px, calc(100% - 24px));
    --dialog-gutter: 16px;
    padding: var(--dialog-gutter);
    border-radius: 24px;
  }
  .remote-dialog > .card-head {
    align-items: center;
  }
  .remote-dialog > .card-head h2 {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
  }
  .remote-header-icon {
    width: 32px;
    height: 32px;
    flex: none;
    object-fit: contain;
  }
  .remote-dialog:modal {
    inset-block-start: calc(
      var(--companion-viewport-top, 0px) + max(12px, env(safe-area-inset-top))
    );
    inset-block-end: auto;
    margin-block: 0;
  }
  .remote-search {
    margin-bottom: 12px;
    padding: 12px;
    border: 1px solid var(--line);
    border-radius: 14px;
  }
  .remote-search label {
    display: block;
    margin-bottom: 8px;
    font-weight: 600;
  }
  .remote-search div {
    display: flex;
    gap: 8px;
  }
  .remote-search input {
    min-width: 0;
    flex: 1;
  }
  .remote-search p {
    margin: 8px 0 0;
  }
  .remote-power {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 12px;
  }
  .remote-power button,
  .remote-bottom button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 44px;
    border-radius: 14px;
    padding: 8px 14px;
  }
  .remote-nav,
  .remote-collections,
  .remote-transport,
  .remote-bottom {
    display: grid;
    gap: 4px;
    padding: 6px;
    border: 1px solid var(--line);
    border-radius: 16px;
    background: var(--secondary-background-color, var(--surface));
  }
  .remote-nav {
    grid-template-columns: repeat(var(--remote-nav-count), minmax(0, 1fr));
  }
  .remote-nav[data-few] button {
    min-height: 72px;
    font-size: 13px;
  }
  .remote-nav[data-few] button svg {
    width: 26px;
    height: 26px;
  }
  .remote-nav button,
  .remote-side button {
    min-width: 0;
    min-height: 60px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    padding: 5px 2px;
    font-size: 12px;
    border-radius: 12px;
  }
  .remote-nav button {
    border: 0;
    background: transparent;
  }
  .remote-nav button:hover {
    background: var(--surface);
  }
  .remote-main {
    display: grid;
    grid-template-columns: minmax(52px, 0.8fr) minmax(0, 3fr) minmax(
        52px,
        0.8fr
      );
    align-items: stretch;
    gap: 3px;
    margin: 18px 0;
  }
  .remote-side {
    display: grid;
    grid-template-rows: repeat(2, 1fr);
    gap: 8px;
  }
  .remote-side button {
    position: relative;
    border-color: transparent;
  }
  .remote-side button:hover:not(:disabled) {
    border-color: transparent;
  }
  .remote-side .remote-cut-border {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    color: var(--line);
  }
  .remote-side button:hover:not(:disabled) .remote-cut-border,
  .remote-side button:focus-visible .remote-cut-border {
    color: var(--accent);
  }
  .remote-pad {
    position: relative;
    width: 100%;
    max-width: 300px;
    aspect-ratio: 1;
    border-radius: 50%;
    margin: auto;
    background: var(--secondary-background-color, #e0e6ec);
    border: 2px solid var(--line);
  }
  .remote-side:first-child button:first-child {
    clip-path: polygon(
      0 0,
      100% 0,
      100% 35%,
      94% 55%,
      82% 75%,
      68% 100%,
      0 100%
    );
    padding-right: 16%;
  }
  .remote-side:first-child button:last-child {
    clip-path: polygon(
      0 0,
      68% 0,
      82% 25%,
      94% 45%,
      100% 65%,
      100% 100%,
      0 100%
    );
    padding-right: 16%;
  }
  .remote-side:last-child button:first-child {
    clip-path: polygon(
      0 0,
      100% 0,
      100% 100%,
      32% 100%,
      18% 75%,
      6% 55%,
      0 35%
    );
    padding-left: 16%;
  }
  .remote-side:last-child button:last-child {
    clip-path: polygon(
      32% 0,
      100% 0,
      100% 100%,
      0 100%,
      0 65%,
      6% 45%,
      18% 25%
    );
    padding-left: 16%;
  }
  .remote-pad button {
    position: absolute;
    border: 0;
    background: transparent;
    padding: 0;
    border-radius: 50%;
  }
  .remote-pad .remote-up {
    top: 1%;
    left: 33%;
    width: 34%;
    height: 27%;
  }
  .remote-pad .remote-down {
    bottom: 1%;
    left: 33%;
    width: 34%;
    height: 27%;
  }
  .remote-pad .remote-left {
    top: 33%;
    left: 1%;
    width: 27%;
    height: 34%;
  }
  .remote-pad .remote-right {
    top: 33%;
    right: 1%;
    width: 27%;
    height: 34%;
  }
  .remote-pad .remote-select {
    inset: 25%;
    width: 50%;
    height: 50%;
    background: var(--surface);
    border: 2px solid var(--line);
    font-size: 14px;
    font-weight: 700;
  }
  .remote-collections {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
  .remote-collections button {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 5px;
    min-width: 0;
    min-height: 64px;
    padding: 6px 2px;
    font-size: 12px;
    border: 0;
    background: transparent;
  }
  .remote-collections button:hover:not(:disabled) {
    background: var(--surface);
  }
  .remote-transport {
    grid-template-columns: repeat(5, minmax(0, 1fr));
    align-items: center;
    margin-bottom: 12px;
  }
  .remote-transport button {
    justify-self: center;
    display: grid;
    place-items: center;
    padding: 0;
    width: clamp(38px, 9vw, 50px);
    height: clamp(38px, 9vw, 50px);
    min-height: 38px;
    border-radius: 50%;
  }
  .remote-transport button.primary {
    width: clamp(46px, 11vw, 60px);
    height: clamp(46px, 11vw, 60px);
  }
  .remote-bottom {
    grid-template-columns: repeat(var(--remote-bottom-count), minmax(0, 1fr));
  }
  .remote-bottom button {
    border: 0;
    background: transparent;
  }
  .remote-bottom button + button {
    border-left: 1px solid var(--line);
    border-radius: 0;
  }
  .remote-dialog svg,
  .remote-power svg,
  .remote-nav svg,
  .remote-main svg,
  .remote-transport svg,
  .remote-collections svg,
  .remote-bottom svg {
    width: 22px;
    height: 22px;
    flex: none;
  }
  @media (max-width: 380px) {
    .remote-dialog {
      --dialog-gutter: 12px;
      width: calc(100% - 16px);
    }
    .remote-main {
      grid-template-columns: minmax(48px, 0.8fr) minmax(0, 3fr) minmax(
          48px,
          0.8fr
        );
      gap: 3px;
    }
    .remote-side button,
    .remote-nav button {
      font-size: 11px;
    }
  }
`;

export function remoteControls(
  disabled: boolean,
  ready: boolean,
  playing: boolean,
  visibility: RemoteVisibility,
  send: (operation: string) => void,
) {
  const button = (
    operation: string,
    label: string,
    image: unknown,
    className = "",
    showLabel = true,
    borderPath = "",
  ) =>
    html`<button
      type="button"
      class=${className}
      aria-label=${label}
      title=${label}
      ?disabled=${disabled || (!ready && !operation.startsWith("power_"))}
      @click=${() => send(operation)}
    >
      ${image}${showLabel ? html`<span>${label}</span>` : ""}
      ${
        borderPath
          ? svg`<svg class="remote-cut-border" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d=${borderPath} fill="none" stroke="currentColor" stroke-width="1" vector-effect="non-scaling-stroke" /></svg>`
          : ""
      }
    </button>`;

  const navigationCount = [
    visibility.remote_covers,
    visibility.remote_movies,
    visibility.remote_collections,
    visibility.remote_search,
    visibility.remote_settings,
  ].filter(Boolean).length;
  const bottomCount =
    (visibility.remote_transport ? 2 : 0) +
    (visibility.remote_intermission ? 1 : 0);
  return html`
    <div class="remote-power">
      ${button("power_on", "Power on", actionIcon("power"))}
      ${visibility.remote_screensaver ? button("screensaver", "Screensaver", icon("screensaver"), "", false) : nothing}
      ${button("power_off", "Standby", icon("standby"))}
    </div>
    ${
      navigationCount
        ? html`<div
            class="remote-nav"
            style=${`--remote-nav-count: ${navigationCount}`}
            ?data-few=${navigationCount <= 3}
          >
            ${visibility.remote_covers ? button("movies", "Covers", icon("covers")) : nothing}
            ${visibility.remote_movies ? button("movie_list", "List", icon("movies")) : nothing}
            ${visibility.remote_collections ? button("movie_collections", "Collections", icon("collections")) : nothing}
            ${visibility.remote_search ? button("search", "Search", actionIcon("search")) : nothing}
            ${visibility.remote_settings ? button("status_and_settings", "Settings", icon("settings")) : nothing}
          </div>`
        : nothing
    }
    <div class="remote-main">
      <div class="remote-side">
        ${button("menu", "Menu", icon("menu"), "", true, "M 12 1 H 88 Q 99 1 99 8 V 35 L 93 55 L 81 75 L 67 99 H 12 Q 1 99 1 92 V 8 Q 1 1 12 1 Z")}
        ${button("back", "Back", icon("back"), "", true, "M 12 1 H 67 L 81 25 L 93 45 L 99 65 V 92 Q 99 99 88 99 H 12 Q 1 99 1 92 V 8 Q 1 1 12 1 Z")}
      </div>
      <div class="remote-pad" role="group" aria-label="Directional controls">
        ${button("up", "Up", icon("up"), "remote-up", false)}
        ${button("left", "Left", icon("left"), "remote-left", false)}
        ${button("select", "Select", "", "remote-select")}
        ${button("right", "Right", icon("right"), "remote-right", false)}
        ${button("down", "Down", icon("down"), "remote-down", false)}
      </div>
      <div class="remote-side">
        ${button("page_up", "Page up", icon("up"), "", true, "M 12 1 H 88 Q 99 1 99 8 V 92 Q 99 99 88 99 H 33 L 19 75 L 7 55 L 1 35 V 8 Q 1 1 12 1 Z")}
        ${button("page_down", "Page down", icon("down"), "", true, "M 33 1 H 88 Q 99 1 99 8 V 92 Q 99 99 88 99 H 12 Q 1 99 1 92 V 65 L 7 45 L 19 25 Z")}
      </div>
    </div>
    ${
      playing
        ? html`
            ${
              visibility.remote_transport
                ? html`<div class="remote-transport">
                    ${button("previous", "Previous chapter", icon("previous"), "", false)}
                    ${button("scan_reverse", "Scan reverse", icon("reverse"), "", false)}
                    ${button("play_pause", "Play/Pause", icon("toggle"), "primary", false)}
                    ${button("scan_forward", "Scan forward", icon("forward"), "", false)}
                    ${button("next", "Next chapter", icon("next"), "", false)}
                  </div>`
                : nothing
            }
            ${
              bottomCount
                ? html`<div
                    class="remote-bottom"
                    style=${`--remote-bottom-count: ${bottomCount}`}
                  >
                    ${visibility.remote_transport ? button("replay", "Replay", icon("replay")) : nothing}
                    ${visibility.remote_transport ? button("stop", "Stop", icon("stop")) : nothing}
                    ${visibility.remote_intermission ? button("intermission", "Intermission", icon("intermission")) : nothing}
                  </div>`
                : nothing
            }
          `
        : visibility.remote_collection_shortcuts
          ? html`<div
              class="remote-collections"
              role="group"
              aria-label="Collection shortcuts"
            >
              ${button("collection_paused", "Paused", icon("pausedCollection"))}
              ${button("collection_watch_soon", "Watch Soon", icon("watchSoon"))}
              ${button("collection_new", "New", icon("newCollection"))}
              ${button("collection_favorites", "Favorites", icon("favorites"))}
            </div>`
          : nothing
    }
  `;
}
