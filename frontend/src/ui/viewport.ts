/** Keep split panes and dialogs inside the visible viewport, including keyboards. */
import type { LitElement, ReactiveController } from "lit";

class ViewportController implements ReactiveController {
  private observer?: ResizeObserver;
  private observed: Element[] = [];
  private frame?: number;
  private viewport?: VisualViewport | null;

  constructor(private host: LitElement) {}

  hostConnected() {
    this.viewport = window.visualViewport;
    window.addEventListener("resize", this.schedule);
    this.viewport?.addEventListener("resize", this.schedule);
    this.viewport?.addEventListener("scroll", this.schedule);
    this.observer = new ResizeObserver(this.schedule);
    this.schedule();
  }

  hostUpdated() {
    const nodes = [
      ...this.host.renderRoot.querySelectorAll(
        ".entries-header, .entries-footer",
      ),
    ];
    if (
      nodes.length !== this.observed.length ||
      nodes.some((node, i) => node !== this.observed[i])
    ) {
      this.observer?.disconnect();
      nodes.forEach((node) => this.observer?.observe(node));
      this.observed = nodes;
    }
    this.schedule();
  }

  private schedule = () => {
    if (this.frame !== undefined || !this.host.isConnected) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = undefined;
      if (!this.host.isConnected) return;
      const height = this.viewport?.height ?? window.innerHeight;
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
      const values = {
        "--companion-viewport-height": height,
        "--companion-viewport-top": top,
        "--companion-viewport-bottom": bottom,
        "--entries-height": Math.max(
          180,
          Math.min(820, height - chrome - stickyTop - 16),
        ),
      };
      for (const [name, value] of Object.entries(values)) {
        const pixels = `${Math.round(value)}px`;
        if (this.host.style.getPropertyValue(name) !== pixels)
          this.host.style.setProperty(name, pixels);
      }
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
    if (this.frame !== undefined) cancelAnimationFrame(this.frame);
    this.frame = undefined;
  }
}

export function responsiveViewport(host: LitElement) {
  host.addController(new ViewportController(host));
}
