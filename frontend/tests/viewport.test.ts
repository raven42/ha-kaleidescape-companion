/** Simulated geometry checks; rendered phone/tablet review remains an operator step. */
import { LitElement, html, nothing } from "lit";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { responsiveViewport } from "../src/ui/viewport";

class ViewportFixture extends LitElement {
  static properties = { entries: { type: Boolean } };
  entries = true;
  constructor() {
    super();
    responsiveViewport(this);
  }
  render() {
    return this.entries
      ? html`<div class="entries-header">Search controls</div>
          <div class="entries-layout">Fictional entries</div>
          <div class="entries-footer">Pagination</div>`
      : nothing;
  }
}
customElements.define("viewport-fixture", ViewportFixture);

class VisibleViewport extends EventTarget {
  height = 900;
  offsetTop = 0;
}
class LayoutObserver {
  static instances: LayoutObserver[] = [];
  targets = new Set<Element>();
  constructor(private callback: ResizeObserverCallback) {
    LayoutObserver.instances.push(this);
  }
  observe(target: Element) {
    this.targets.add(target);
  }
  disconnect() {
    this.targets.clear();
  }
  resize() {
    this.callback([], this as unknown as ResizeObserver);
  }
}

let element: ViewportFixture;
let viewport: VisibleViewport;
let heights: WeakMap<Element, number>;
let frames: Map<number, FrameRequestCallback>;
const value = (name: string) => element.style.getPropertyValue(name);
function frame() {
  const pending = [...frames.values()];
  frames.clear();
  pending.forEach((callback) => callback(performance.now()));
}
async function mount() {
  element = new ViewportFixture();
  element.style.setProperty("--companion-sticky-top", "48px");
  document.body.append(element);
  await element.updateComplete;
  heights.set(element.shadowRoot!.querySelector(".entries-header")!, 120);
  heights.set(element.shadowRoot!.querySelector(".entries-footer")!, 60);
  frame();
}
beforeEach(() => {
  LayoutObserver.instances = [];
  heights = new WeakMap();
  frames = new Map();
  let nextFrame = 0;
  viewport = new VisibleViewport();
  vi.stubGlobal("innerHeight", 900);
  vi.stubGlobal("visualViewport", viewport);
  vi.stubGlobal("ResizeObserver", LayoutObserver);
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frames.set(++nextFrame, callback);
    return nextFrame;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
    function (this: Element) {
      return { height: heights.get(this) ?? 0 } as DOMRect;
    },
  );
});
afterEach(() => {
  element?.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("fits split panes around wrapped sticky controls and tracks view changes", async () => {
  await mount();
  const observer = LayoutObserver.instances[0];
  expect(
    observer.targets.has(element.shadowRoot!.querySelector(".entries-header")!),
  ).toBe(true);
  expect(value("--entries-height")).toBe("656px");
  // More toolbar lines take space from the content, not from reachable actions.
  heights.set(element.shadowRoot!.querySelector(".entries-header")!, 210);
  observer.resize();
  observer.resize();
  expect(frames.size).toBe(1);
  frame();
  expect(value("--entries-height")).toBe("566px");
  expect(frames.size).toBe(0);
  element.entries = false;
  await element.updateComplete;
  frame();
  expect(observer.targets.has(element)).toBe(true);
  element.entries = true;
  await element.updateComplete;
  expect(
    observer.targets.has(element.shadowRoot!.querySelector(".entries-header")!),
  ).toBe(true);
});

it("uses the visible area and offsets while a mobile keyboard opens or pans", async () => {
  await mount();
  viewport.height = 400;
  viewport.offsetTop = 60;
  viewport.dispatchEvent(new Event("resize"));
  viewport.dispatchEvent(new Event("scroll"));
  frame();
  expect(value("--companion-viewport-height")).toBe("400px");
  expect(value("--companion-viewport-top")).toBe("60px");
  expect(value("--companion-viewport-bottom")).toBe("440px");
  expect(value("--entries-height")).toBe("180px");
  viewport.height = 900;
  viewport.offsetTop = 0;
  viewport.dispatchEvent(new Event("resize"));
  frame();
  expect(value("--companion-viewport-bottom")).toBe("0px");
  expect(value("--entries-height")).toBe("656px");
});

it("falls back to window sizing and releases listeners and frames on disconnect", async () => {
  vi.stubGlobal("visualViewport", undefined);
  await mount();
  expect(value("--companion-viewport-height")).toBe("900px");
  window.dispatchEvent(new Event("resize"));
  expect(frames.size).toBe(1);
  element.remove();
  expect(frames.size).toBe(0);
  expect(LayoutObserver.instances[0].targets.size).toBe(0);
  window.dispatchEvent(new Event("resize"));
  expect(frames.size).toBe(0);
  vi.stubGlobal("innerHeight", 1400);
  document.body.append(element);
  await element.updateComplete;
  frame();
  expect(value("--companion-viewport-height")).toBe("1400px");
  expect(value("--entries-height")).toBe("1156px");
});

it("remeasures HA container space without a window event and distrusts a stale visual viewport", async () => {
  await mount();

  let bottom = 780;
  const wrapper = document.createElement("div");
  wrapper.style.overflowY = "auto";
  document.body.append(wrapper);
  wrapper.append(element);
  await element.updateComplete;
  const layout = element.shadowRoot!.querySelector(".entries-layout")!;
  heights.set(element.shadowRoot!.querySelector(".entries-header")!, 120);
  heights.set(element.shadowRoot!.querySelector(".entries-footer")!, 60);
  vi.mocked(Element.prototype.getBoundingClientRect).mockImplementation(
    function (this: Element) {
      if (this === layout) return { top: 300 } as DOMRect;
      if (this === wrapper) return { height: bottom, bottom } as DOMRect;
      return { height: heights.get(this) ?? 0 } as DOMRect;
    },
  );
  LayoutObserver.instances.at(-1)!.resize();
  frame();
  expect(value("--entries-height")).toBe("404px");
  bottom = 580;
  LayoutObserver.instances.at(-1)!.resize();
  frame();
  expect(value("--entries-height")).toBe("204px");
  vi.stubGlobal("innerHeight", 500);
  window.dispatchEvent(new Event("resize"));
  frame();
  expect(value("--companion-viewport-height")).toBe("500px");
  expect(value("--entries-height")).toBe("180px");
  wrapper.remove();
});
