/** Near-viewport fetching with bounded session retention of completed covers. */
import { LitElement, css, html } from "lit";
import type { PropertyValues } from "lit";
import { errorCode } from "../core/api";
import type { JournalClient, JournalInfo } from "../core/api";
import { CoverCache } from "./image-cache";
import { LibraryPageCache } from "./page-cache";

export class CoverQueue {
  readonly cache = new CoverCache();
  private active = 0;
  private waiting: { start: () => void; background: boolean }[] = [];
  acquire(signal: AbortSignal, background = false): Promise<() => void> {
    return new Promise((resolve, reject) => {
      const abort = () => {
        this.waiting = this.waiting.filter((item) => item.start !== start);
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
          this.waiting.shift()?.start();
        });
      };
      if (signal.aborted) return abort();
      if (this.active < 3) start();
      else {
        const item = { start, background };
        const firstBackground = this.waiting.findIndex(
          (entry) => entry.background,
        );
        if (!background && firstBackground >= 0)
          this.waiting.splice(firstBackground, 0, item);
        else this.waiting.push(item);
        signal.addEventListener("abort", abort, { once: true });
      }
    });
  }
  async prefetch(
    client: JournalClient,
    scope: JournalInfo,
    keys: string[],
    signal: AbortSignal,
    onDenied: () => void,
  ) {
    for (const artwork of new Set(keys)) {
      if (signal.aborted) return;
      const key = JSON.stringify([scope.entry_id, scope.dataset_id, artwork]);
      if (this.cache.get(key)) continue;
      let release: (() => void) | undefined;
      const controller = new AbortController();
      const abort = () => controller.abort();
      signal.addEventListener("abort", abort, { once: true });
      let timeout: ReturnType<typeof setTimeout> | undefined;
      try {
        release = await this.acquire(controller.signal, true);
        if (
          signal.aborted ||
          this.cache.get(key) ||
          (await this.cache.restore(key))
        )
          continue;
        if (signal.aborted) return;
        timeout = setTimeout(abort, 5000);
        const blob = await client.libraryArtwork(
          scope,
          artwork,
          controller.signal,
        );
        if (!signal.aborted && !controller.signal.aborted)
          this.cache.put(key, blob);
      } catch (error) {
        if (!signal.aborted && errorCode(error) === "unauthorized") {
          onDenied();
          return;
        }
      } finally {
        clearTimeout(timeout);
        signal.removeEventListener("abort", abort);
        release?.();
      }
    }
  }
}

/** Own a cover cache for one authenticated panel and Library scope. */
export class CoverSession {
  private key = "";
  queue = new CoverQueue();
  pages = new LibraryPageCache();
  bind(scope: JournalInfo) {
    const key = JSON.stringify([
      scope.entry_id,
      scope.dataset_id,
      scope.library_enabled,
      scope.permissions.read,
      scope.permissions.edit,
    ]);
    if (key !== this.key) {
      this.reset();
      this.key = key;
    }
  }
  reset() {
    this.queue.cache.dispose();
    this.pages.dispose();
    this.pages = new LibraryPageCache();
    this.queue = new CoverQueue();
    this.key = "";
  }
}

export class LibraryCover extends LitElement {
  static properties = {
    client: { attribute: false },
    scope: { attribute: false },
    queue: { attribute: false },
    artworkKey: { attribute: false },
    fit: { type: String },
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
  fit: "cover" | "contain" = "cover";
  title = "";
  private observer?: IntersectionObserver;
  private visible = false;
  private controller?: AbortController;
  private generation = 0;
  private url?: string;
  private failed = false;
  private unwatch?: () => void;
  private get cacheKey() {
    return JSON.stringify([
      this.scope?.entry_id,
      this.scope?.dataset_id,
      this.artworkKey,
    ]);
  }
  private visibility = () => {
    if (document.hidden) this.cancelLoad();
    else void this.load();
  };
  connectedCallback() {
    super.connectedCallback();
    document.addEventListener("visibilitychange", this.visibility);
    this.observer = new IntersectionObserver(
      (entries) => {
        this.visible = entries.some((entry) => entry.isIntersecting);
        if (this.visible) void this.load();
        else this.cancelLoad();
      },
      { rootMargin: "600px 0px" },
    );
    this.observer.observe(this);
    this.requestUpdate("queue");
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener("visibilitychange", this.visibility);
    this.observer?.disconnect();
    this.visible = false;
    this.clear();
    this.requestUpdate();
  }
  protected willUpdate(changed: PropertyValues) {
    if (
      ["client", "scope", "artworkKey", "queue"].some((key) => changed.has(key))
    ) {
      this.clear();
      this.unwatch = this.queue?.cache.watch(this.cacheKey, {
        invalidate: () => {
          this.url = undefined;
          this.requestUpdate();
        },
        visible: () => this.visible && this.isConnected && !document.hidden,
        refresh: () => void this.load(),
      });
      void this.load();
    }
  }
  private cancelLoad() {
    this.generation++;
    this.controller?.abort();
    this.controller = undefined;
  }
  private clear() {
    this.cancelLoad();
    this.unwatch?.();
    this.unwatch = undefined;
    this.url = undefined;
    this.failed = false;
  }
  private async load() {
    if (
      !this.visible ||
      document.hidden ||
      !this.isConnected ||
      this.controller ||
      !this.client ||
      !this.scope?.library_enabled ||
      !this.artworkKey ||
      !this.queue
    )
      return;
    const cached = this.queue.cache.get(this.cacheKey);
    if (cached) {
      if (this.url !== cached) {
        this.url = cached;
        this.requestUpdate();
      }
      return;
    }
    this.failed = false;
    const generation = this.generation;
    const controller = (this.controller = new AbortController());
    let release: (() => void) | undefined;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      release = await this.queue.acquire(controller.signal);
      if (controller.signal.aborted) return;
      const cached = this.queue.cache.get(this.cacheKey);
      if (cached) {
        this.url = cached;
        this.requestUpdate();
        return;
      }
      const restored = await this.queue.cache.restore(this.cacheKey);
      if (
        generation !== this.generation ||
        controller.signal.aborted ||
        !this.isConnected ||
        document.hidden
      )
        return;
      if (restored) {
        this.url = restored;
        this.requestUpdate();
        return;
      }
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
      this.url = this.queue.cache.put(this.cacheKey, blob);
      this.requestUpdate();
    } catch (error) {
      if (generation === this.generation) {
        this.failed = true;
        this.requestUpdate();
      }
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
          style=${`object-fit: ${this.fit}`}
          @error=${() => {
            this.failed = true;
            this.queue?.cache.discard(this.cacheKey);
          }}
        />`
      : html`<span
          >${this.artworkKey && !this.failed ? "Loading artwork…" : "No cached artwork"}</span
        >`;
  }
}
if (!customElements.get("kaleidescape-library-cover"))
  customElements.define("kaleidescape-library-cover", LibraryCover);
