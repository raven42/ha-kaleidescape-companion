/** Fixed remote intents and presentation; transport/permissions stay in controls. */
import { css, html } from "lit";

export const remoteStyles = css`
  .remote-dialog {
    width: min(390px, calc(100% - 24px));
    padding: 22px;
    border-radius: 24px;
  }
  .remote-top {
    display: flex;
    align-items: center;
    gap: 12px;
    padding-bottom: 18px;
    border-bottom: 1px solid var(--line);
  }
  .remote-player {
    margin: 0;
    flex: 1;
    color: var(--muted);
  }
  .remote-round {
    border-radius: 50%;
    width: 44px;
    min-height: 44px;
    padding: 0;
    font-size: 22px;
  }
  .remote-navigation {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    margin: 22px 0;
  }
  .remote-navigation button,
  .remote-resume {
    border-radius: 999px;
    padding: 10px 8px;
  }
  .remote-pad {
    position: relative;
    width: min(100%, 290px);
    aspect-ratio: 1;
    border-radius: 50%;
    margin: 24px auto;
    background: var(--secondary-background-color, #e0e6ec);
    border: 2px solid var(--line);
  }
  .remote-pad button {
    position: absolute;
    border: 0;
    background: transparent;
    padding: 0;
    border-radius: 50%;
    font-size: 30px;
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
    font-size: 15px;
    font-weight: 700;
  }
  .remote-transport {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    padding: 22px 0 16px;
    border-top: 1px solid var(--line);
  }
  .remote-resume {
    width: 100%;
  }
`;

export function remoteControls(
  name: string,
  disabled: boolean,
  ready: boolean,
  send: (operation: string) => void,
) {
  const button = (
    operation: string,
    label: string,
    symbol: string,
    className = "",
  ) =>
    html` <button
      type="button"
      class=${className}
      aria-label=${label}
      title=${label}
      ?disabled=${disabled || (!ready && !operation.startsWith("power_"))}
      @click=${() => send(operation)}
    >
      <span aria-hidden="true">${symbol}</span>
    </button>`;
  return html`
    <div class="remote-top">
      <p class="remote-player">${name}</p>
      ${button("power_on", "Power on", "⏻", "remote-round")}
      ${button("power_off", "Standby", "☾", "remote-round")}
    </div>
    <div class="remote-navigation">
      <button ?disabled=${disabled || !ready} @click=${() => send("movies")}>
        ▦ Covers
      </button>
      <button ?disabled=${disabled || !ready} @click=${() => send("menu")}>
        ☰ Menu
      </button>
      <button ?disabled=${disabled || !ready} @click=${() => send("back")}>
        ↶ Back
      </button>
    </div>
    <div class="remote-pad" role="group" aria-label="Directional controls">
      ${button("up", "Up", "⌃", "remote-up")}
      ${button("left", "Left", "‹", "remote-left")}
      ${button("select", "Select", "SELECT", "remote-select")}
      ${button("right", "Right", "›", "remote-right")}
      ${button("down", "Down", "⌄", "remote-down")}
    </div>
    <div class="remote-transport">
      ${button("previous", "Previous chapter", "|◀", "remote-round")}
      ${button("stop", "Stop", "■", "remote-round")}
      ${button("play", "Play selection", "▶", "remote-round primary")}
      ${button("pause", "Pause", "Ⅱ", "remote-round")}
      ${button("next", "Next chapter", "▶|", "remote-round")}
    </div>
    <button
      class="remote-resume"
      ?disabled=${disabled || !ready}
      @click=${() => send("resume")}
    >
      ▶ Resume Playback
    </button>
  `;
}
