/** Ephemeral, visibility-triggered administrator previews; never remote image URLs. */
import { LitElement, css, html } from "lit";
import type { PropertyValues } from "lit";
import type { JournalClient, Scope } from "../core/api";
import { errorCode } from "../core/api";
import { CoverQueue } from "../library/cover";

export class ScrapeImage extends LitElement {
  static properties = {
    client: { attribute: false },
    scope: { attribute: false },
    queue: { attribute: false },
    plan: {},
    choice: {},
  };
  static styles = css`
    :host {
      display: grid;
      place-items: center;
      overflow: hidden;
      background: var(--secondary-background-color, #222);
      border-radius: 8px;
    }
    img {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }
    span {
      font: 12px system-ui;
      padding: 8px;
    }
  `;
  client?: JournalClient;
  scope?: Scope;
  queue?: CoverQueue;
  plan = "";
  choice = "";
  private observer?: IntersectionObserver;
  private controller?: AbortController;
  private visible = false;
  private url = "";
  private failed = false;
  connectedCallback() {
    super.connectedCallback();
    this.observer = new IntersectionObserver((entries) => {
      this.visible = entries.some((entry) => entry.isIntersecting);
      if (this.visible) void this.load();
    });
    this.observer.observe(this);
  }
  protected willUpdate(changed: PropertyValues) {
    if (["client", "scope", "plan", "choice"].some((key) => changed.has(key))) {
      this.clear();
      void this.load();
    }
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    this.observer?.disconnect();
    this.clear();
  }
  private clear() {
    this.controller?.abort();
    this.controller = undefined;
    if (this.url) URL.revokeObjectURL(this.url);
    this.url = "";
    this.failed = false;
  }
  private async load() {
    if (
      !this.client ||
      !this.scope ||
      !this.queue ||
      !this.visible ||
      !this.isConnected ||
      this.url ||
      this.controller
    )
      return;
    const controller = (this.controller = new AbortController());
    let release: (() => void) | undefined;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      release = await this.queue.acquire(controller.signal);
      if (controller.signal.aborted) return;
      timeout = setTimeout(() => controller.abort(), 80000);
      const blob = await this.client.titleScrapeImage(
        this.scope,
        this.plan,
        this.choice,
        controller.signal,
      );
      if (!controller.signal.aborted && this.isConnected)
        this.url = URL.createObjectURL(blob);
    } catch (error) {
      if (!controller.signal.aborted) {
        this.failed = true;
        if (errorCode(error) === "unauthorized")
          this.dispatchEvent(
            new CustomEvent("access-denied", { bubbles: true, composed: true }),
          );
      }
    } finally {
      clearTimeout(timeout);
      release?.();
      if (this.controller === controller) {
        this.controller = undefined;
        if (!this.url) this.failed = true;
      }
      this.requestUpdate();
    }
  }
  render() {
    return this.url
      ? html`<img src=${this.url} alt="" />`
      : html`<span
          >${this.failed ? "Preview unavailable" : "Loading preview…"}</span
        >`;
  }
}
if (!customElements.get("kaleidescape-scrape-image"))
  customElements.define("kaleidescape-scrape-image", ScrapeImage);
