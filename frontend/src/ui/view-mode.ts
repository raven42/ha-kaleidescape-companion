/** Presentation mode only; Home Assistant remains the authority for permissions. */
import { html } from "lit";

export function viewModeSwitch(
  advanced: boolean,
  disabled: boolean,
  change: () => void,
) {
  return html`<button
    type="button"
    class="view-mode-pill"
    role="switch"
    aria-label="Advanced view"
    aria-checked=${advanced}
    title=${advanced ? "Switch to Basic view" : "Switch to Advanced view"}
    ?disabled=${disabled}
    @click=${change}
  >
    <span class="mode-track" aria-hidden="true"
      ><span class="mode-thumb"></span></span
    ><span class="mode-label">Adv</span>
  </button>`;
}
