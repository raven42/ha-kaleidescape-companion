import { afterEach, expect, it, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { LibraryPageCache } from "../src/library/page-cache";
import "../src/library/library";
import type { KaleidescapeLibrary } from "../src/library/library";
import type { LibraryInfo, LibraryPage } from "../src/core/api";
import { FixtureTransport, info, libraryTitle } from "./fixture";

afterEach(() => {
  document.body.replaceChildren();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it("persists bounded results across sessions and partitions different users", async () => {
  vi.stubGlobal("indexedDB", new IDBFactory());
  const page: LibraryPage = {
    items: [libraryTitle()],
    total: 1,
    offset: 0,
    has_more: false,
    revision: 1,
    cache_revision: 2,
    cache_context: "fixture-context",
    preferences_key: "prefs",
    facets: {},
    truncated_facets: [],
  };
  const first = new LibraryPageCache();
  first.setPersistent("user-a:dataset");
  first.put("query", page);
  const next = new LibraryPageCache();
  next.setPersistent("user-a:dataset");
  await vi.waitFor(async () =>
    expect(await next.restore("query")).toMatchObject({ cache_revision: 2 }),
  );
  const other = new LibraryPageCache();
  other.setPersistent("user-b:dataset");
  expect(await other.restore("query")).toBeUndefined();
  await next.clear("user-a:dataset");
  expect(next.get("query")).toBeUndefined();
  expect(await next.restore("query")).toBeUndefined();
  first.dispose();
  next.dispose();
  other.dispose();
});

it("shows a cached page while checking revisions, skips unchanged queries and reloads after a change", async () => {
  const transport = new FixtureTransport();
  const client = transport.client();
  const scope = { ...info, library_enabled: true };
  const pages = new LibraryPageCache();
  const mount = () => {
    const element = document.createElement(
      "kaleidescape-library",
    ) as KaleidescapeLibrary;
    element.client = client;
    element.scope = scope;
    element.pageCache = pages;
    document.body.append(element);
    return element;
  };
  const first = mount();
  await vi.waitFor(() =>
    expect(first.shadowRoot!.textContent).toContain("Voyage to Europa"),
  );
  const count = () =>
    transport.calls.filter((call) => call.type.endsWith("/library/list"))
      .length;
  const originalCount = count();
  const snapshot = await client.libraryInfo(scope);
  first.remove();
  let resolve!: (value: LibraryInfo) => void;
  vi.spyOn(client, "libraryInfo").mockReturnValueOnce(
    new Promise((done) => {
      resolve = done;
    }),
  );
  const second = mount();
  await vi.waitFor(() =>
    expect(second.shadowRoot!.textContent).toContain("Checking cached Library"),
  );
  expect(second.shadowRoot!.textContent).toContain("Voyage to Europa");
  expect(count()).toBe(originalCount);
  expect(
    second.shadowRoot!.querySelector<HTMLButtonElement>("tbody .link")
      ?.disabled,
  ).toBe(true);
  resolve(snapshot);
  await vi.waitFor(() =>
    expect(second.shadowRoot!.textContent).not.toContain(
      "Checking cached Library",
    ),
  );
  expect(count()).toBe(originalCount);
  second.remove();
  transport.revision++;
  const third = mount();
  await vi.waitFor(() => expect(count()).toBeGreaterThan(originalCount));
  await vi.waitFor(() =>
    expect(third.shadowRoot!.querySelector("tbody .link")).not.toBeNull(),
  );
  third.remove();
  const afterSourceChange = count();
  transport.cacheRevision = transport.revision + 1;
  const fourth = mount();
  await vi.waitFor(() => expect(count()).toBeGreaterThan(afterSourceChange));
  fourth.remove();
  const afterDatabaseChange = count();
  transport.cacheContext = "different-day-context";
  const fifth = mount();
  await vi.waitFor(() => expect(count()).toBeGreaterThan(afterDatabaseChange));
  fifth.remove();
  pages.dispose();
});

it.each(["name", "random"])(
  "reuses a persisted %s page after reopening when server revisions match",
  async (sort) => {
    vi.stubGlobal("indexedDB", new IDBFactory());
    const transport = new FixtureTransport();
    transport.uiPreferences.cover_cache = "persistent";
    transport.uiPreferences.sort = sort;
    transport.uiPreferences.random_seed = "a".repeat(32);
    const client = transport.client();
    const scope = { ...info, library_enabled: true };
    const namespace = JSON.stringify([
      "fictional-user",
      scope.entry_id,
      scope.dataset_id,
    ]);
    const create = (pages: LibraryPageCache) => {
      const element = document.createElement(
        "kaleidescape-library",
      ) as KaleidescapeLibrary;
      element.client = client;
      element.scope = scope;
      element.cacheUser = "fictional-user";
      element.pageCache = pages;
      document.body.append(element);
      return element;
    };
    const firstCache = new LibraryPageCache();
    const first = create(firstCache);
    await vi.waitFor(() =>
      expect(first.shadowRoot!.textContent).toContain("Voyage to Europa"),
    );
    const verifier = new LibraryPageCache();
    verifier.setPersistent(namespace);
    const count = () =>
      transport.calls.filter((call) => call.type.endsWith("/library/list"))
        .length;
    const initial = count();
    const saved = await vi.waitFor(async () => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(
          "kaleidescape-companion-library-pages",
          1,
        );
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const keys = await new Promise<IDBValidKey[]>((resolve, reject) => {
        const request = db
          .transaction("pages")
          .objectStore("pages")
          .getAllKeys();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      db.close();
      expect(keys).toContain(namespace);
      return true;
    });
    expect(saved).toBe(true);
    first.remove();
    firstCache.dispose();
    const secondCache = new LibraryPageCache();
    const second = create(secondCache);
    await vi.waitFor(() =>
      expect(second.shadowRoot!.textContent).toContain("Voyage to Europa"),
    );
    await vi.waitFor(() =>
      expect(second.shadowRoot!.textContent).not.toContain(
        "Checking cached Library",
      ),
    );
    expect(count()).toBe(initial);
    second.remove();
    secondCache.dispose();
    verifier.dispose();
  },
);

it("limits session results and clears entries when the panel session ends", () => {
  const pages = new LibraryPageCache();
  const page: LibraryPage = {
    items: [libraryTitle()],
    total: 1,
    offset: 0,
    has_more: false,
    revision: 1,
    cache_revision: 1,
    cache_context: "context",
    facets: {},
    truncated_facets: [],
  };
  for (let index = 0; index < 5; index++) pages.put(String(index), page);
  expect(pages.get("0")).toBeUndefined();
  expect(pages.get("4")).toBeDefined();
  pages.dispose();
  expect(pages.get("4")).toBeUndefined();
});

it("keeps cached movies disabled if the freshness check and refresh fail", async () => {
  const transport = new FixtureTransport();
  const client = transport.client();
  const scope = { ...info, library_enabled: true };
  const pages = new LibraryPageCache();
  const mount = () => {
    const element = document.createElement(
      "kaleidescape-library",
    ) as KaleidescapeLibrary;
    element.client = client;
    element.scope = scope;
    element.pageCache = pages;
    document.body.append(element);
    return element;
  };
  const first = mount();
  await vi.waitFor(() =>
    expect(first.shadowRoot!.textContent).toContain("Voyage to Europa"),
  );
  first.remove();
  vi.spyOn(client, "libraryInfo").mockRejectedValue(new Error("offline"));
  vi.spyOn(client, "libraryList").mockRejectedValue(new Error("offline"));
  const second = mount();
  await vi.waitFor(() =>
    expect(second.shadowRoot!.textContent).toContain(
      "Cached Library could not be refreshed",
    ),
  );
  expect(
    second.shadowRoot!.querySelector<HTMLButtonElement>("tbody .link")
      ?.disabled,
  ).toBe(true);
  second.remove();
  pages.dispose();
});

it("reuses a saved random order and invalidates it when another session shuffles", async () => {
  const transport = new FixtureTransport();
  transport.uiPreferences.sort = "random";
  transport.uiPreferences.random_seed = "a".repeat(32);
  transport.uiPreferences.page_size = "all";
  transport.libraryTitles = Array.from({ length: 30 }, (_, index) =>
    libraryTitle({
      id: index.toString(16).padStart(64, "0"),
      title: `Fictional ${index}`,
    }),
  );
  const client = transport.client();
  const liveInfo = client.libraryInfo.bind(client);
  const scope = { ...info, library_enabled: true };
  const pages = new LibraryPageCache();
  const mount = () => {
    const element = document.createElement(
      "kaleidescape-library",
    ) as KaleidescapeLibrary;
    element.client = client;
    element.scope = scope;
    element.pageCache = pages;
    document.body.append(element);
    return element;
  };
  const calls = () =>
    transport.calls.filter((call) => call.type.endsWith("/library/list"));
  const order = (element: KaleidescapeLibrary) =>
    [...element.shadowRoot!.querySelectorAll("tbody .link")].map((node) =>
      node.textContent?.trim(),
    );
  const first = mount();
  await vi.waitFor(() => expect(order(first)).toHaveLength(30));
  const firstOrder = order(first);
  const originalCount = calls().length;
  first.remove();
  const second = mount();
  await vi.waitFor(() => expect(order(second)).toHaveLength(30));
  await vi.waitFor(() =>
    expect(second.shadowRoot!.textContent).not.toContain(
      "Checking cached Library",
    ),
  );
  expect(calls()).toHaveLength(originalCount);
  expect(order(second)).toEqual(firstOrder);
  second.remove();

  let resolve!: (value: LibraryInfo) => void;
  vi.spyOn(client, "libraryInfo").mockReturnValueOnce(
    new Promise((done) => {
      resolve = done;
    }),
  );
  const third = mount();
  await vi.waitFor(() =>
    expect(third.shadowRoot!.textContent).toContain("Checking cached Library"),
  );
  transport.uiPreferences.random_seed = "b".repeat(32);
  resolve(await liveInfo(scope));
  await vi.waitFor(() => expect(calls()).toHaveLength(originalCount + 1));
  await vi.waitFor(() =>
    expect(third.shadowRoot!.textContent).not.toContain(
      "Checking cached Library",
    ),
  );
  const newOrder = order(third);
  expect(newOrder).not.toEqual(firstOrder);
  third.remove();
  const fourth = mount();
  await vi.waitFor(() => expect(order(fourth)).toHaveLength(30));
  await vi.waitFor(() =>
    expect(fourth.shadowRoot!.textContent).not.toContain(
      "Checking cached Library",
    ),
  );
  expect(calls()).toHaveLength(originalCount + 1);
  expect(order(fourth)).toEqual(newOrder);
  fourth.remove();
  pages.dispose();
});

it("refreshes an open random Library when another session changes its seed", async () => {
  const transport = new FixtureTransport();
  transport.uiPreferences.sort = "random";
  transport.uiPreferences.random_seed = "a".repeat(32);
  const client = transport.client();
  const pages = new LibraryPageCache();
  const element = document.createElement(
    "kaleidescape-library",
  ) as KaleidescapeLibrary;
  element.client = client;
  element.scope = { ...info, library_enabled: true };
  element.pageCache = pages;
  document.body.append(element);
  await vi.waitFor(() =>
    expect(element.shadowRoot!.textContent).toContain("Voyage to Europa"),
  );
  const calls = () =>
    transport.calls.filter((call) => call.type.endsWith("/library/list"));
  const count = calls().length;
  transport.uiPreferences.random_seed = "b".repeat(32);
  document.dispatchEvent(new Event("visibilitychange"));
  await vi.waitFor(() => expect(calls().length).toBeGreaterThan(count));
  expect(calls().at(-1)!.filters).toMatchObject({
    sort: "random",
    random_seed: "b".repeat(32),
    offset: 0,
  });
  element.remove();
  pages.dispose();
});
