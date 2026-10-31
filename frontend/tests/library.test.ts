import { modalClose } from "./dialog-helpers";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import "../src/library/library";
import type { KaleidescapeLibrary } from "../src/library/library";
import type { LibraryPage } from "../src/core/api";
import { FixtureTransport, info, libraryTitle } from "./fixture";

let element: KaleidescapeLibrary;
let transport: FixtureTransport;
const root = () => element.shadowRoot!;
const text = () => root().textContent!.replace(/\s+/g, " ");
function button(label: string) {
  return [...root().querySelectorAll("button")].find(
    (button) => button.textContent!.trim() === label,
  )!;
}
async function flush() {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await element.updateComplete;
}
function field(name: string, value: string) {
  const control = root().querySelector<HTMLInputElement | HTMLSelectElement>(
    `[name="${name}"]`,
  )!;
  control.value = value;
  control.dispatchEvent(
    new Event(control.tagName === "SELECT" ? "change" : "input", {
      bubbles: true,
    }),
  );
}
function check(name: string, value: string) {
  const input = [
    ...root().querySelectorAll<HTMLInputElement>(`input[name="${name}"]`),
  ].find((item) => item.value === value)!;
  input.click();
}
function title(label: string) {
  return [...root().querySelectorAll<HTMLButtonElement>("tbody .link")].find(
    (item) => item.textContent!.trim() === label,
  )!;
}
const covers = () => [...root().querySelectorAll("kaleidescape-library-cover")];
beforeEach(async () => {
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(private callback: IntersectionObserverCallback) {}
      observe(target: Element) {
        this.callback(
          [{ target, isIntersecting: true } as IntersectionObserverEntry],
          this as unknown as IntersectionObserver,
        );
      }
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

it("uses checkbox filters with multiple values, discards cancelled drafts, and removes writer/studio filters", async () => {
  expect(text()).toContain("Voyage to Europa");
  expect(root().querySelector(".library-status")!.textContent).not.toContain(
    "Played",
  );
  expect(root().querySelector("[name=writer],[name=studio]")).toBeNull();
  button("Filters").click();
  await flush();
  expect(root().querySelector<HTMLDialogElement>("#filter-dialog")!.open).toBe(
    true,
  );
  check("status", "in_progress");
  await flush();
  check("status", "watched");
  await flush();
  check("actor", "Fictional Actor");
  await flush();
  button("Apply filters").click();
  await flush();
  field("library_query", "Midnight");
  button("Search").click();
  await flush();
  expect(
    transport.calls
      .filter((call) => call.type.endsWith("/library/list"))
      .at(-1)!.filters,
  ).toMatchObject({
    query: "Midnight",
    status: ["in_progress", "watched"],
    actor: ["Fictional Actor"],
    offset: 0,
  });
  expect(root().querySelectorAll("tbody tr")).toHaveLength(1);
  button("Filters (3)").click();
  await flush();
  button("Clear filters").click();
  modalClose(root()).click();
  button("Filters (3)").click();
  await flush();
  expect(root().querySelectorAll("#filter-dialog input:checked")).toHaveLength(
    3,
  );
});

it("clears applied and draft filters without changing sort, view or page size", async () => {
  field("library_query", "Midnight");
  button("Search").click();
  await flush();
  button("Filters").click();
  await flush();
  check("status", "in_progress");
  button("Apply filters").click();
  await flush();
  root()
    .querySelector<HTMLInputElement>(
      'input[name="library_view"][value="covers"]',
    )!
    .click();
  await flush();
  field("library_sort", "year");
  await flush();
  button("Clear Filter").click();
  await flush();
  expect(
    transport.calls
      .filter((call) => call.type.endsWith("/library/list"))
      .at(-1)!.filters,
  ).toMatchObject({
    query: "",
    sort: "year",
    descending: false,
    offset: 0,
    limit: 100,
  });
  expect(
    root().querySelector<HTMLInputElement>('[name="library_query"]')!.value,
  ).toBe("");
  expect(root().querySelectorAll(".cover-tile")).toHaveLength(3);
  expect(button("Filters")).toBeTruthy();
  button("Filters").click();
  await flush();
  expect(root().querySelectorAll("#filter-dialog input:checked")).toHaveLength(
    0,
  );
  modalClose(root()).click();
  await flush();
  field("library_query", "Unsubmitted search");
  button("Clear Filter").click();
  await flush();
  expect(
    root().querySelector<HTMLInputElement>('[name="library_query"]')!.value,
  ).toBe("");
});

it("adds sortable year/collection headings and opens details only in a popup", async () => {
  expect(root().querySelector("#title-dialog .playback-layout")).toBeNull();
  const year = [
    ...root().querySelectorAll<HTMLButtonElement>("th button"),
  ].find((item) => item.textContent!.includes("Year"))!;
  year.click();
  await flush();
  expect(transport.calls.at(-1)!.filters).toMatchObject({
    sort: "year",
    descending: false,
  });
  expect(year.closest("th")!.getAttribute("aria-sort")).toBe("ascending");
  year.click();
  await flush();
  expect(transport.calls.at(-1)!.filters).toMatchObject({
    sort: "year",
    descending: true,
  });
  title("Voyage to Europa").click();
  await flush();
  expect(root().querySelector<HTMLDialogElement>("#title-dialog")!.open).toBe(
    true,
  );
  expect(text()).toContain("First detected");
  expect(root().querySelector(".library-title")).toBeNull();
  modalClose(root()).click();
  await flush();
  expect(root().querySelector("#title-dialog .playback-layout")).toBeNull();
});

it("combines a linked movie heading and actions with poster, synopsis and credits", async () => {
  title("Voyage to Europa").click();
  await flush();
  const dialog = root().querySelector<HTMLDialogElement>("#title-dialog")!;
  expect(dialog.classList.contains("movie-dialog")).toBe(true);
  expect(
    dialog.querySelector(".movie-heading h2 .detail-link")!.textContent,
  ).toContain("Voyage to Europa");
  expect(dialog.querySelector(".movie-summary")!.textContent).toContain("2h");
  expect(
    dialog.querySelector(".movie-poster kaleidescape-library-cover"),
  ).not.toBeNull();
  expect(dialog.querySelector(".movie-description h3")!.textContent).toBe(
    "Synopsis",
  );
  expect(
    dialog.querySelectorAll(".movie-credits .detail-link").length,
  ).toBeGreaterThan(0);
  expect(
    dialog.querySelector("kaleidescape-device-controls[mode=movie]"),
  ).not.toBeNull();
  expect(
    dialog.querySelector(".movie-record-details summary")!.textContent,
  ).toBe("Library details");
  expect(
    dialog.querySelector(".dialog-close")!.getAttribute("aria-label"),
  ).toBe("Close");
});

it("switches to tightly spaced resizable covers and opens the same title popup", async () => {
  root()
    .querySelector<HTMLInputElement>(
      'input[name="library_view"][value="covers"]',
    )!
    .click();
  await flush();
  expect(root().querySelector("table")).toBeNull();
  expect(root().querySelectorAll(".cover-tile")).toHaveLength(3);
  field("cover_size", "250");
  await flush();
  expect(root().querySelector(".cover-grid")!.getAttribute("style")).toContain(
    "250px",
  );
  root().querySelector<HTMLButtonElement>(".cover-tile")!.click();
  await flush();
  expect(root().querySelector<HTMLDialogElement>("#title-dialog")!.open).toBe(
    true,
  );
  modalClose(root()).click();
  root()
    .querySelector<HTMLInputElement>(
      'input[name="library_view"][value="list"]',
    )!
    .click();
  await flush();
  expect(root().querySelectorAll("tbody tr")).toHaveLength(3);
});

it("renders untrusted title/filter metadata as text", async () => {
  transport.libraryTitles = [
    libraryTitle({
      title: "<img src=x onerror=attack()>",
      actors: ["<script>attack()</script>"],
    }),
  ];
  button("Refresh cached data").click();
  await flush();
  title("<img src=x onerror=attack()>").click();
  await flush();
  expect(text()).toContain("<script>attack()</script>");
  expect(root().querySelector("img,script")).toBeNull();
  modalClose(root()).click();
  button("Filters").click();
  await flush();
  expect(root().querySelector("script")).toBeNull();
});

it("ignores stale list replies after replacing the connection and clears on unmount", async () => {
  let resolve!: (page: LibraryPage) => void;
  vi.spyOn(element.client!, "libraryList").mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  button("Refresh cached data").click();
  await flush();
  element.client = new FixtureTransport().client();
  await flush();
  resolve({
    items: [libraryTitle({ title: "Stale private title" })],
    offset: 0,
    total: 1,
    has_more: false,
    revision: 5,
    facets: {},
    truncated_facets: [],
  });
  await flush();
  expect(text()).not.toContain("Stale private title");
  element.remove();
  await flush();
  expect(root().querySelector("tbody tr")).toBeNull();
});

it("aborts late covers and revokes displayed URLs when closing details or changing accounts", async () => {
  let resolve!: (blob: Blob) => void;
  const artwork = vi.spyOn(element.client!, "libraryArtwork").mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  const create = vi
    .spyOn(URL, "createObjectURL")
    .mockReturnValue("blob:fictional-cover");
  const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  transport.libraryTitles = [libraryTitle({ artwork_key: "f".repeat(64) })];
  button("Refresh cached data").click();
  await flush();
  expect(artwork).not.toHaveBeenCalled();
  title("Voyage to Europa").click();
  await flush();
  const signal = artwork.mock.calls[0][2];
  modalClose(root()).click();
  await flush();
  expect(signal.aborted).toBe(true);
  resolve(new Blob(["fictional"], { type: "image/png" }));
  await flush();
  expect(create).not.toHaveBeenCalled();
  artwork.mockResolvedValue(new Blob(["fictional"], { type: "image/png" }));
  title("Voyage to Europa").click();
  await flush();
  expect(covers()[0].shadowRoot!.querySelector("img")!.src).toBe(
    "blob:fictional-cover",
  );
  covers()[0]
    .shadowRoot!.querySelector("img")!
    .dispatchEvent(new Event("error"));
  await flush();
  expect(covers()[0].shadowRoot!.querySelector("img")).toBeNull();
  expect(revoke).toHaveBeenCalledWith("blob:fictional-cover");
  element.client = new FixtureTransport().client();
  await flush();
  expect(root().querySelector("#title-dialog .playback-layout")).toBeNull();
});

it("limits cover requests to three and cancels queued requests on navigation", async () => {
  const artwork = vi
    .spyOn(element.client!, "libraryArtwork")
    .mockImplementation(
      (_scope, _key, signal) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener(
            "abort",
            () => reject(new DOMException("Aborted", "AbortError")),
            { once: true },
          );
        }),
    );
  transport.libraryTitles = Array.from({ length: 12 }, (_, i) =>
    libraryTitle({
      id: String(i),
      title: `Fictional title ${i}`,
      artwork_key: "f".repeat(64),
    }),
  );
  button("Refresh cached data").click();
  await flush();
  root()
    .querySelector<HTMLInputElement>(
      'input[name="library_view"][value="covers"]',
    )!
    .click();
  await flush();
  expect(artwork).toHaveBeenCalledTimes(3);
  const signals = artwork.mock.calls.map((call) => call[2]);
  root()
    .querySelector<HTMLInputElement>(
      'input[name="library_view"][value="list"]',
    )!
    .click();
  await flush();
  expect(signals.every((signal) => signal.aborted)).toBe(true);
  expect(artwork).toHaveBeenCalledTimes(3);
});

it("fetches only visible covers and reuses retained images after scrolling or changing view", async () => {
  const observers = new Map<Element, IntersectionObserverCallback>();
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(private callback: IntersectionObserverCallback) {}
      observe(target: Element) {
        observers.set(target, this.callback);
      }
      disconnect() {}
    },
  );
  const artwork = vi
    .spyOn(element.client!, "libraryArtwork")
    .mockResolvedValue(new Blob(["fictional"], { type: "image/png" }));
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:visible-cover");
  const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  transport.libraryTitles = [libraryTitle({ artwork_key: "f".repeat(64) })];
  button("Refresh cached data").click();
  await flush();
  root()
    .querySelector<HTMLInputElement>(
      'input[name="library_view"][value="covers"]',
    )!
    .click();
  await flush();
  expect(artwork).not.toHaveBeenCalled();
  const cover = covers()[0];
  const intersect = (visible: boolean) =>
    observers.get(cover)!(
      [{ target: cover, isIntersecting: visible } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    );
  intersect(true);
  await flush();
  expect(artwork).toHaveBeenCalledTimes(1);
  intersect(false);
  await flush();
  expect(revoke).not.toHaveBeenCalled();
  expect(cover.shadowRoot!.querySelector("img")!.src).toBe(
    "blob:visible-cover",
  );
  intersect(true);
  await flush();
  expect(artwork).toHaveBeenCalledTimes(1);
  root()
    .querySelector<HTMLInputElement>(
      'input[name="library_view"][value="list"]',
    )!
    .click();
  await flush();
  root()
    .querySelector<HTMLInputElement>(
      'input[name="library_view"][value="covers"]',
    )!
    .click();
  await flush();
  const restored = covers()[0];
  observers.get(restored)!(
    [{ target: restored, isIntersecting: true } as IntersectionObserverEntry],
    {} as IntersectionObserver,
  );
  await flush();
  expect(restored.shadowRoot!.querySelector("img")!.src).toBe(
    "blob:visible-cover",
  );
  expect(artwork).toHaveBeenCalledTimes(1);
  element.client = new FixtureTransport().client();
  await flush();
  expect(revoke).toHaveBeenCalledWith("blob:visible-cover");
});

it("shares browsing without administrator controls and clears denied or disabled data", async () => {
  element.scope = {
    ...info,
    library_enabled: true,
    permissions: { read: true, edit: false, export: false },
  };
  await flush();
  expect(button("Sync now")).toBeUndefined();
  expect(text()).toContain("Voyage to Europa");
  expect(
    transport.calls.some((call) => call.type.endsWith("/library/sync")),
  ).toBe(false);
  transport.failure = "unauthorized";
  button("Refresh cached data").click();
  await flush();
  expect(text()).not.toContain("Voyage to Europa");
  expect(text()).toContain("Access to this operation is denied");
  element.scope = { ...info, library_enabled: false };
  element.client = new FixtureTransport().client();
  const list = vi.spyOn(element.client, "libraryList"),
    status = vi.spyOn(element.client, "libraryInfo");
  await flush();
  expect(list).not.toHaveBeenCalled();
  expect(status).not.toHaveBeenCalled();
});

it("keeps cached titles usable when sync reports an outage", async () => {
  vi.spyOn(element.client!, "libraryInfo").mockResolvedValue({
    ...(await transport.client().libraryInfo(info)),
    error: "library_unreachable",
  });
  button("Refresh cached data").click();
  await flush();
  expect(text()).toContain("Cached data is retained");
  expect(text()).toContain("Voyage to Europa");
});

it("groups source editions in list and covers, lists formats, and switches version details", async () => {
  transport.libraryTitles = [
    libraryTitle({
      edition: "4K Dolby Vision",
      synopsis: "First version synopsis",
    }),
    libraryTitle({
      id: "d".repeat(64),
      edition: "HD",
      year: 2025,
      synopsis: "Other version synopsis",
      duration_seconds: 6600,
    }),
  ];
  transport.libraryGroups.set("a".repeat(64), "fictional-work");
  transport.libraryGroups.set("d".repeat(64), "fictional-work");
  button("Refresh cached data").click();
  await flush();
  expect(root().querySelectorAll("tbody tr")).toHaveLength(1);
  expect(root().querySelectorAll(".format-badge").length).toBeGreaterThan(0);
  expect(text()).toContain("Dolby Vision");
  expect(text()).toContain("2 versions");
  title("Voyage to Europa").click();
  await flush();
  expect(root().querySelectorAll(".version-tabs button")).toHaveLength(2);
  expect(text()).toContain("First version synopsis");
  const tabs = root().querySelectorAll<HTMLButtonElement>(
    ".version-tabs button",
  );
  tabs[1].click();
  await flush();
  expect(text()).toContain("Other version synopsis");
  expect(text()).not.toContain("First version synopsis");
  modalClose(root()).click();
  root()
    .querySelector<HTMLInputElement>(
      'input[name="library_view"][value="covers"]',
    )!
    .click();
  await flush();
  expect(root().querySelectorAll(".cover-tile")).toHaveLength(1);
});

it("keeps same-name remakes separate in both views and opens only the selected work", async () => {
  transport.libraryTitles = [
    libraryTitle({ year: 1995, directors: ["Original Director"] }),
    libraryTitle({
      id: "d".repeat(64),
      year: 2025,
      directors: ["Remake Director"],
    }),
    libraryTitle({
      id: "e".repeat(64),
      year: 2025,
      edition: "HD",
      directors: ["Remake Director"],
    }),
  ];
  transport.libraryGroups.set("d".repeat(64), "fictional-remake");
  transport.libraryGroups.set("e".repeat(64), "fictional-remake");
  button("Refresh cached data").click();
  await flush();
  expect(root().querySelectorAll("tbody tr")).toHaveLength(2);
  expect(text()).toContain("2 titles");
  expect(text()).toContain("3 individual versions");
  const titles = root().querySelectorAll<HTMLButtonElement>("tbody .link");
  titles[0].click();
  await flush();
  expect(root().querySelectorAll(".version-tabs button")).toHaveLength(0);
  expect(root().querySelector("#title-dialog")!.textContent).toContain(
    "Original Director",
  );
  expect(root().querySelector("#title-dialog")!.textContent).not.toContain(
    "Remake Director",
  );
  modalClose(root()).click();
  root()
    .querySelector<HTMLInputElement>(
      'input[name="library_view"][value="covers"]',
    )!
    .click();
  await flush();
  const covers = root().querySelectorAll<HTMLButtonElement>(".cover-tile");
  expect(covers).toHaveLength(2);
  expect(covers[0].getAttribute("title")).toBe("Voyage to Europa (1995)");
  expect(covers[1].getAttribute("title")).toBe("Voyage to Europa (2025)");
  covers[1].click();
  await flush();
  expect(root().querySelectorAll(".version-tabs button")).toHaveLength(2);
  expect(root().querySelector("#title-dialog")!.textContent).toContain(
    "Remake Director",
  );
});

it("keeps column widths stable when sorting and supports keyboard resizing", async () => {
  const before = [...root().querySelectorAll("col")].map((col) =>
    col.getAttribute("style"),
  );
  const header = root().querySelector<HTMLButtonElement>("th button")!;
  header.click();
  await flush();
  expect(
    [...root().querySelectorAll("col")].map((col) => col.getAttribute("style")),
  ).toEqual(before);
  const separator = root().querySelector('[role="separator"]')!;
  separator.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "ArrowRight",
      bubbles: true,
      cancelable: true,
    }),
  );
  await flush();
  expect(root().querySelector("col")!.getAttribute("style")).toContain("380px");
  header.click();
  await flush();
  expect(root().querySelector("col")!.getAttribute("style")).toContain("380px");
  separator.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "Home",
      bubbles: true,
      cancelable: true,
    }),
  );
  await flush();
  expect(root().querySelector("col")!.getAttribute("style")).toBe(before[0]);
});

it("discards late version details after closing the popup or replacing the account", async () => {
  let resolve!: (
    value: Awaited<
      ReturnType<NonNullable<typeof element.client>["libraryVersions"]>
    >,
  ) => void;
  vi.spyOn(element.client!, "libraryVersions").mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  title("Voyage to Europa").click();
  await flush();
  modalClose(root()).click();
  await flush();
  resolve({
    items: [libraryTitle({ synopsis: "Stale version details" })],
    total: 1,
    offset: 0,
    has_more: false,
    revision: 5,
  });
  await flush();
  expect(text()).not.toContain("Stale version details");
  expect(root().querySelector("#title-dialog .playback-layout")).toBeNull();
});

it("refreshes cached labels when display preferences change without a source revision change", async () => {
  const before = transport.calls.filter((call) =>
    call.type.endsWith("/library/list"),
  ).length;
  transport.preferencesKey = "1".repeat(64);
  document.dispatchEvent(new Event("visibilitychange"));
  await flush();
  expect(
    transport.calls.filter((call) => call.type.endsWith("/library/list"))
      .length,
  ).toBe(before + 1);
});

it("replaces all criteria when clicking people, years, genres, collections, status, formats or ratings", async () => {
  const movie = libraryTitle({
    title: "Clickable movie",
    actors: ["Fictional Shared Name"],
    directors: ["Fictional Director"],
    genres: ["Adventure"],
    collections: ["Favorites"],
    year: 2025,
    rating: "PG",
    edition: "4K HDR10",
    formats: ["4K HDR10"],
    watched_status: "watched",
  });
  transport.libraryTitles = [
    movie,
    libraryTitle({
      id: "d".repeat(64),
      title: "Another movie",
      actors: [],
      directors: ["Fictional Shared Name"],
      year: 2001,
    }),
  ];
  button("Refresh cached data").click();
  await flush();
  const cases = [
    ["Fictional Shared Name", "query", "Fictional Shared Name"],
    ["Fictional Director", "query", "Fictional Director"],
    ["2025", "year", ["2025"]],
    ["Adventure", "genre", ["Adventure"]],
    ["Favorites", "collection", ["Favorites"]],
    ["Watched", "status", ["watched"]],
    ["4K", "format", ["4K"]],
    ["HDR10", "format", ["HDR10"]],
    ["PG", "rating", ["PG"]],
  ] as const;
  for (const [label, key, value] of cases) {
    // Remount with unrelated filters that still include this movie; every click
    // must replace them, persist, reset pagination, and close the detail popup.
    element.remove();
    transport.uiPreferences = {
      ...transport.uiPreferences,
      query: "Clickable",
      collection: ["Favorites"],
      genre: ["Adventure"],
      year: ["2025"],
      format: ["4K"],
      rating: ["PG"],
      status: ["watched"],
      actor: [],
      director: [],
    };
    element = document.createElement(
      "kaleidescape-library",
    ) as KaleidescapeLibrary;
    element.client = transport.client();
    element.scope = { ...info, library_enabled: true };
    document.body.append(element);
    await vi.waitFor(() => expect(title("Clickable movie")).toBeTruthy());
    title("Clickable movie").click();
    await flush();
    const clickable = [
      ...root().querySelectorAll<HTMLButtonElement>("#title-dialog button"),
    ].find((node) => node.textContent?.trim() === label)!;
    expect(clickable, label).toBeTruthy();
    clickable.click();
    await flush();
    const filters = transport.calls
      .filter((call) => call.type.endsWith("library/list"))
      .at(-1)!.filters as Record<string, unknown>;
    expect(filters).toMatchObject({
      query: key === "query" ? value : "",
      offset: 0,
      [key]: value,
    });
    for (const other of [
      "collection",
      "genre",
      "year",
      "format",
      "rating",
      "status",
      "actor",
      "director",
    ].filter((other) => other !== key))
      expect(filters[other] ?? []).toEqual([]);
    expect(root().querySelector<HTMLDialogElement>("#title-dialog")!.open).toBe(
      false,
    );
    expect(
      root().querySelector<HTMLInputElement>('[name="library_query"]')!.value,
    ).toBe(key === "query" ? value : "");
    expect(transport.uiPreferences[key]).toEqual(value);
    if (label === "Fictional Shared Name")
      expect(root().querySelectorAll("tbody tr")).toHaveLength(2);
  }
});

it("offers persisted genre/year/format filters and hides the tablist for one version", async () => {
  transport.libraryTitles = [
    libraryTitle({
      genres: ["Adventure"],
      formats: ["4K HDR10"],
      edition: "4K HDR10",
    }),
  ];
  button("Refresh cached data").click();
  await flush();
  button("Filters").click();
  await flush();
  check("genre", "Adventure");
  check("year", "2025");
  check("format", "HDR10");
  button("Apply filters").click();
  await flush();
  expect(transport.uiPreferences).toMatchObject({
    genre: ["Adventure"],
    year: ["2025"],
    format: ["HDR10"],
  });
  expect(root().querySelector(".pagination")?.textContent).toContain(
    "1 matching title",
  );
  expect(root().querySelector(".library-status")?.textContent).toContain(
    "1 title",
  );
  title("Voyage to Europa").click();
  await flush();
  expect(root().querySelector("#title-dialog [role=tablist]")).toBeNull();
  expect(
    root()
      .querySelector("#title-dialog [role=region]")
      ?.getAttribute("aria-label"),
  ).toBe("Version details");
  expect(root().querySelector("#title-dialog")!.textContent).not.toContain(
    "1 version",
  );
  expect(root().querySelector("#title-dialog")!.textContent).not.toContain(
    "version(s)",
  );
});

it("lets household readers browse from cover details without administrator or device actions", async () => {
  transport.uiPreferences.view = "covers";
  element.scope = {
    ...info,
    library_enabled: true,
    permissions: { read: true, edit: false, export: false },
  };
  await vi.waitFor(() =>
    expect(root().querySelector(".cover-tile")).toBeTruthy(),
  );
  root().querySelector<HTMLButtonElement>(".cover-tile")!.click();
  await flush();
  expect(
    root().querySelector("kaleidescape-library-collection-add"),
  ).toBeNull();
  const director = [
    ...root().querySelectorAll<HTMLButtonElement>("#title-dialog button"),
  ].find((node) => node.textContent?.trim() === "Fictional Director")!;
  director.click();
  await flush();
  expect(
    root().querySelector<HTMLInputElement>('[name="library_query"]')!.value,
  ).toBe("Fictional Director");
  expect(
    transport.calls.filter((call) => call.type.endsWith("library/list")).at(-1)!
      .filters,
  ).toMatchObject({ query: "Fictional Director", offset: 0 });
  expect(
    transport.calls.some((call) =>
      /collections\/(add|targets)|journal\/(create|update|delete)|library\/sync$/.test(
        call.type,
      ),
    ),
  ).toBe(false);
});

it("shows private purchase history only in administrator title details", async () => {
  transport.libraryTitles[0].purchase_history = [
    {
      id: "p".repeat(64),
      title: "<script>Private purchase</script>",
      purchased_on: "2020-01-02",
      purchase_price: "$12.99",
      retail_price: "$24.99",
      order_id: "FICTIONAL-ORDER",
      href: "https://store.example.invalid/movie",
    },
  ];
  title("Voyage to Europa").click();
  await flush();
  expect(text()).toContain("Purchase history · Administrator");
  expect(text()).toContain("FICTIONAL-ORDER");
  expect(root().querySelector("script")).toBeNull();
  element.scope = {
    ...info,
    library_enabled: true,
    permissions: { read: true, edit: false, export: false },
  };
  await flush();
  title("Voyage to Europa").click();
  await flush();
  expect(text()).not.toContain("FICTIONAL-ORDER");
  expect(text()).not.toContain("Purchase history · Administrator");
});
