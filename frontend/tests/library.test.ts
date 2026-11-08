import { modalClose } from "./dialog-helpers";
import { setUnifiedMovieDialog } from "../src/ui/movie-dialog-mode";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import "../src/library/library";
import type { KaleidescapeLibrary } from "../src/library/library";
import type { LibraryPage } from "../src/core/api";
import { FixtureTransport, info, libraryTitle } from "./fixture";
import { readLibraryFilters } from "../src/library/url-filters";

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
  history.replaceState(
    null,
    "",
    "/kaleidescape-companion?companion_page=library",
  );
  setUnifiedMovieDialog(true);
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
  element.advanced = true;
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
  expect(root().querySelector(".library-footer")!.textContent).not.toContain(
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
    offset: 0,
  });
  expect(root().querySelectorAll("tbody tr")).toHaveLength(1);
  button("Filters (2)").click();
  await flush();
  button("Clear filters").click();
  modalClose(root()).click();
  button("Filters (2)").click();
  await flush();
  expect(root().querySelectorAll("#filter-dialog input:checked")).toHaveLength(
    2,
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
  expect(dialog.querySelector(".movie-hero")).toBeNull();
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

it("persists the visible cast limit while keeping the complete billed cast available", async () => {
  transport.libraryTitles[0].actors = Array.from(
    { length: 12 },
    (_, index) => `Billed performer ${index + 1}`,
  );
  const input = root().querySelector<HTMLInputElement>('[name="cast_limit"]')!;
  input.value = "4";
  input.dispatchEvent(new Event("change", { bubbles: true }));
  await flush();
  expect(transport.uiPreferences.cast_limit).toBe(4);
  title("Voyage to Europa").click();
  await flush();
  const credits = root().querySelector(".movie-description > .movie-credits")!;
  const cast = [...credits.querySelectorAll("div")].find(
    (row) => row.querySelector("dt")?.textContent === "Cast",
  )!;
  expect(cast.querySelectorAll(".detail-link")).toHaveLength(4);
  const names = [...cast.querySelectorAll(".credit-name")];
  expect(names).toHaveLength(4);
  expect(names[0].textContent!.trim()).toBe("Billed performer 1,");
  expect(names[3].textContent!.trim()).toBe("Billed performer 4");
  expect(cast.textContent).toContain("Billed performer 1");
  expect(cast.textContent).not.toContain("Billed performer 5");
  expect(root().querySelector(".extra-credits")!.textContent).toContain(
    "Billed performer 12",
  );
  expect(
    root().querySelector(".extra-credits .credit-name")!.textContent!.trim(),
  ).toBe("Billed performer 1,");
  expect(root().querySelector("kaleidescape-title-scrape")).not.toBeNull();
  expect(root().querySelectorAll("kaleidescape-title-scrape")).toHaveLength(1);
  element.scope = {
    ...info,
    library_enabled: true,
    permissions: { read: true, edit: false, export: false },
  };
  await flush();
  title("Voyage to Europa").click();
  await flush();
  expect(root().querySelector("kaleidescape-title-scrape")).toBeNull();
});

it.each([true, false])(
  "loads a private cached backdrop in title details for administrator=%s",
  async (admin) => {
    const key = "b".repeat(64);
    transport.libraryTitles[0].enrichment = {
      tmdb: {
        provider: "tmdb",
        provider_id: "42",
        url: "https://www.themoviedb.org/movie/42",
        fetched_at: "2025-01-01T00:00:00Z",
        backdrop_key: key,
      },
    };
    element.scope = {
      ...info,
      library_enabled: true,
      permissions: { read: true, edit: admin, export: admin },
    };
    const artwork = vi
      .spyOn(element.client!, "libraryArtwork")
      .mockResolvedValue(new Blob(["fictional"], { type: "image/jpeg" }));
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:fictional-backdrop");
    await flush();
    title("Voyage to Europa").click();
    await flush();
    const dialog = root().querySelector<HTMLDialogElement>("#title-dialog")!;
    expect(dialog.open).toBe(true);
    const hero = dialog.querySelector(".movie-hero")!;
    expect(hero.getAttribute("aria-hidden")).toBe("true");
    expect(artwork.mock.calls.some((call) => call[1] === key)).toBe(true);
    expect(
      hero
        .querySelector("kaleidescape-library-cover")!
        .shadowRoot!.querySelector("img")!.src,
    ).toBe("blob:fictional-backdrop");
    expect(
      dialog.querySelector<HTMLDetailsElement>(".movie-record-details")!.open,
    ).toBe(false);
    // Provider image URLs never enter the browser; only scoped cached bytes do.
    expect(dialog.querySelector('[src^="https://"]')).toBeNull();
    modalClose(root()).click();
    await flush();
    expect(dialog.querySelector(".movie-hero")).toBeNull();
  },
);

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
  expect(
    root().querySelectorAll(".version-format-badges .format-badge").length,
  ).toBeGreaterThan(0);
  expect(
    [...root().querySelectorAll(".version-format-badges .format-badge")].every(
      (badge) => badge.tagName === "BUTTON",
    ),
  ).toBe(true);
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

it("keeps the group Journal open without reloading when switching versions", async () => {
  const first = libraryTitle({ synopsis: "First version" });
  const second = libraryTitle({
    id: "d".repeat(64),
    synopsis: "Second version",
  });
  transport.libraryTitles = [first, second];
  transport.libraryGroups.set(first.id, "fictional-work");
  transport.libraryGroups.set(second.id, "fictional-work");
  transport.viewingLinks.set(transport.records[0].id, first.id);
  button("Refresh cached data").click();
  await flush();
  title("Voyage to Europa").click();
  await vi.waitFor(() =>
    expect(root().querySelectorAll(".version-tabs button")).toHaveLength(2),
  );
  const journal = root().querySelector("kaleidescape-library-journal")!;
  await vi.waitFor(() =>
    expect(journal.shadowRoot!.querySelector("details")).toBeTruthy(),
  );
  const details =
    journal.shadowRoot!.querySelector<HTMLDetailsElement>("details")!;
  details.open = true;
  const callsBefore = transport.calls.filter((call) =>
    call.type.endsWith("/library/viewings"),
  ).length;
  root().querySelectorAll<HTMLButtonElement>(".version-tabs button")[1].click();
  await flush();
  expect(root().querySelector("kaleidescape-library-journal")).toBe(journal);
  expect(journal.shadowRoot!.querySelector("details")).toBe(details);
  expect(details.open).toBe(true);
  expect(
    transport.calls.filter((call) => call.type.endsWith("/library/viewings")),
  ).toHaveLength(callsBefore);
});

it("switches movie status names without duplicating collection filters", async () => {
  transport.libraryTitles[0].collections.push("New");
  transport.libraryTitles[0].watched_status = "unwatched";
  button("Refresh cached data").click();
  await flush();
  let first = title("Voyage to Europa").closest("tr")!;
  expect(first.querySelector('[aria-label="Unwatched"]')).toBeTruthy();
  expect(first.querySelector('[aria-label="New"]')).toBeNull();
  const select = root().querySelector<HTMLSelectElement>(
    '[name="movie_status_labels"]',
  )!;
  select.value = "kaleidescape";
  select.dispatchEvent(new Event("change", { bubbles: true }));
  await flush();
  first = title("Voyage to Europa").closest("tr")!;
  expect(first.querySelector('[aria-label="New"]')).toBeTruthy();
  expect(first.querySelector('[aria-label="Unwatched"]')).toBeNull();
  await vi.waitFor(() =>
    expect(transport.uiPreferences.movie_status_labels).toBe("kaleidescape"),
  );
  button("Filters").click();
  await flush();
  expect(root().querySelector('[name="collection"][value="New"]')).toBeNull();
  expect(
    root().querySelector('[name="status"][value="unwatched"]'),
  ).toBeTruthy();
});

it("applies the Recently added filter and puts it in the URL", async () => {
  transport.libraryTitles[0].is_recently_added = true;
  button("Filters").click();
  await flush();
  root()
    .querySelector<HTMLInputElement>('[name="status"][value="recently_added"]')!
    .click();
  button("Apply filters").click();
  await flush();
  expect(
    transport.calls.filter((call) => call.type.endsWith("library/list")).at(-1)!
      .filters,
  ).toMatchObject({ status: ["recently_added"] });
  expect(root().querySelectorAll("tbody tr")).toHaveLength(1);
  expect(new URL(location.href).searchParams.getAll("library_status")).toEqual([
    "recently_added",
  ]);
  expect(transport.uiPreferences.status).toEqual([]);
});

it("groups the six requested badges into one filter with any-match behavior", async () => {
  transport.libraryTitles[0].collections = [
    "All",
    "Played",
    "New",
    "Paused",
    "Favorites",
    "WatchSoon",
  ];
  transport.libraryTitles[0].watched_status = "watched";
  transport.libraryTitles[1].watched_status = "none";
  transport.libraryTitles[1].collections = [];
  transport.libraryTitles[2].watched_status = "none";
  transport.libraryTitles[2].collections = [];
  transport.libraryTitles[2].is_recently_added = true;
  button("Refresh cached data").click();
  await flush();
  button("Filters").click();
  await flush();
  const rootDialog = root().querySelector<HTMLDialogElement>("#filter-dialog")!;
  const filters = [
    ...rootDialog.querySelectorAll<HTMLInputElement>('input[name="status"]'),
  ];
  expect(filters.map((input) => input.value)).toEqual([
    "watched",
    "unwatched",
    "in_progress",
    "favorite",
    "watch_soon",
    "recently_added",
  ]);
  expect(
    filters.map((input) =>
      input
        .parentElement!.querySelector(".collection-badge > span")!
        .textContent!.trim(),
    ),
  ).toEqual([
    "Watched",
    "Unwatched",
    "In progress",
    "Favorites",
    "Watch Soon",
    "Recently Added",
  ]);
  expect(
    rootDialog.querySelector('[name="collection"][value="All"]'),
  ).toBeNull();
  expect(
    rootDialog.querySelector('[name="status"][value="unknown"]'),
  ).toBeNull();
  expect(rootDialog.querySelector('[name="status"][value="none"]')).toBeNull();
  expect(
    [...rootDialog.querySelectorAll("legend")].some(
      (node) => node.textContent?.trim() === "Collection",
    ),
  ).toBe(false);
  filters.find((input) => input.value === "watched")!.click();
  filters.find((input) => input.value === "recently_added")!.click();
  button("Apply filters").click();
  await flush();
  expect(root().querySelectorAll("tbody tr")).toHaveLength(2);
  expect(new URL(location.href).searchParams.getAll("library_status")).toEqual([
    "watched",
    "recently_added",
  ]);
  expect(
    transport.calls.filter((call) => call.type.endsWith("library/list")).at(-1)!
      .filters,
  ).toMatchObject({ status: ["watched", "recently_added"] });
});

it("omits the Unwatched or New badge from covers while retaining Recently Added", async () => {
  transport.libraryTitles[0].watched_status = "unwatched";
  transport.libraryTitles[0].collections = ["New"];
  transport.libraryTitles[0].is_recently_added = true;
  button("Refresh cached data").click();
  await flush();
  expect(
    title("Voyage to Europa")
      .closest("tr")!
      .querySelector('[aria-label="Unwatched"]'),
  ).toBeTruthy();
  button("Options").click();
  await flush();
  root()
    .querySelector<HTMLInputElement>(
      'input[name="library_view"][value="covers"]',
    )!
    .click();
  await flush();
  const cover = () =>
    root().querySelector<HTMLButtonElement>(
      '.cover-tile[aria-label*="Voyage to Europa"]',
    )!;
  expect(cover().querySelector('[aria-label="Unwatched"]')).toBeNull();
  expect(cover().querySelector('[aria-label="Recently Added"]')).toBeTruthy();
  const labels = root().querySelector<HTMLSelectElement>(
    '[name="movie_status_labels"]',
  )!;
  labels.value = "kaleidescape";
  labels.dispatchEvent(new Event("change", { bubbles: true }));
  await flush();
  expect(cover().querySelector('[aria-label="New"]')).toBeNull();
  expect(cover().querySelector('[aria-label="Recently Added"]')).toBeTruthy();
});

it("shows group purchases across version tabs and opens the selected receipt editor", async () => {
  transport.libraryTitles = [
    libraryTitle({ edition: "4K" }),
    libraryTitle({
      id: "d".repeat(64),
      edition: "HD",
      purchase_history: [
        {
          id: "f".repeat(64),
          title: "Fictional purchase",
          purchased_on: "2020-01-02",
          purchase_price: "$9.99",
          retail_price: "$19.99",
          order_id: "GROUP-ORDER",
          href: null,
        },
      ],
    }),
  ];
  transport.libraryGroups.set("a".repeat(64), "fictional-work");
  transport.libraryGroups.set("d".repeat(64), "fictional-work");
  transport.libraryTitles[0].purchased_on = "2020-01-02";
  transport.libraryTitles[1].purchase_history![0].href =
    "/movie-store/movie/fictional-film";
  button("Refresh cached data").click();
  await flush();
  title("Voyage to Europa").click();
  await flush();
  expect(text()).toContain("GROUP-ORDER");
  expect(root().querySelectorAll(".movie-purchases p")).toHaveLength(1);
  const store = root().querySelector<HTMLAnchorElement>(".movie-purchases a")!;
  expect(store.textContent?.trim()).toBe("store link");
  expect(store.href).toBe(
    "https://www.kaleidescape.com/movie-store/movie/fictional-film",
  );
  expect(store.rel).toContain("noreferrer");
  root().querySelectorAll<HTMLButtonElement>(".version-tabs button")[1].click();
  await flush();
  expect(text()).toContain("GROUP-ORDER");
  root().querySelector<HTMLDetailsElement>(".movie-purchases")!.open = true;
  root()
    .querySelector<HTMLButtonElement>(".movie-purchases .summary-edit")!
    .click();
  await flush();
  expect(
    root().querySelectorAll(".movie-purchases .summary-edit"),
  ).toHaveLength(1);
  const repair = root().querySelector("kaleidescape-group-purchase-edit")!;
  await vi.waitFor(() =>
    expect(
      repair.shadowRoot!.querySelector<HTMLDialogElement>("dialog")?.open,
    ).toBe(true),
  );
  await vi.waitFor(() =>
    expect(repair.shadowRoot!.querySelector('[name="order_id"]')).toBeTruthy(),
  );
  expect(
    repair.shadowRoot!.querySelector(
      '[name="purchase_information_unavailable"]',
    ),
  ).toBeTruthy();
  expect(
    repair.shadowRoot!.querySelector<HTMLInputElement>('[name="order_id"]')!
      .value,
  ).toBe("GROUP-ORDER");
  expect(root().querySelector<HTMLDialogElement>("#title-dialog")!.open).toBe(
    true,
  );
});

it("shows one group summary for complementary receipt records", async () => {
  transport.libraryTitles[0].purchase_history = [
    {
      id: "e".repeat(64),
      title: "Fictional purchase",
      purchased_on: "2020-01-02",
      purchase_price: null,
      retail_price: "$19.99",
      order_id: null,
      href: null,
    },
    {
      id: "f".repeat(64),
      title: "Fictional purchase",
      purchased_on: "2021-02-03",
      purchase_price: "$5.99",
      retail_price: null,
      order_id: "FICTIONAL-2",
      href: "/movie-store/movie/fictional",
    },
  ];
  title("Voyage to Europa").click();
  await flush();
  const details = root().querySelector(".movie-purchases")!;
  expect(details.textContent).toContain("$5.99");
  expect(details.textContent).toContain("$19.99");
  expect(details.textContent).toContain("Multiple purchase records");
  expect(details.querySelectorAll("a")).toHaveLength(1);
  expect(details.querySelectorAll("p")).toHaveLength(2);
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
  expect(text()).toContain("Total 2");
  expect(root().querySelector("#library-options")!.textContent).not.toContain(
    "individual versions",
  );
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

it("shows one Favorites badge for the group and uses the same Favorites filter", async () => {
  const first = libraryTitle({ title: "Fictional group", collections: [] });
  const second = libraryTitle({
    id: "d".repeat(64),
    title: "Fictional group",
    collections: ["Favorites"],
  });
  transport.libraryTitles = [
    first,
    second,
    libraryTitle({
      id: "e".repeat(64),
      title: "Not a favorite",
      collections: [],
    }),
  ];
  transport.libraryGroups.set(first.id, "group");
  transport.libraryGroups.set(second.id, "group");
  button("Refresh cached data").click();
  await flush();
  title("Fictional group").click();
  await flush();
  const badges = root().querySelectorAll<HTMLButtonElement>(
    "#title-dialog .movie-heading-badges .collection-favorite",
  );
  expect(badges).toHaveLength(1);
  expect(badges[0].textContent?.trim()).toBe("Favorites");
  badges[0].click();
  await flush();
  expect(root().querySelectorAll("tbody tr")).toHaveLength(1);
  expect(title("Fictional group")).toBeTruthy();
  expect(new URL(location.href).searchParams.getAll("library_status")).toEqual([
    "favorite",
  ]);
  button("Filters (1)").click();
  await flush();
  const selected = root().querySelector<HTMLInputElement>(
    '[name="status"][value="favorite"]',
  )!;
  expect(selected.checked).toBe(true);
  expect(selected.parentElement?.textContent?.trim()).toBe("Favorites");
});

it("replaces all criteria when clicking people, years, genres, collections, status, formats or ratings", async () => {
  const movie = libraryTitle({
    title: "Clickable movie",
    actors: ["Fictional Shared Name"],
    directors: ["Fictional Director"],
    genres: ["Adventure"],
    collections: ["All", "Favorites", "WatchSoon", "Family"],
    year: 2025,
    rating: "PG",
    edition: "4K HDR10",
    formats: ["4K HDR10"],
    watched_status: "watched",
    movie_statuses: ["watched", "unwatched", "in_progress"],
    is_recently_added: true,
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
    ["Favorites", "status", ["favorite"]],
    ["Watched", "status", ["watched"]],
    ["Unwatched", "status", ["unwatched"]],
    ["In progress", "status", ["in_progress"]],
    ["Watch Soon", "status", ["watch_soon"]],
    ["Recently Added", "status", ["recently_added"]],
    ["Family", "collection", ["Family"]],
    ["All", "all", []],
    ["4K", "format", ["4K"]],
    ["HDR10", "format", ["HDR10"]],
    ["PG", "rating", ["PG"]],
  ] as const;
  for (const [label, key, value] of cases) {
    // Remount with unrelated URL filters; every click replaces them and resets pagination.
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
    history.replaceState(
      null,
      "",
      "/kaleidescape-companion?companion_page=library&library_query=Clickable&library_collection=Favorites&library_genre=Adventure&library_year=2025&library_format=4K&library_rating=PG&library_status=watched",
    );
    element = document.createElement(
      "kaleidescape-library",
    ) as KaleidescapeLibrary;
    element.client = transport.client();
    element.scope = { ...info, library_enabled: true };
    document.body.append(element);
    await vi.waitFor(() => expect(title("Clickable movie")).toBeTruthy());
    title("Clickable movie").click();
    await flush();
    expect(
      [
        ...root().querySelectorAll(
          ".movie-heading-badges .format-badge, .movie-heading-badges .rating-badge, .movie-heading-badges .collection-badge",
        ),
      ].every((badge) => badge.tagName === "BUTTON"),
    ).toBe(true);
    const clickable = [
      ...root().querySelectorAll<HTMLButtonElement>("#title-dialog button"),
    ].find((node) =>
      label === "Recently Added"
        ? node.getAttribute("aria-label") ===
          "Filter by movie status: Recently Added"
        : node.textContent?.trim() === label,
    )!;
    expect(clickable, label).toBeTruthy();
    clickable.click();
    await flush();
    const filters = transport.calls
      .filter((call) => call.type.endsWith("library/list"))
      .at(-1)!.filters as Record<string, unknown>;
    expect(filters).toMatchObject({
      query: key === "query" ? JSON.stringify(value) : "",
      offset: 0,
      ...(key === "all"
        ? {}
        : { [key]: key === "query" ? JSON.stringify(value) : value }),
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
    ).toBe(key === "query" ? JSON.stringify(value) : "");
    if (key !== "all")
      expect(readLibraryFilters(undefined, true)![key]).toEqual(
        key === "query" ? JSON.stringify(value) : value,
      );
    if (label === "Fictional Shared Name")
      expect(root().querySelectorAll("tbody tr")).toHaveLength(2);
  }
});

it.each([
  [
    "Filter by movie status: Recently Added",
    { key: "status", value: "recently_added" },
  ],
  ["Show all movies", { key: "collection", value: "All" }],
] as const)(
  "opens the correct Library filter from a linked movie dialog: %s",
  async (label, expected) => {
    element.remove();
    transport.libraryTitles[0].is_recently_added = true;
    transport.libraryTitles[0].collections = ["All"];
    element = document.createElement(
      "kaleidescape-library",
    ) as KaleidescapeLibrary;
    element.client = transport.client();
    element.scope = { ...info, library_enabled: true };
    element.dialogOnly = true;
    element.openTitleId = transport.libraryTitles[0].id;
    const browse = vi.fn();
    element.addEventListener("browse-library", browse);
    document.body.append(element);
    await vi.waitFor(() =>
      expect(root().querySelector(`[aria-label="${label}"]`)).toBeTruthy(),
    );
    root().querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)!.click();
    expect((browse.mock.calls[0][0] as CustomEvent).detail).toEqual(expected);
  },
);

it("offers URL-backed genre/year/format filters and hides the tablist for one version", async () => {
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
  expect(readLibraryFilters(undefined, true)).toMatchObject({
    genre: ["Adventure"],
    year: ["2025"],
    format: ["HDR10"],
  });
  expect(root().querySelector(".library-footer")?.textContent).toContain(
    "Matches 1",
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
  ).toBe(JSON.stringify("Fictional Director"));
  expect(
    transport.calls.filter((call) => call.type.endsWith("library/list")).at(-1)!
      .filters,
  ).toMatchObject({ query: JSON.stringify("Fictional Director"), offset: 0 });
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
      purchased_on: null,
      purchase_price: "$12.99",
      retail_price: "$24.99",
      order_id: "FICTIONAL-ORDER",
      href: "https://store.example.invalid/movie",
    },
  ];
  title("Voyage to Europa").click();
  await flush();
  expect(text()).toContain("Purchase details");
  expect(text()).toContain("FICTIONAL-ORDER");
  expect(text()).toContain("Date not imported");
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
  expect(text()).not.toContain("Purchase details");
});

it("overlays scraper conflicts independently of badges and persists the missing-data filter", async () => {
  transport.libraryTitles[0].scraper_conflict = true;
  transport.missingMetadataArtwork.add(transport.libraryTitles[0].id);
  button("Refresh cached data").click();
  await flush();
  expect(root().querySelector("tbody .scraper-conflict-icon")).toBeTruthy();
  expect(
    root()
      .querySelector("tbody .scraper-conflict-icon")!
      .getAttribute("aria-label"),
  ).toContain("Missing metadata or artwork");
  expect(
    root()
      .querySelector("tbody .scraper-conflict-icon")!
      .getAttribute("aria-label"),
  ).toContain("Scraper conflict");
  button("Options").click();
  await flush();
  root()
    .querySelector<HTMLInputElement>(
      'input[name="library_view"][value="covers"]',
    )!
    .click();
  await flush();
  root().querySelector<HTMLInputElement>('[name="show_badges"]')!.click();
  await flush();
  expect(
    root().querySelector(".cover-tile > .scraper-conflict-icon"),
  ).toBeTruthy();
  expect(root().querySelector('[name="show_system_buttons"]')).toBeNull();
  modalClose(root()).click();
  button("Filters").click();
  await flush();
  expect(text()).toContain("Missing metadata/artwork");
  root()
    .querySelector<HTMLInputElement>('[name="missing_metadata_artwork"]')!
    .click();
  button("Apply filters").click();
  await flush();
  expect(readLibraryFilters(undefined, true)!.missing_metadata_artwork).toBe(
    true,
  );
  expect(root().querySelectorAll(".cover-tile")).toHaveLength(1);
  button("Clear Filter").click();
  await flush();
  expect(readLibraryFilters(undefined, true)!.missing_metadata_artwork).toBe(
    false,
  );
});

it("shows a missing-data warning without a scraper conflict across grouped versions", async () => {
  transport.libraryTitles.push(
    libraryTitle({ id: "d".repeat(64), edition: "HD" }),
  );
  transport.libraryGroups.set("a".repeat(64), "fictional-work");
  transport.libraryGroups.set("d".repeat(64), "fictional-work");
  transport.missingMetadataArtwork.add("d".repeat(64));
  button("Refresh cached data").click();
  await flush();
  const warning = title("Voyage to Europa")
    .closest("tr")!
    .querySelector(".scraper-conflict-icon")!;
  expect(warning.getAttribute("aria-label")).toBe(
    "Missing metadata or artwork",
  );
  button("Options").click();
  await flush();
  root()
    .querySelector<HTMLInputElement>(
      'input[name="library_view"][value="covers"]',
    )!
    .click();
  await flush();
  root().querySelector<HTMLInputElement>('[name="show_badges"]')!.click();
  await flush();
  expect(
    root().querySelector(
      '.cover-tile > .scraper-conflict-icon[aria-label="Missing metadata or artwork"]',
    ),
  ).toBeTruthy();
  const cover = root().querySelector<HTMLButtonElement>(
    '.cover-tile[aria-label*="Voyage to Europa"]',
  )!;
  expect(cover.getAttribute("aria-label")).toContain(
    "Missing metadata or artwork",
  );
  expect(cover.title).toContain("Missing metadata or artwork");
  modalClose(root()).click();
  button("Filters").click();
  await flush();
  root()
    .querySelector<HTMLInputElement>('[name="missing_metadata_artwork"]')!
    .click();
  button("Apply filters").click();
  await flush();
  expect(root().querySelectorAll(".cover-tile")).toHaveLength(1);
  expect(
    root().querySelector(".cover-tile .scraper-conflict-icon"),
  ).toBeTruthy();
  transport.missingMetadataArtwork.clear();
  button("Clear Filter").click();
  await flush();
  expect(root().querySelector(".scraper-conflict-icon")).toBeNull();
});

it("filters missing purchase information without adding a warning", async () => {
  transport.missingPurchaseInformation.add(transport.libraryTitles[0].id);
  button("Filters").click();
  await flush();
  root()
    .querySelector<HTMLInputElement>('[name="missing_purchase_information"]')!
    .click();
  button("Apply filters").click();
  await flush();
  expect(
    readLibraryFilters(undefined, true)!.missing_purchase_information,
  ).toBe(true);
  expect(root().querySelectorAll("tbody tr")).toHaveLength(1);
  expect(root().querySelector(".scraper-conflict-icon")).toBeNull();
  button("Clear Filter").click();
  await flush();
  expect(
    readLibraryFilters(undefined, true)!.missing_purchase_information,
  ).toBe(false);
});

it("hides conflict overlays and system-button options from standard users", async () => {
  transport.libraryTitles[0].scraper_conflict = true;
  transport.missingMetadataArtwork.add(transport.libraryTitles[0].id);
  element.scope = {
    ...info,
    library_enabled: true,
    permissions: { read: true, edit: false, export: false },
  };
  await flush();
  expect(root().querySelector(".scraper-conflict-icon")).toBeNull();
  button("Options").click();
  await flush();
  root()
    .querySelector<HTMLInputElement>(
      'input[name="library_view"][value="covers"]',
    )!
    .click();
  await flush();
  expect(root().querySelector(".scraper-conflict-icon")).toBeNull();
  expect(
    root()
      .querySelector<HTMLButtonElement>(
        '.cover-tile[aria-label*="Voyage to Europa"]',
      )!
      .getAttribute("aria-label"),
  ).not.toContain("Missing metadata");
  expect(root().querySelector('[name="show_system_buttons"]')).toBeNull();
});

it("limits the Basic footer to global counts and shows a highlighted match count only for active criteria", async () => {
  const client = element.client!;
  vi.spyOn(client, "libraryInfo").mockResolvedValue({
    title_count: 7,
    group_count: 5,
    collection_count: 3,
    status_counts: { unwatched: 2, watched: 2, in_progress: 1 },
    revision: 1,
    last_synced_at: "2026-10-01T00:00:00Z",
    collections_synced_at: null,
  });
  element.scope = {
    ...info,
    library_enabled: true,
    permissions: { read: true, edit: false, export: false },
  };
  await flush();
  await vi.waitFor(() =>
    expect(root().querySelector("footer")?.textContent).toContain("Total 5"),
  );
  const footer = () => root().querySelector("footer")!;
  expect(footer().textContent).toMatch(
    /Unwatched\s+2.*Watched\s+2.*In progress\s+1/s,
  );
  expect(footer().textContent).not.toMatch(
    /Artwork|Synced|scraped|per page|covers per row/,
  );
  expect(footer().querySelector(".match-count")).toBeNull();
  const search =
    root().querySelector<HTMLInputElement>("[name=library_search]") ??
    root().querySelector<HTMLInputElement>("input[type=search]")!;
  search.value = "Voyage";
  search.dispatchEvent(new Event("input"));
  root()
    .querySelector("form")!
    .dispatchEvent(new Event("submit", { cancelable: true }));
  await vi.waitFor(() =>
    expect(footer().querySelector("strong.match-count")?.textContent).toContain(
      "Matches",
    ),
  );
  expect(footer().textContent).toContain("Total 5");
});

it("opens a mobile search popup, discards cancelled input, and applies through the existing search", async () => {
  const shortcut = root().querySelector<HTMLButtonElement>(
    '.mobile-library-tools [aria-label="Search Library"]',
  )!;
  shortcut.click();
  await flush();
  const dialog = root().querySelector<HTMLDialogElement>("#library-search")!;
  expect(dialog.open).toBe(true);
  const query = dialog.querySelector<HTMLInputElement>("input")!;
  query.value = "Cancelled search";
  query.dispatchEvent(new Event("input"));
  modalClose(dialog).click();
  await flush();
  expect(dialog.open).toBe(false);
  expect(
    transport.calls.filter((c) => c.type.endsWith("library/list")).at(-1)
      ?.filters,
  ).not.toMatchObject({ query: "Cancelled search" });
  shortcut.click();
  await flush();
  expect(query.value).toBe("");
  query.value = "Europa";
  query.dispatchEvent(new Event("input"));
  dialog
    .querySelector("form")!
    .dispatchEvent(new Event("submit", { cancelable: true }));
  await flush();
  expect(dialog.open).toBe(false);
  expect(
    transport.calls.filter((c) => c.type.endsWith("library/list")).at(-1)
      ?.filters,
  ).toMatchObject({ query: "Europa" });
  expect(root().querySelector(".footer-summary")!.textContent).toContain(
    "Matches",
  );
  root()
    .querySelector<HTMLButtonElement>(
      '[aria-label="Clear search and filters"]',
    )!
    .click();
  await flush();
  expect(
    transport.calls.filter((c) => c.type.endsWith("library/list")).at(-1)
      ?.filters,
  ).toMatchObject({ query: "" });
});

it("connects mobile filter and randomize shortcuts and keeps refresh outside Options", async () => {
  root()
    .querySelector<HTMLButtonElement>('[aria-label="Library filters"]')!
    .click();
  await flush();
  expect(root().querySelector<HTMLDialogElement>("#filter-dialog")!.open).toBe(
    true,
  );
  modalClose(root().querySelector("#filter-dialog")!).click();
  root()
    .querySelector<HTMLButtonElement>('[aria-label="Library options"]')!
    .click();
  await flush();
  expect(
    root().querySelector<HTMLDialogElement>("#library-options")!.open,
  ).toBe(true);
  field("library_mobile_sort", "random");
  await flush();
  const seed = transport.calls
    .filter((c) => c.type.endsWith("library/list"))
    .at(-1)?.filters as Record<string, unknown>;
  root()
    .querySelector<HTMLButtonElement>('[aria-label="Randomize Library"]')!
    .click();
  await flush();
  const fresh = transport.calls
    .filter((c) => c.type.endsWith("library/list"))
    .at(-1)?.filters as Record<string, unknown>;
  expect(fresh.random_seed).not.toBe(seed.random_seed);
  expect(root().querySelector(".library-footer")!.textContent).not.toContain(
    "Refresh cached data",
  );
  expect(
    [
      ...root().querySelectorAll<HTMLButtonElement>("#library-options button"),
    ].some((b) => b.textContent?.trim() === "Refresh cached data"),
  ).toBe(false);
});

it("shows expandable grouped Journal history inside the Library title dialog", async () => {
  transport.options.library_enabled = true;
  transport.viewingLinks.set(
    transport.records[0].id,
    transport.libraryTitles[0].id,
  );
  title("Voyage to Europa").click();
  await vi.waitFor(() =>
    expect(
      root()
        .querySelector("kaleidescape-library-journal")
        ?.shadowRoot?.querySelector("summary")?.textContent,
    ).toContain("Journal"),
  );
  const journal = root().querySelector("kaleidescape-library-journal")!;
  expect(root().querySelector<HTMLDialogElement>("#title-dialog")!.open).toBe(
    true,
  );
  expect(journal.shadowRoot!.querySelector("details")!.open).toBe(false);
  journal.shadowRoot!.querySelector<HTMLDetailsElement>("details")!.open = true;
  expect(journal.shadowRoot!.textContent).toContain("Completed");
  const edit = vi.fn();
  journal.addEventListener("edit-journal", edit);
  const editButton =
    journal.shadowRoot!.querySelector<HTMLButtonElement>("summary button")!;
  expect(editButton.textContent?.trim()).toBe("edit");
  editButton.click();
  expect(edit.mock.calls[0][0].detail).toBe(transport.records[0].id);
  expect(root().querySelector<HTMLDialogElement>("#title-dialog")!.open).toBe(
    true,
  );
});

it("lets the Journal heading edit link select among multiple viewings", async () => {
  transport.viewingLinks.set(
    transport.records[0].id,
    transport.libraryTitles[0].id,
  );
  transport.viewingLinks.set(
    transport.records[1].id,
    transport.libraryTitles[0].id,
  );
  title("Voyage to Europa").click();
  await vi.waitFor(() =>
    expect(
      root()
        .querySelector("kaleidescape-library-journal")
        ?.shadowRoot?.querySelectorAll("li"),
    ).toHaveLength(2),
  );
  const journal = root().querySelector("kaleidescape-library-journal")!;
  journal.shadowRoot!.querySelector<HTMLDetailsElement>("details")!.open = true;
  const edit = vi.fn();
  journal.addEventListener("edit-journal", edit);
  journal
    .shadowRoot!.querySelector<HTMLButtonElement>("summary button")!
    .click();
  await vi.waitFor(() =>
    expect(
      journal.shadowRoot!.querySelector<HTMLDialogElement>(
        ".journal-edit-chooser",
      )?.open,
    ).toBe(true),
  );
  journal
    .shadowRoot!.querySelectorAll<HTMLButtonElement>(
      ".journal-edit-chooser li button",
    )[1]
    .click();
  expect(edit).toHaveBeenCalledOnce();
  expect([transport.records[0].id, transport.records[1].id]).toContain(
    edit.mock.calls[0][0].detail,
  );
});

it("places Journal before purchases without a temporary layout switch", async () => {
  transport.libraryTitles[0].purchased_on = "2020-05-12";
  transport.viewingLinks.set(
    transport.records[0].id,
    transport.libraryTitles[0].id,
  );
  transport.libraryTitles[0].purchase_history = [
    {
      id: "p".repeat(64),
      title: "Example",
      purchased_on: null,
      purchase_price: "$4.99",
      retail_price: null,
      order_id: "EXAMPLE",
      href: null,
    },
  ];
  title("Voyage to Europa").click();
  await vi.waitFor(() =>
    expect(
      root().querySelector(".movie-aside .movie-purchases"),
    ).not.toBeNull(),
  );
  const aside = root().querySelector(".movie-aside")!;
  expect(
    aside.querySelector(".movie-record-details .movie-purchases"),
  ).toBeNull();
  expect(
    aside
      .querySelector(".movie-journal")!
      .compareDocumentPosition(aside.querySelector(".movie-purchases")!) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  expect(text()).not.toContain("Use current movie details");
  expect(text()).not.toContain("Use consolidated movie details");
});

it("hides purchase details in Basic mode even for an administrator", async () => {
  element.advanced = false;
  transport.libraryTitles[0].purchased_on = "2020-05-12";
  transport.libraryTitles[0].purchase_history = [
    {
      id: "p".repeat(64),
      title: "Example",
      purchased_on: null,
      purchase_price: "$4.99",
      retail_price: null,
      order_id: "PRIVATE-ORDER",
      href: null,
    },
  ];
  title("Voyage to Europa").click();
  await flush();
  expect(text()).not.toContain("PRIVATE-ORDER");
  expect(root().querySelector(".movie-purchases")).toBeNull();
  expect(
    root().querySelector(".movie-record-details")!.textContent,
  ).not.toContain("Purchased");
});

it("shows queued collection progress, completion and clears private status on role change", async () => {
  const movie = transport.libraryTitles[0];
  const job = {
    request_id: "fictional-queue-request",
    title_id: movie.id,
    group_id: movie.id,
    title: movie.title,
    collection: "Favorites",
    operation: "add" as const,
    status: "queued" as const,
    error: null,
  };
  transport.collectionJobs = [job];
  const refresh = () =>
    (element as unknown as { refreshStatus(): Promise<void> }).refreshStatus();
  await refresh();
  await flush();
  expect(root().querySelector(".collection-pending")).not.toBeNull();
  expect(
    root()
      .querySelector(".pending-collection-badge")
      ?.getAttribute("aria-label"),
  ).toBe("Collection change in progress: Favorites");
  expect(root().querySelector(".library-footer")?.textContent).toContain(
    "1 queued",
  );
  transport.collectionJobs = [{ ...job, status: "confirmed" }];
  await refresh();
  await flush();
  expect(root().querySelector(".collection-pending")).toBeNull();
  expect(root().querySelector(".collection-toast")?.textContent).toContain(
    "verified and Library refreshed",
  );
  expect(root().querySelector(".collection-toast")?.classList).toContain(
    "notification-success",
  );
  element.scope = {
    ...info,
    library_enabled: true,
    permissions: { read: true, edit: false, export: false },
  };
  await flush();
  expect(root().querySelector(".collection-toast")).toBeNull();
});

it("explains and resolves an unconfirmed change inside movie details", async () => {
  const movie = transport.libraryTitles[0];
  transport.options.library_allow_collection_add = true;
  transport.pendingAdds = [
    {
      request_id: "fictional-unconfirmed",
      title_id: movie.id,
      title: movie.title,
      collection: "WatchSoon",
    },
  ];
  await (
    element as unknown as { refreshStatus(): Promise<void> }
  ).refreshStatus();
  await flush();
  expect(
    root().querySelector(".library-notifications .notification-warning")
      ?.textContent,
  ).toContain("Unconfirmed collection change");
  title(movie.title).click();
  await flush();
  const detail = root().querySelector("#title-dialog")!;
  expect(detail.textContent).toContain("Collection changes are paused");
  const collection = detail.querySelector(
    "kaleidescape-library-collection-add",
  )!;
  await (collection as unknown as { updateComplete: Promise<void> })
    .updateComplete;
  expect(
    collection.shadowRoot!.querySelector<HTMLButtonElement>(
      ".collection-button",
    )!.disabled,
  ).toBe(true);
  const recovery = [...detail.querySelectorAll("button")].find(
    (item) => item.textContent?.trim() === "Check membership",
  )!;
  recovery.click();
  await flush();
  expect(detail.textContent).toContain(
    "The requested membership is not confirmed",
  );
  vi.stubGlobal(
    "confirm",
    vi.fn(() => true),
  );
  [...detail.querySelectorAll("button")]
    .find(
      (item) => item.textContent?.trim() === "Acknowledge unconfirmed change",
    )!
    .click();
  await flush();
  await flush();
  expect(
    root().querySelector(".library-notifications .notification-info")
      ?.textContent,
  ).toContain("Request acknowledged");
  expect(detail.textContent).not.toContain("Collection changes are paused");
  expect(
    collection.shadowRoot!.querySelector<HTMLButtonElement>(
      ".collection-button",
    )!.disabled,
  ).toBe(false);
});

it("shows dismissible collection notifications over the Library without reviving acknowledged jobs", async () => {
  const movie = transport.libraryTitles[0];
  const job = {
    request_id: "failed-request",
    title_id: movie.id,
    group_id: movie.id,
    title: movie.title,
    collection: "WatchSoon",
    operation: "add" as const,
    status: "failed" as const,
    error: "library_timeout",
  };
  transport.collectionJobs = [
    job,
    {
      ...job,
      request_id: "acknowledged-request",
      status: "interrupted",
      error: "acknowledged",
    },
  ];
  await (
    element as unknown as { refreshStatus(): Promise<void> }
  ).refreshStatus();
  await flush();
  const overlay = root().querySelector(".library-notifications")!;
  expect(overlay.textContent).toContain("server took too long");
  expect(overlay.querySelector(".notification-error")).not.toBeNull();
  expect(overlay.textContent).not.toContain("acknowledged");
  expect(root().querySelector(".library-results")!.contains(overlay)).toBe(
    false,
  );
  overlay
    .querySelector<HTMLButtonElement>(
      '[aria-label="Dismiss collection failure"]',
    )!
    .click();
  await flush();
  await flush();
  expect(transport.collectionJobs).toHaveLength(1);
  expect(overlay.textContent).not.toContain("server took too long");
  expect(
    transport.calls.some((call) =>
      call.type.endsWith("/library/collections/dismiss"),
    ),
  ).toBe(true);
});

it("marks a requested Library sync as in progress", async () => {
  await (element as unknown as { sync(): Promise<void> }).sync();
  await flush();
  expect(
    root().querySelector(".library-notifications .notification-progress")
      ?.textContent,
  ).toContain("Library sync requested");
});
