/** Keep split panes and dialogs inside the visible viewport, including keyboards. */
import type { LitElement, ReactiveController } from "lit";

class ViewportController implements ReactiveController {
  private observer?: ResizeObserver;
  private observed: Element[] = [];
  private containers: Element[] = [];
  private frame?: number;
  private viewport?: VisualViewport | null;

  constructor(
    private host: LitElement,
    private resized?: () => void,
  ) {}

  hostConnected() {
    this.viewport = window.visualViewport;
    window.addEventListener("resize", this.schedule);
    this.viewport?.addEventListener("resize", this.schedule);
    this.viewport?.addEventListener("scroll", this.schedule);
    this.observer = new ResizeObserver(this.schedule);
    this.host.requestUpdate();
    this.schedule();
  }

  hostUpdated() {
    const containers: Element[] = [];
    let parent: Element | null = this.host;
    // HA embeds panels across shadow roots. Observe their allotted space too;
    // sidebar/header/container changes need not dispatch window.resize.
    while (parent && containers.length < 32) {
      containers.push(parent);
      parent =
        parent.parentElement ??
        (parent.getRootNode() as ShadowRoot).host ??
        null;
    }
    const nodes = [
      ...this.host.renderRoot.querySelectorAll(
        ".entries-header, .entries-footer",
      ),
    ];
    if (
      nodes.length !== this.observed.length ||
      nodes.some((node, i) => node !== this.observed[i]) ||
      containers.length !== this.containers.length ||
      containers.some((node, i) => node !== this.containers[i])
    ) {
      this.observer?.disconnect();
      [...nodes, ...containers].forEach((node) => this.observer?.observe(node));
      this.observed = nodes;
      this.containers = containers;
    }
    this.schedule();
  }

  private schedule = () => {
    if (this.frame !== undefined || !this.host.isConnected) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = undefined;
      if (!this.host.isConnected) return;
      const height = Math.min(
        window.innerHeight,
        this.viewport?.height ?? window.innerHeight,
        document.documentElement.clientHeight || window.innerHeight,
      );
      const top = Math.max(0, this.viewport?.offsetTop ?? 0);
      const bottom = Math.max(0, window.innerHeight - height - top);
      const chrome = this.observed.reduce(
        (total, node) => total + node.getBoundingClientRect().height,
        0,
      );
      const stickyTop =
        parseFloat(
          getComputedStyle(this.host).getPropertyValue(
            "--companion-sticky-top",
          ),
        ) || 0;
      const header = this.observed.find((node) =>
        node.classList.contains("entries-header"),
      );
      const footer = this.observed.find((node) =>
        node.classList.contains("entries-footer"),
      );
      const layout = this.host.renderRoot.querySelector(".entries-layout");
      const contentTop = Math.max(
        top + stickyTop + (header?.getBoundingClientRect().height ?? 0),
        layout?.getBoundingClientRect().top ?? 0,
      );
      let contentBottom = top + height;
      for (const node of this.containers.slice(1)) {
        if (!/(auto|scroll|hidden|clip)/.test(getComputedStyle(node).overflowY))
          continue;
        const rect = node.getBoundingClientRect();
        if (rect.height > 0)
          contentBottom = Math.min(contentBottom, rect.bottom);
      }
      const values = {
        "--companion-viewport-height": height,
        "--companion-viewport-top": top,
        "--companion-viewport-bottom": bottom,
        "--entries-height": Math.max(
          180,
          layout
            ? contentBottom -
                contentTop -
                (footer?.getBoundingClientRect().height ?? 0) -
                16
            : height - chrome - stickyTop - 16,
        ),
      };
      let changed = false;
      for (const [name, value] of Object.entries(values)) {
        const pixels = `${Math.round(value)}px`;
        if (this.host.style.getPropertyValue(name) !== pixels) {
          this.host.style.setProperty(name, pixels);
          changed = true;
        }
      }
      if (changed) this.resized?.();
    });
  };

  hostDisconnected() {
    window.removeEventListener("resize", this.schedule);
    this.viewport?.removeEventListener("resize", this.schedule);
    this.viewport?.removeEventListener("scroll", this.schedule);
    this.viewport = undefined;
    this.observer?.disconnect();
    this.observer = undefined;
    this.observed = [];
    this.containers = [];
    if (this.frame !== undefined) cancelAnimationFrame(this.frame);
    this.frame = undefined;
  }
}

export function responsiveViewport(host: LitElement, resized?: () => void) {
  host.addController(new ViewportController(host, resized));
}
