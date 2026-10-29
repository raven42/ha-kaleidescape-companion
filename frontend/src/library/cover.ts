/** Visibility-scoped, authenticated cover blobs with a per-Library request limit. */
import { LitElement, css, html } from "lit";
import type { PropertyValues } from "lit";
import { errorCode } from "../core/api";
import type { JournalClient, JournalInfo } from "../core/api";

export class CoverQueue {
  private active = 0;
  private waiting: (() => void)[] = [];
  acquire(signal: AbortSignal): Promise<() => void> {
    return new Promise((resolve, reject) => {
      const abort = () => {
        this.waiting = this.waiting.filter((item) => item !== start);
        reject(new DOMException("Aborted", "AbortError"));
      };
      const start = () => {
        signal.removeEventListener("abort", abort);
        this.active++;
        let released = false;
        resolve(() => {
          if (released) return;
          released = true;
          this.active--;
          this.waiting.shift()?.();
        });
      };
      if (signal.aborted) return abort();
      if (this.active < 3) start();
      else {
        this.waiting.push(start);
        signal.addEventListener("abort", abort, { once: true });
      }
    });
  }
}

export class LibraryCover extends LitElement {
  static properties = {
    client: { attribute: false },
    scope: { attribute: false },
    queue: { attribute: false },
    artworkKey: { attribute: false },
    title: { type: String },
  };
  static styles = css`
    :host {
      display: grid;
      width: 100%;
      height: 100%;
      place-items: center;
      background: var(--secondary-background-color, #262626);
      overflow: hidden;
    }
    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    span {
      padding: 8px;
      color: var(--secondary-text-color, #888);
      font: inherit;
    }
  `;
  client?: JournalClient;
  scope?: JournalInfo;
  queue?: CoverQueue;
  artworkKey?: string | null;
  title = "";
  private observer?: IntersectionObserver;
  private visible = false;
  private controller?: AbortController;
  private generation = 0;
  private url?: string;
  private visibility = () => {
    if (document.hidden) this.clear();
    else void this.load();
  };
  connectedCallback() {
    super.connectedCallback();
    document.addEventListener("visibilitychange", this.visibility);
    this.observer = new IntersectionObserver((entries) => {
      this.visible = entries.some((entry) => entry.isIntersecting);
      if (this.visible) void this.load();
      else this.clear();
    });
    this.observer.observe(this);
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener("visibilitychange", this.visibility);
    this.observer?.disconnect();
    this.clear();
  }
  protected updated(changed: PropertyValues) {
    if (
      ["client", "scope", "artworkKey", "queue"].some((key) => changed.has(key))
    ) {
      this.clear();
      void this.load();
    }
  }
  private clear() {
    this.generation++;
    this.controller?.abort();
    this.controller = undefined;
    if (this.url) {
      URL.revokeObjectURL(this.url);
      this.url = undefined;
      this.requestUpdate();
    }
  }
  private async load() {
    if (
      !this.visible ||
      document.hidden ||
      !this.isConnected ||
      this.controller ||
      this.url ||
      !this.client ||
      !this.scope?.library_enabled ||
      !this.artworkKey ||
      !this.queue
    )
      return;
    const generation = this.generation;
    const controller = (this.controller = new AbortController());
    let release: (() => void) | undefined;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      release = await this.queue.acquire(controller.signal);
      if (controller.signal.aborted) return;
      timeout = setTimeout(() => controller.abort(), 5000);
      const blob = await this.client.libraryArtwork(
        this.scope,
        this.artworkKey,
        controller.signal,
      );
      if (
        generation !== this.generation ||
        controller.signal.aborted ||
        !this.isConnected ||
        document.hidden
      )
        return;
      this.url = URL.createObjectURL(blob);
      this.requestUpdate();
    } catch (error) {
      if (generation === this.generation && errorCode(error) === "unauthorized")
        this.dispatchEvent(
          new CustomEvent("access-denied", { bubbles: true, composed: true }),
        );
    } finally {
      clearTimeout(timeout);
      release?.();
      if (generation === this.generation) this.controller = undefined;
    }
  }
  protected render() {
    return this.url
      ? html`<img
          src=${this.url}
          alt=${`Cover for ${this.title}`}
          @error=${this.clear}
        />`
      : html`<span>No cached artwork</span>`;
  }
}
if (!customElements.get("kaleidescape-library-cover"))
  customElements.define("kaleidescape-library-cover", LibraryCover);
