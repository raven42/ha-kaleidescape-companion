/** Switch saved layout categories after dialogs and content writes have settled. */
import type { LitElement, ReactiveController } from "lit";
import { displayProfile } from "../core/display-profile";

const SIGNALS = [
  "close",
  "cancel",
  "control-lock",
  "edit-lock",
  "scrape-lock",
  "collection-lock",
];

class ProfileController implements ReactiveController {
  private profile = displayProfile();
  private frame?: number;
  constructor(
    private host: LitElement,
    private change: () => boolean,
  ) {}
  hostConnected() {
    window.addEventListener("resize", this.schedule);
    for (const signal of SIGNALS)
      this.host.renderRoot.addEventListener(signal, this.schedule, true);
  }
  hostUpdated() {
    this.schedule();
  }
  private schedule = () => {
    if (this.frame !== undefined || displayProfile() === this.profile) return;
    // Avoid scheduling a Lit update from inside its completed update lifecycle.
    this.frame = requestAnimationFrame(() => {
      this.frame = undefined;
      const next = displayProfile();
      if (this.host.isConnected && next !== this.profile && this.change())
        this.profile = next;
    });
  };
  hostDisconnected() {
    window.removeEventListener("resize", this.schedule);
    for (const signal of SIGNALS)
      this.host.renderRoot.removeEventListener(signal, this.schedule, true);
    if (this.frame !== undefined) cancelAnimationFrame(this.frame);
    this.frame = undefined;
  }
}
export function responsivePreferences(host: LitElement, change: () => boolean) {
  host.addController(new ProfileController(host, change));
}
