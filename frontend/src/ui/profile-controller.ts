/** Switch saved layout categories after dialogs and content writes have settled. */
import type { LitElement, ReactiveController } from "lit";
import { displayProfile } from "../core/display-profile";

class ProfileController implements ReactiveController {
  private profile = displayProfile();
  private frame?: number;
  constructor(
    private host: LitElement,
    private change: () => boolean,
  ) {}
  hostConnected() {
    window.addEventListener("resize", this.schedule);
    this.host.renderRoot.addEventListener("close", this.schedule, true);
    this.host.renderRoot.addEventListener("cancel", this.schedule, true);
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
    this.host.renderRoot.removeEventListener("close", this.schedule, true);
    this.host.renderRoot.removeEventListener("cancel", this.schedule, true);
    if (this.frame !== undefined) cancelAnimationFrame(this.frame);
    this.frame = undefined;
  }
}
export function responsivePreferences(host: LitElement, change: () => boolean) {
  host.addController(new ProfileController(host, change));
}
