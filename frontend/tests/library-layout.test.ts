/** Layout observers are simulated; these checks do not launch a browser. */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import "../src/library/library";
import type { KaleidescapeLibrary } from "../src/library/library";
import type { LibraryPage } from "../src/core/api";
import { FixtureTransport, info, libraryTitle } from "./fixture";

let element: KaleidescapeLibrary;
let transport: FixtureTransport;
let observers: Map<Element, ResizeObserverCallback>;
const root = () => element.shadowRoot!;
const calls = () =>
  transport.calls.filter((call) => call.type.endsWith("/library/list"));
function button(label: string) {
  return [...root().querySelectorAll<HTMLButtonElement>("button")].find(
    (item) => item.textContent!.trim() === label,
  )!;
}
async function flush() {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await element.updateComplete;
}
function pageSize(value: string) {
  const control = root().querySelector<HTMLInputElement>(
    '[name="library_page_size"]',
  )!;
  control.value = value;
  control.dispatchEvent(new Event("change", { bubbles: true }));
}
function resize(width: number) {
  const grid = root().querySelector(".cover-grid")!;
  observers.get(grid)!(
    [{ target: grid, contentRect: { width } } as ResizeObserverEntry],
    {} as ResizeObserver,
  );
}
async function titles(count: number) {
  transport.libraryTitles = Array.from({ length: count }, (_, index) =>
    libraryTitle({
      id: index.toString(16).padStart(64, "0"),
      title: `Fictional movie ${String(index).padStart(4, "0")}`,
    }),
  );
  button("Refresh cached data").click();
  await flush();
}
beforeEach(async () => {
  observers = new Map();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(private callback: ResizeObserverCallback) {}
      observe(target: Element) {
        observers.set(target, this.callback);
      }
      disconnect() {}
    },
  );
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  transport = new FixtureTransport();
  element = document.createElement(
    "kaleidescape-library",
  ) as KaleidescapeLibrary;
  element.client = transport.client();
  element.scope = { ...info, library_enabled: true };
  document.body.append(element);
  await flush();
});
afterEach(() => {
  element.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("uses whole rows and reanchors paging when the viewport column count changes", async () => {
  await titles(230);
  button("Covers").click();
  await flush();
  resize(1214); // Eight 150px covers with seven 2px gaps.
  await vi.waitFor(() =>
    expect(calls().at(-1)!.filters).toMatchObject({ limit: 48, offset: 0 }),
  );
  await flush();
  expect(root().querySelectorAll(".cover-tile")).toHaveLength(48);
  button("Next").click();
  await flush();
  button("Next").click();
  await flush();
  expect(calls().at(-1)!.filters).toMatchObject({ limit: 48, offset: 96 });
  resize(1062); // Seven columns: the page containing title 96 starts at 49.
  await vi.waitFor(() =>
    expect(calls().at(-1)!.filters).toMatchObject({ limit: 49, offset: 49 }),
  );
  await flush();
  expect(root().querySelectorAll(".cover-tile")).toHaveLength(49);
  expect(root().textContent).toContain("Fictional movie 0096");
  expect(root().querySelector(".cover-grid")!.getAttribute("style")).toContain(
    "--cover-columns: 7",
  );
  button("Next").click();
  await flush();
  expect(calls().at(-1)!.filters).toMatchObject({ limit: 49, offset: 98 });
});

it("recomputes complete rows for cover-size and page-size changes, capped at 1000", async () => {
  await titles(1100);
  button("Covers").click();
  await flush();
  resize(1214);
  await vi.waitFor(() =>
    expect(calls().at(-1)!.filters).toMatchObject({ limit: 48 }),
  );
  const slider = root().querySelector<HTMLInputElement>('[name="cover_size"]')!;
  slider.value = "90";
  slider.dispatchEvent(new Event("input", { bubbles: true }));
  await vi.waitFor(() =>
    expect(calls().at(-1)!.filters).toMatchObject({ limit: 39 }),
  );
  pageSize("1000");
  await vi.waitFor(
    () => expect(calls().at(-1)!.filters).toMatchObject({ limit: 988 }),
    { timeout: 5000 },
  );
  await flush();
  expect(root().querySelectorAll(".cover-tile")).toHaveLength(988);
  expect(root().textContent).toContain("13 covers per row");
  button("List").click();
  await vi.waitFor(
    () => expect(calls().at(-1)!.filters).toMatchObject({ limit: 1000 }),
    { timeout: 5000 },
  );
  await flush();
  expect(root().querySelectorAll("tbody tr")).toHaveLength(1000);
});

it("paginates 1000 list entries and rejects invalid page targets without a request", async () => {
  await titles(1002);
  const artwork = vi.spyOn(element.client!, "libraryArtwork");
  pageSize("1000");
  await vi.waitFor(
    () => expect(root().querySelectorAll("tbody tr")).toHaveLength(1000),
    { timeout: 5000 },
  );
  button("Next").click();
  await flush();
  expect(calls().at(-1)!.filters).toMatchObject({ limit: 1000, offset: 1000 });
  expect(root().querySelectorAll("tbody tr")).toHaveLength(2);
  expect(button("Next").disabled).toBe(true);
  button("Previous").click();
  await flush();
  expect(root().querySelectorAll("tbody tr")).toHaveLength(1000);
  const count = calls().length;
  vi.spyOn(HTMLInputElement.prototype, "reportValidity").mockReturnValue(false);
  for (const invalid of ["1001", "0", "2.5", ""]) pageSize(invalid);
  await new Promise((resolve) => setTimeout(resolve, 150));
  expect(calls()).toHaveLength(count);
  expect(artwork).not.toHaveBeenCalled();
});

it("shows only actual remaining titles on the final cover page, with no duplicates", async () => {
  await titles(51);
  button("Covers").click();
  await flush();
  resize(1214);
  await vi.waitFor(() =>
    expect(calls().at(-1)!.filters).toMatchObject({ limit: 48 }),
  );
  await flush();
  const first = [...root().querySelectorAll(".cover-tile")].map((item) =>
    item.getAttribute("title"),
  );
  button("Next").click();
  await flush();
  const final = [...root().querySelectorAll(".cover-tile")].map((item) =>
    item.getAttribute("title"),
  );
  expect(final).toHaveLength(3);
  expect(new Set([...first, ...final]).size).toBe(51);
  expect(button("Next").disabled).toBe(true);
  pageSize("1");
  await vi.waitFor(() =>
    expect(calls().at(-1)!.filters).toMatchObject({ limit: 8 }),
  );
});

it("ignores a stale resized page and cancels pending layout work on unmount", async () => {
  await titles(230);
  button("Covers").click();
  await flush();
  let resolve!: (page: LibraryPage) => void;
  const client = element.client!;
  const list = vi.spyOn(client, "libraryList").mockReturnValueOnce(
    new Promise((done) => {
      resolve = done;
    }),
  );
  resize(1214);
  await vi.waitFor(() =>
    expect(list.mock.calls.at(-1)?.[1]).toMatchObject({ limit: 48 }),
  );
  resize(1062);
  await vi.waitFor(() =>
    expect(calls().at(-1)!.filters).toMatchObject({ limit: 49 }),
  );
  await flush();
  expect(root().querySelectorAll(".cover-tile")).toHaveLength(49);
  resolve({
    items: [libraryTitle({ title: "Stale resized reply" })],
    total: 230,
    offset: 0,
    limit: 48,
    has_more: true,
    revision: 5,
    facets: {},
    truncated_facets: [],
  });
  await flush();
  expect(root().textContent).not.toContain("Stale resized reply");
  resize(758);
  const count = calls().length;
  element.remove();
  await new Promise((resolve) => setTimeout(resolve, 150));
  expect(calls()).toHaveLength(count);
});

it("coalesces rapid layout changes and cancels a resize that returns to the current page size", async () => {
  await titles(230);
  button("Covers").click();
  await flush();
  const before = calls().length;
  for (const width of [1214, 1062, 910, 758]) resize(width);
  await new Promise((resolve) => setTimeout(resolve, 150));
  expect(calls()).toHaveLength(before);
  resize(1214);
  resize(1062);
  await vi.waitFor(() =>
    expect(calls().at(-1)!.filters).toMatchObject({ limit: 49 }),
  );
  expect(calls()).toHaveLength(before + 1);
});
