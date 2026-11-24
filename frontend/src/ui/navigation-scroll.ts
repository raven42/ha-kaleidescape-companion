/** Short-lived scroll positions for Companion views; never stores content or drafts. */
import { readNavigationValue, writeNavigationValue } from "./navigation";

export class NavigationScroll {
  private timer?: ReturnType<typeof setTimeout>;
  private cancel = () => this.stop();
  constructor(
    private host: HTMLElement,
    private key: () => string,
  ) {}

  private container(): HTMLElement {
    let node: Element | null = this.host;
    while (node) {
      const parent: Element | null =
        node.parentElement ?? (node.getRootNode() as ShadowRoot).host ?? null;
      if (
        parent instanceof HTMLElement &&
        /(auto|scroll)/.test(getComputedStyle(parent).overflowY) &&
        parent.scrollHeight > parent.clientHeight
      )
        return parent;
      node = parent;
    }
    return (
      (document.scrollingElement as HTMLElement | null) ??
      document.documentElement
    );
  }
  private list() {
    const root = this.host.shadowRoot;
    const child = root?.querySelector(
      "kaleidescape-library,kaleidescape-database,kaleidescape-reader",
    );
    return (
      root?.querySelector<HTMLElement>(".entry-list") ??
      child?.shadowRoot?.querySelector<HTMLElement>(".entry-list") ??
      null
    );
  }
  save(page: string) {
    this.stop();
    const values = [this.container().scrollTop, this.list()?.scrollTop ?? 0];
    writeNavigationValue(
      `scroll:${this.key()}:${page}`,
      JSON.stringify(values),
    );
  }
  restore(page: string) {
    this.stop();
    let values: unknown;
    try {
      values = JSON.parse(
        readNavigationValue(`scroll:${this.key()}:${page}`) ?? "[0,0]",
      );
    } catch {
      values = [0, 0];
    }
    if (
      !Array.isArray(values) ||
      values.length !== 2 ||
      values.some(
        (value) =>
          typeof value !== "number" ||
          !Number.isFinite(value) ||
          value < 0 ||
          value > 10000000,
      )
    )
      return;
    const [outer, inner] = values as number[];
    let attempts = 0;
    const apply = () => {
      if (!this.host.isConnected) return this.stop();
      const container = this.container(),
        list = this.list();
      container.scrollTop = outer;
      if (list) list.scrollTop = inner;
      if (
        ++attempts >= 30 ||
        (container.scrollTop >= outer &&
          (!inner || (list && list.scrollTop >= inner)))
      )
        return this.stop();
      this.timer = setTimeout(apply, 100);
    };
    for (const event of ["wheel", "touchstart", "keydown"])
      window.addEventListener(event, this.cancel, {
        once: true,
        passive: true,
      });
    this.timer = setTimeout(apply, 0);
  }
  stop() {
    clearTimeout(this.timer);
    this.timer = undefined;
    for (const event of ["wheel", "touchstart", "keydown"])
      window.removeEventListener(event, this.cancel);
  }
}
