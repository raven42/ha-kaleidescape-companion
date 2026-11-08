/** Presentation mode only; Home Assistant remains the authority for permissions. */
import { html } from "lit";

export function viewModeSwitch(
  advanced: boolean,
  disabled: boolean,
  change: () => void,
) {
  return html`<button
    type="button"
    class="view-mode-switch"
    role="switch"
    aria-label="Advanced view"
    aria-checked=${advanced}
    title=${advanced ? "Switch to Basic view" : "Switch to Advanced view"}
    ?disabled=${disabled}
    @click=${change}
  >
    <span class="mode-label">${advanced ? "Advanced" : "Basic"}</span>
    <span class="mode-track" aria-hidden="true"
      ><span class="mode-thumb"></span
    ></span>
  </button>`;
}
