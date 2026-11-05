import { modalClose } from "./dialog-helpers";
import { afterEach, expect, it, vi } from "vitest";
import "../src/library/library";
import type { KaleidescapeLibrary } from "../src/library/library";
import { ApiError } from "../src/core/api";
import type { LibraryPage } from "../src/core/api";
import { PreferenceStore } from "../src/ui/preference-store";
import {
  formatBadges,
  highestVideoFormat,
  statusBadges,
} from "../src/library/badges";
import { FixtureTransport, info, libraryTitle } from "./fixture";
let element: KaleidescapeLibrary | undefined;
async function flush() {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await element?.updateComplete;
}
async function mount(transport: FixtureTransport) {
  element = document.createElement(
    "kaleidescape-library",
  ) as KaleidescapeLibrary;
  element.client = transport.client();
  element.scope = { ...info, library_enabled: true };
  document.body.append(element);
  await flush();
  return element.shadowRoot!;
}
function button(root: ShadowRoot, label: string) {
  return [...root.querySelectorAll("button")].find(
    (node) => node.textContent!.trim() === label,
  )!;
}
function change(root: ShadowRoot, name: string, value: string) {
  const input = root.querySelector<HTMLInputElement>(`[name="${name}"]`)!;
  input.value = value;
  input.dispatchEvent(
    new Event(input.tagName === "SELECT" ? "change" : "input", {
      bubbles: true,
    }),
  );
}
afterEach(() => {
  element?.remove();
  element = undefined;
});

it("restores view, page size, search and sort after navigating away", async () => {
  const transport = new FixtureTransport();
  let root = await mount(transport);
  root
    .querySelector<HTMLInputElement>(
      'input[name="library_view"][value="covers"]',
    )!
    .click();
  await flush();
  change(root, "library_page_size", "25");
  await flush();
  change(root, "library_query", "Voyage");
  button(root, "Search").click();
  await flush();
  change(root, "library_sort", "year");
  await flush();
  button(root, "Ascending ↑").click();
  await flush();
  expect(transport.uiPreferences).toMatchObject({
    view: "covers",
    page_size: 25,
    query: "Voyage",
    sort: "year",
    descending: true,
  });
  element!.remove();
  root = await mount(transport);
  expect(root.querySelector(".cover-grid")).toBeTruthy();
  expect(
    root.querySelector<HTMLSelectElement>('[name="library_page_size"]')!.value,
  ).toBe("25");
  expect(
    root.querySelector<HTMLInputElement>('[name="library_query"]')!.value,
  ).toBe("Voyage");
  expect(
    root.querySelector<HTMLSelectElement>('[name="library_sort"]')!.value,
  ).toBe("year");
  expect(button(root, "Descending ↓")).toBeTruthy();
  expect(
    transport.calls.some((call) => call.type.endsWith("/settings/submit")),
  ).toBe(false);
});
it("reshuffles Random sorting, preserves its seed through filtering and reload, and keeps six columns", async () => {
  const transport = new FixtureTransport();
  let root = await mount(transport);
  change(root, "library_sort", "random");
  await flush();
  const seed = transport.uiPreferences.random_seed;
  expect(seed).toMatch(/^[a-f0-9]{32}$/);
  expect(button(root, "Randomize")).toBeTruthy();
  expect(root.querySelectorAll("thead th")).toHaveLength(6);
  expect(
    transport.calls.filter((call) => call.type.endsWith("library/list")).at(-1)
      ?.filters,
  ).toMatchObject({ sort: "random", random_seed: seed, offset: 0 });
  button(root, "Randomize").click();
  await flush();
  const next = transport.uiPreferences.random_seed;
  expect(next).not.toBe(seed);
  expect(
    transport.calls.filter((call) => call.type.endsWith("library/list")).at(-1)
      ?.filters,
  ).toMatchObject({ sort: "random", random_seed: next });
  button(root, "Clear Filter").click();
  await flush();
  expect(
    transport.calls.filter((call) => call.type.endsWith("library/list")).at(-1)
      ?.filters,
  ).toMatchObject({ random_seed: next });
  element!.remove();
  root = await mount(transport);
  expect(
    root.querySelector<HTMLSelectElement>('[name="library_sort"]')!.value,
  ).toBe("random");
  expect(button(root, "Randomize")).toBeTruthy();
  expect(
    transport.calls.filter((call) => call.type.endsWith("library/list")).at(-1)
      ?.filters,
  ).toMatchObject({ random_seed: next });
  change(root, "library_sort", "name");
  await flush();
  expect(button(root, "Ascending ↑")).toBeTruthy();
});

it("shows admin purchase details and persists the optional footer cost", async () => {
  const transport = new FixtureTransport();
  transport.purchaseTotals = {
    ...transport.purchaseTotals,
    purchase_count: 3,
    unique_transactions: 2,
    missing_purchase_prices: 1,
    missing_order_ids: 1,
    currencies: [
      {
        currency: "$",
        library_cost: "$12.34",
        retail_price: "$20.00",
        savings: "$7.66",
      },
    ],
  };
  let root = await mount(transport);
  expect(
    transport.calls.some((call) =>
      call.type.endsWith("library/purchases/summary"),
    ),
  ).toBe(false);
  button(root, "Options").click();
  const details = root.querySelector<HTMLDetailsElement>(".purchase-details")!;
  expect(details).not.toBeNull();
  details.open = true;
  details.dispatchEvent(new Event("toggle"));
  await vi.waitFor(() => expect(details.textContent).toContain("$12.34"));
  expect(details.textContent).toContain("$20.00");
  expect(details.textContent).toContain("$7.66");
  expect([...details.querySelectorAll("dd")].at(-1)?.textContent).toBe("2");
  expect(root.querySelector(".library-footer")!.textContent).not.toContain(
    "Library cost",
  );
  root.querySelector<HTMLInputElement>('[name="show_library_cost"]')!.click();
  await flush();
  expect(transport.uiPreferences.show_library_cost).toBe(true);
  expect(root.querySelector(".library-footer")!.textContent).toContain(
    "Library cost $12.34",
  );
  element!.remove();
  root = await mount(transport);
  await vi.waitFor(() =>
    expect(root.querySelector(".library-footer")!.textContent).toContain(
      "Library cost $12.34",
    ),
  );
  expect(
    root.querySelector<HTMLInputElement>('[name="show_library_cost"]')!.checked,
  ).toBe(true);
});

it("never exposes or requests financial totals for readers, even with a saved footer flag", async () => {
  const transport = new FixtureTransport();
  transport.uiPreferences.show_library_cost = true;
  element = document.createElement(
    "kaleidescape-library",
  ) as KaleidescapeLibrary;
  element.client = transport.client();
  element.scope = {
    ...info,
    library_enabled: true,
    permissions: { read: true, edit: false, export: false },
  };
  document.body.append(element);
  await flush();
  const root = element.shadowRoot!;
  expect(root.querySelector('[name="show_library_cost"]')).toBeNull();
  expect(root.querySelector(".purchase-details")).toBeNull();
  expect(root.querySelector(".library-footer")!.textContent).not.toContain(
    "Library cost",
  );
  expect(
    transport.calls.some((call) =>
      call.type.endsWith("library/purchases/summary"),
    ),
  ).toBe(false);
});

it("discards late private totals after an account/scope change", async () => {
  const transport = new FixtureTransport();
  const root = await mount(transport);
  let release!: (
    value: typeof transport.purchaseTotals & { revision: number },
  ) => void;
  vi.spyOn(element!.client!, "libraryPurchaseTotals").mockReturnValue(
    new Promise((done) => {
      release = done;
    }),
  );
  root.querySelector<HTMLInputElement>('[name="show_library_cost"]')!.click();
  await flush();
  element!.scope = {
    ...info,
    library_enabled: true,
    permissions: { read: true, edit: false, export: false },
  };
  await flush();
  release({
    ...transport.purchaseTotals,
    revision: 1,
    purchase_count: 1,
    currencies: [
      {
        currency: "$",
        library_cost: "$9876.54",
        retail_price: null,
        savings: null,
      },
    ],
  });
  await flush();
  expect(root.textContent).not.toContain("9876.54");
  expect(root.querySelector(".purchase-details")).toBeNull();
});

it.each([25, "all"])(
  "shuffles on HTTP without randomUUID with page size %s",
  async (pageSize) => {
    const getRandomValues = crypto.getRandomValues.bind(crypto);
    vi.stubGlobal("crypto", { getRandomValues });
    try {
      const transport = new FixtureTransport();
      transport.libraryTitles = Array.from({ length: 60 }, (_, index) =>
        libraryTitle({
          id: String(index).padStart(64, "0"),
          title: `Fictional ${index}`,
        }),
      );
      const root = await mount(transport);
      change(root, "library_page_size", String(pageSize));
      await vi.waitFor(() =>
        expect(transport.uiPreferences.page_size).toBe(pageSize),
      );
      change(root, "library_sort", "random");
      await vi.waitFor(() => expect(button(root, "Randomize")).toBeTruthy());
      const seed = transport.uiPreferences.random_seed;
      expect(seed).toMatch(/^[a-f0-9]{32}$/);
      expect(
        root.querySelector<HTMLSelectElement>('[name="library_sort"]')!.value,
      ).toBe("random");
      button(root, "Randomize").click();
      await vi.waitFor(() =>
        expect(transport.uiPreferences.random_seed).not.toBe(seed),
      );
      const next = transport.uiPreferences.random_seed;
      if (pageSize === 25) {
        await vi.waitFor(() =>
          expect(button(root, "Next").disabled).toBe(false),
        );
        button(root, "Next").click();
        await flush();
      }
      expect(
        root.querySelector<HTMLSelectElement>('[name="library_sort"]')!.value,
      ).toBe("random");
      expect(button(root, "Randomize")).toBeTruthy();
      const calls = transport.calls.filter((call) =>
        call.type.endsWith("library/list"),
      );
      expect(calls.at(-1)?.filters).toMatchObject({
        sort: "random",
        random_seed: next,
      });
    } finally {
      vi.unstubAllGlobals();
    }
  },
);

it("All loads bounded revision-bound pages and keeps the entire final remainder", async () => {
  const transport = new FixtureTransport();
  transport.libraryTitles = Array.from({ length: 1105 }, (_, i) =>
    libraryTitle({ id: String(i).padStart(64, "0"), title: `Fictional ${i}` }),
  );
  const root = await mount(transport);
  change(root, "library_page_size", "all");
  await vi.waitFor(
    () => expect(root.querySelectorAll("tbody tr")).toHaveLength(1105),
    { timeout: 5000 },
  );
  const pages = transport.calls
    .filter((call) => call.type.endsWith("/library/list"))
    .slice(-2);
  expect(pages[0].filters).toMatchObject({ limit: 1000, offset: 0 });
  expect(pages[1].filters).toMatchObject({
    limit: 1000,
    offset: 1000,
    revision: 5,
  });
  expect(button(root, "Next")).toBeUndefined();
  expect(transport.uiPreferences.page_size).toBe("all");
});
it("persists applied facets across remount, discards drafts, and saves Clear Filter", async () => {
  const transport = new FixtureTransport();
  let root = await mount(transport);
  button(root, "Filters").click();
  await flush();
  root
    .querySelector<HTMLInputElement>('input[name="status"][value="watched"]')!
    .click();
  await flush();
  modalClose(root).click();
  await flush();
  expect(transport.uiPreferences.status).toEqual([]);
  button(root, "Filters").click();
  await flush();
  root
    .querySelector<HTMLInputElement>('input[name="status"][value="watched"]')!
    .click();
  await flush();
  button(root, "Apply filters").click();
  await flush();
  expect(transport.uiPreferences.status).toEqual(["watched"]);
  element!.remove();
  root = await mount(transport);
  const last = transport.calls
    .filter((call) => call.type.endsWith("/library/list"))
    .at(-1)!;
  expect(last.filters).toMatchObject({ status: ["watched"] });
  button(root, "Clear Filter").click();
  await flush();
  expect(transport.uiPreferences.status).toEqual([]);
});
it("bounds All aggregation and stops after navigation invalidates the request", async () => {
  const client = new FixtureTransport().client();
  const page: LibraryPage = {
    items: Array.from({ length: 10001 }, () => libraryTitle()),
    total: 10001,
    offset: 0,
    has_more: false,
    revision: 1,
    preferences_key: "x",
    facets: {},
    truncated_facets: [],
  };
  const list = vi.spyOn(client, "libraryList").mockResolvedValue(page);
  await expect(client.libraryAll(info, {}, () => true)).rejects.toMatchObject({
    code: "library_page_too_large",
  });
  let current = true;
  list.mockImplementationOnce(async () => {
    current = false;
    return page;
  });
  await expect(
    client.libraryAll(info, {}, () => current),
  ).rejects.toMatchObject({
    code: "not_ready",
  });
  // UTF-8 is measured rather than UTF-16 string length, including non-ASCII text.
  list.mockResolvedValueOnce({
    ...page,
    items: [libraryTitle({ title: "界".repeat(12 * 1024 * 1024) })],
  });
  await expect(client.libraryAll(info, {}, () => true)).rejects.toMatchObject({
    code: "library_page_too_large",
  });
});
it("discards an All fetch if the catalog changes between pages", async () => {
  const client = new FixtureTransport().client();
  const page: LibraryPage = {
    items: [libraryTitle()],
    total: 2,
    offset: 0,
    has_more: true,
    revision: 1,
    preferences_key: "x",
    facets: {},
    truncated_facets: [],
  };
  vi.spyOn(client, "libraryList")
    .mockResolvedValueOnce(page)
    .mockResolvedValueOnce({ ...page, revision: 2, has_more: false });
  await expect(client.libraryAll(info, {}, () => true)).rejects.toMatchObject({
    code: "refresh_required",
  });
});
it("renders known format badges and named status flags in both views", async () => {
  const transport = new FixtureTransport();
  transport.libraryTitles = [
    libraryTitle({
      is_favorite: true,
      is_recently_added: true,
      watched_status: "watched",
      formats: ["4K Cinematic SDR HDR10 Dolby Vision Dolby Atmos", "HD"],
    }),
  ];
  const root = await mount(transport);
  expect(
    root.querySelector('.library-summary-line [aria-label="Favorite"]'),
  ).toBeTruthy();
  expect(
    [...root.querySelectorAll(".library-table .format-badge")].map((node) =>
      node.getAttribute("aria-label"),
    ),
  ).toEqual([
    "4K Cinematic",
    "HD",
    "SDR",
    "HDR10",
    "Dolby Vision",
    "Dolby Atmos",
  ]);
  expect(
    root.querySelector(".library-table .format-hdr10 .hdr-symbol"),
  ).toBeTruthy();
  expect(
    root.querySelector(".library-table .format-vision .dolby-symbol"),
  ).toBeTruthy();
  expect(
    root.querySelector(".library-table .format-atmos .dolby-symbol"),
  ).toBeTruthy();
  expect(root.querySelector(".library-table .format-sdr")).toBeTruthy();
  expect(
    formatBadges(libraryTitle({ formats: ["SD"] })).map((badge) => badge.label),
  ).toEqual(["SD"]);
  expect(
    formatBadges(libraryTitle({ formats: ["4K SDR"] })).map(
      (badge) => badge.label,
    ),
  ).toEqual(["4K", "SDR"]);
  root
    .querySelector<HTMLInputElement>(
      'input[name="library_view"][value="covers"]',
    )!
    .click();
  await flush();
  expect(root.querySelectorAll(".cover-flags .cover-flag")).toHaveLength(2);
  expect(
    root.querySelector('.cover-flags [aria-label="Recently added"]'),
  ).toBeNull();
  expect(
    root.querySelector('.cover-flags [aria-label="Watched"]'),
  ).toBeTruthy();
  expect(root.querySelectorAll(".cover-formats .format-badge")).toHaveLength(1);
  expect(
    root.querySelector('.cover-formats [aria-label="4K Cinematic"]'),
  ).toBeTruthy();
  expect(
    formatBadges(libraryTitle({ formats: ["4K"] })).map((badge) => badge.label),
  ).toEqual(["4K"]);
  expect(
    formatBadges(libraryTitle({ formats: ["HDR10"] })).map(
      (badge) => badge.label,
    ),
  ).not.toContain("HD");
});
it("does not revive stale failed writes, and offers latest-value retries", async () => {
  const client = new FixtureTransport().client();
  let reject!: (error: unknown) => void;
  const save = vi
    .spyOn(client, "saveUIPreferences")
    .mockRejectedValueOnce(new ApiError("connection_lost"));
  const error = vi.fn();
  const store = new PreferenceStore(client, info, false, error);
  await store.load();
  store.set({ view: "covers" });
  await flush();
  expect(error).toHaveBeenCalled();
  store.retry();
  await flush();
  expect(save).toHaveBeenCalledTimes(2);
  save.mockReturnValueOnce(
    new Promise((_, fail) => {
      reject = fail;
    }),
  );
  store.set({ view: "covers" });
  store.set({ view: "list" });
  await flush();
  error.mockClear();
  reject(new ApiError("connection_lost"));
  await flush();
  expect(error).not.toHaveBeenCalled();
  store.dispose();
  expect(store.values).toEqual({});
});

it("keeps Favorite independent and replaces New with source progress or completion", () => {
  for (const [status, expected] of [
    ["unwatched", "recent"],
    ["in_progress", "progress"],
    ["watched", "watched"],
    ["unknown", "recent"],
  ] as const) {
    const title = libraryTitle({
      watched_status: status,
      is_recently_added: true,
      is_favorite: true,
    });
    expect(statusBadges(title).map((badge) => badge.key)).toEqual([
      expected,
      "favorite",
    ]);
    expect(title.is_recently_added).toBe(true);
  }
  expect(statusBadges(libraryTitle({ watched_status: "unwatched" }))).toEqual(
    [],
  );
  for (const [formats, expected] of [
    [["SD"], "SD"],
    [["SD", "HD"], "HD"],
    [["HD", "4K HDR10"], "4K"],
    [["4K", "4K Cinematic Dolby Vision"], "4K Cinematic"],
  ] as const)
    expect(
      highestVideoFormat(libraryTitle({ formats: [...formats] }))?.label,
    ).toBe(expected);
  expect(
    highestVideoFormat(libraryTitle({ formats: ["SDR HDR10 Dolby Atmos"] })),
  ).toBeUndefined();
});
it("saves Options toggles immediately and restores them after remount", async () => {
  const transport = new FixtureTransport();
  let root = await mount(transport);
  const options = root.querySelector<HTMLDialogElement>("#library-options")!;
  button(root, "Options").click();
  await flush();
  expect(options.open).toBe(true);
  expect(root.querySelector('[name="cover_size"]')).toBeNull();
  root
    .querySelector<HTMLInputElement>(
      'input[name="library_view"][value="covers"]',
    )!
    .click();
  await flush();
  expect(options.open).toBe(true);
  expect(root.querySelector('[name="cover_size"]')).toBeTruthy();
  for (const name of ["show_titles", "show_format", "show_badges"])
    root.querySelector<HTMLInputElement>(`input[name="${name}"]`)!.click();
  await flush();
  expect(transport.uiPreferences).toMatchObject({
    view: "covers",
    show_titles: false,
    show_format: false,
    show_badges: false,
  });
  expect(
    root.querySelector(".cover-caption,.cover-formats,.cover-flags"),
  ).toBeNull();
  expect(
    root.querySelector(".cover-tile")!.getAttribute("aria-label"),
  ).toContain("Details for");
  modalClose(root).click();
  await flush();
  expect(options.open).toBe(false);
  element!.remove();
  root = await mount(transport);
  expect(
    root.querySelector(".cover-caption,.cover-formats,.cover-flags"),
  ).toBeNull();
  for (const name of ["show_titles", "show_format", "show_badges"])
    expect(
      root.querySelector<HTMLInputElement>(`input[name="${name}"]`)!.checked,
    ).toBe(false);
  root
    .querySelector<HTMLInputElement>(
      'input[name="library_view"][value="list"]',
    )!
    .click();
  await flush();
  expect(
    root.querySelector(
      ".library-summary-line .format-badge,.library-summary-line .status-badge",
    ),
  ).toBeNull();
  expect(
    transport.calls.some((call) => call.type.endsWith("/settings/submit")),
  ).toBe(false);
});

it("debounces title/actor/director search, reuses detail badges, and saves optional cover ratings", async () => {
  const transport = new FixtureTransport();
  const root = await mount(transport);
  const query = root.querySelector<HTMLInputElement>('[name="library_query"]')!;
  query.value = "Fictional Act";
  query.dispatchEvent(new Event("input"));
  await vi.waitFor(() =>
    expect(
      transport.calls
        .filter((call) => call.type.endsWith("/library/list"))
        .at(-1)?.filters,
    ).toMatchObject({ query: "Fictional Act" }),
  );
  expect(transport.uiPreferences.query).toBe("Fictional Act");
  button(root, "Clear Filter").click();
  await flush();
  root
    .querySelector<HTMLInputElement>(
      'input[name="library_view"][value="covers"]',
    )!
    .click();
  await flush();
  root.querySelector<HTMLInputElement>('input[name="show_rating"]')!.click();
  await flush();
  expect(transport.uiPreferences.show_rating).toBe(true);
  expect(root.querySelector(".cover-rating .rating-badge")).toBeTruthy();
  root.querySelector<HTMLButtonElement>(".cover-tile")!.click();
  await flush();
  expect(
    root.querySelector("#title-dialog .detail-badges .format-badge"),
  ).toBeTruthy();
  expect(
    root.querySelector("#title-dialog .detail-badges .rating-badge"),
  ).toBeTruthy();
  expect(root.querySelector("#title-dialog")!.textContent).not.toContain(
    "Played",
  );
});
it("shows primary filters without actor or director lookup", async () => {
  const root = await mount(new FixtureTransport());
  button(root, "Filters").click();
  await flush();
  const legends = [...root.querySelectorAll("#filter-dialog legend")].map(
    (node) => node.textContent?.trim(),
  );
  expect(legends).toEqual([
    "Watched status",
    "Collection",
    "Rating",
    "Genre",
    "Year",
    "Viewing format",
  ]);
  expect(
    root.querySelector('[name="actor_search"], [name="director_search"]'),
  ).toBeNull();
  expect(root.querySelector("#filter-dialog .format-badge")).toBeTruthy();
});

it("orders ratings by age with general audiences at the top", async () => {
  const transport = new FixtureTransport();
  transport.libraryTitles = [
    "G",
    "NR-G",
    "PG",
    "PG-13",
    "R",
    "NR-R",
    "NC-17",
  ].map((rating, index) =>
    libraryTitle({
      id: `rating-${index}`,
      rating,
    }),
  );
  const root = await mount(transport);
  button(root, "Filters").click();
  await flush();
  const values = [
    ...root.querySelectorAll<HTMLInputElement>(
      '#filter-dialog input[name="rating"]',
    ),
  ].map((input) => input.value);
  expect(values).toEqual(["G", "NR-G", "PG", "PG-13", "NR-R", "R", "NC-17"]);
});

it("applies the Library fuzzy toggle to main search and local facet search", async () => {
  const transport = new FixtureTransport();
  const root = await mount(transport);
  const field = root.querySelector<HTMLInputElement>('[name="library_query"]')!;
  field.value = "Vyoage";
  field.dispatchEvent(new Event("input"));
  await vi.waitFor(() =>
    expect(
      transport.calls
        .filter((call) => call.type.endsWith("library/list"))
        .at(-1)?.filters,
    ).toMatchObject({ query: "Vyoage", fuzzy: true }),
  );
  root
    .querySelector<HTMLInputElement>('[name="library_fuzzy_search"]')!
    .click();
  await flush();
  await vi.waitFor(() =>
    expect(transport.searchPreferences.fuzzy_search).toBe(false),
  );
  expect(root.querySelectorAll("tbody tr")).toHaveLength(0);
  expect(
    transport.calls.filter((call) => call.type.endsWith("library/list")).at(-1)
      ?.filters,
  ).toMatchObject({ query: "Vyoage", fuzzy: false });
  button(root, "Clear Filter").click();
  await flush();
  button(root, "Filters").click();
  await flush();
  modalClose(root).click();
  await flush();
  root
    .querySelector<HTMLInputElement>('[name="library_fuzzy_search"]')!
    .click();
  await flush();
  button(root, "Filters").click();
  await flush();
  const find = root.querySelector<HTMLInputElement>('[name="facet_search"]')!;
  find.value = "Scince Fiction";
  find.dispatchEvent(new Event("input"));
  await flush();
  expect(
    root.querySelector<HTMLInputElement>(
      '[name="collection"][value="Science Fiction"]',
    ),
  ).toBeTruthy();
});
