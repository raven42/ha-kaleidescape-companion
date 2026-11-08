/** Fictional metadata-manager interactions; no provider or hardware calls. */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import "../src/enrichment/title-scrape";
import type { TitleScrape } from "../src/enrichment/title-scrape";
import type { ScrapeOptions, ScrapeReview } from "../src/core/api";
import { FixtureTransport, info } from "./fixture";

let element: TitleScrape;
let options: ScrapeOptions;
const root = () => element.shadowRoot!;
const button = (label: string) =>
  [...root().querySelectorAll<HTMLButtonElement>("button")].find(
    (node) => node.textContent!.trim() === label,
  )!;
async function flush() {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await element.updateComplete;
}
async function open() {
  root().querySelector<HTMLButtonElement>(".scrape-button")!.click();
  await flush();
}
const match = {
  id: "match-0",
  title: "Fictional Voyage",
  year: 2025,
  actors: ["Fictional Actor"],
  directors: ["Fictional Director"],
  genres: ["Adventure"],
  has_artwork: false,
};
const review: ScrapeReview = {
  plan_id: "12345678-1234-4234-9234-123456789abc",
  title: "Fictional Voyage",
  matched: { title: "Fictional Voyage", year: 2025 },
  fields: {},
  images: [{ id: "poster-0", kind: "poster", width: 500, height: 750 }],
  artwork_enabled: true,
};

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
  options = {
    title: "Fictional Voyage",
    search_title: "Fictional Voyage",
    snapshot: "b".repeat(64),
    current: {
      title: "Fictional Voyage",
      year: 2025,
      directors: ["Original Director"],
      actors: ["Original Actor"],
      original_artwork_key: "a".repeat(64),
      artwork_key: "a".repeat(64),
      backdrop_key: null,
    },
    providers: [
      {
        id: "kaleidescape",
        label: "Kaleidescape store",
        available: true,
        has_data: false,
        checked_at: null,
        fields: 0,
      },
      {
        id: "tmdb",
        label: "TMDB",
        available: true,
        supports_images: true,
        has_data: true,
        fetched_at: "2026-11-03T12:00:00+00:00",
        fields: 2,
      },
    ],
    artwork_enabled: true,
    field_mapping: [
      {
        field: "actors",
        label: "Cast",
        values: {
          original: ["Original Actor"],
          kaleidescape: ["Store Actor"],
          tmdb: ["TMDB Actor"],
        },
        selected: "tmdb",
        override: false,
      },
      {
        field: "synopsis",
        label: "Synopsis",
        values: {
          original: null,
          kaleidescape: null,
          tmdb: "A fictional voyage",
        },
        selected: "tmdb",
        override: false,
      },
    ],
  };
  element = document.createElement("kaleidescape-title-scrape") as TitleScrape;
  element.client = new FixtureTransport().client();
  element.scope = { ...info, library_enabled: true };
  element.versionId = "a".repeat(64);
  vi.spyOn(element.client, "titleScrapeOptions").mockImplementation(async () =>
    structuredClone(options),
  );
  vi.spyOn(element.client, "titleScrapeRefresh").mockResolvedValue({
    outcome: "staged",
    plan_id: review.plan_id,
    provider: "tmdb",
    has_data: true,
    matched: review.matched ?? null,
    values: { actors: ["TMDB Actor"] },
    images: review.images,
  });
  vi.spyOn(element.client, "titleScrapeRefreshChoice").mockResolvedValue({
    outcome: "staged",
    plan_id: review.plan_id,
    provider: "kaleidescape",
    has_data: true,
    matched: review.matched ?? null,
    values: {},
    images: [],
  });
  vi.spyOn(element.client, "titleScrapePreview").mockResolvedValue(review);
  vi.spyOn(element.client, "applyMetadataDraft").mockResolvedValue({
    title_id: element.versionId,
    updated_count: 1,
  });
  vi.spyOn(element.client, "titleScrapeImage").mockResolvedValue(
    new Blob(["fictional"], { type: "image/jpeg" }),
  );
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:fictional-preview");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  document.body.append(element);
  await flush();
});
afterEach(() => {
  element.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("keeps Save at the right and shows per-source download state", async () => {
  await open();
  expect(
    root().querySelector(".manager-actions")?.lastElementChild?.textContent,
  ).toContain("Save");
  expect(button("Inspect")).toBeUndefined();
  expect(button("Refresh")).toBeTruthy();
  expect(root().textContent).toContain("Not yet scanned");
  expect(root().textContent).toContain("Downloaded - Updated");
  expect(root().textContent).toContain("2 fields saved");
  expect(root().textContent).not.toContain("Edition");
  expect(root().textContent).toContain("Original Director");
});

it("shows Store quality badges in source history", async () => {
  options.history = [
    {
      provider: "kaleidescape",
      checked_at: "2026-11-03T12:00:00+00:00",
      outcome: "downloaded",
      values: {
        quality_badges: ["4K", "Dolby Atmos", "DTS:X"],
        quality_editions: ["4K · HDR10 · Dolby Atmos"],
      },
    },
  ];
  await open();
  button("History").click();
  await flush();
  const history = root().querySelector('[aria-label="Source history"]')!;
  expect(history.textContent).toContain("Quality badges");
  expect(history.textContent).toContain("Dolby Atmos");
  expect(history.textContent).toContain("DTS:X");
  expect(history.textContent).toContain("Quality editions");
  expect(history.textContent).toContain("4K · HDR10 · Dolby Atmos");
});

it("links each provider match to its public movie page", async () => {
  options.providers[0].match_url =
    "https://www.kaleidescape.com/movie-store/movie/fictional-voyage";
  options.providers[1].match_url = "https://www.themoviedb.org/movie/42";
  await open();
  const links = [
    ...root().querySelectorAll<HTMLAnchorElement>(".source-name a"),
  ];
  expect(links.map((link) => link.href)).toEqual([
    "https://www.kaleidescape.com/movie-store/movie/fictional-voyage",
    "https://www.themoviedb.org/movie/42",
  ]);
  expect(
    links.every(
      (link) => link.target === "_blank" && link.rel === "noopener noreferrer",
    ),
  ).toBe(true);
});

it("does not render a dangerous provider link", async () => {
  options.providers[0].match_url = "javascript:alert(1)";
  await open();
  expect(root().querySelector(".source-name a")).toBeNull();
});

it("refreshes a provider even when it already has cached metadata", async () => {
  await open();
  const refresh = [
    ...root().querySelectorAll<HTMLButtonElement>(".source-row button"),
  ].at(-1)!;
  refresh.click();
  await flush();
  expect(element.client!.titleScrapeRefresh).toHaveBeenCalledWith(
    element.scope,
    element.versionId,
    "tmdb",
    "Fictional Voyage",
    2025,
    true,
  );
  expect(element.client!.titleScrapePreview).not.toHaveBeenCalled();
  expect(element.client!.titleScrapeOptions).toHaveBeenCalledTimes(1);
  expect(element.client!.applyMetadataDraft).not.toHaveBeenCalled();
});

it("shows a separate match dialog and downloads the selected result", async () => {
  vi.mocked(element.client!.titleScrapeRefresh).mockResolvedValue({
    outcome: "matches",
    search_id: "12345678-1234-4234-9234-123456789abc",
    title: "Fictional Voyage",
    query: "Fictional Voyage",
    candidates: [match, { ...match, id: "match-1", title: "Other Voyage" }],
  });
  await open();
  root().querySelector<HTMLButtonElement>(".source-row button")!.click();
  await flush();
  expect(root().querySelector<HTMLDialogElement>(".choice-dialog")!.open).toBe(
    true,
  );
  expect(root().querySelector(".choice-dialog")!.textContent).toContain(
    "Current Library movie",
  );
  const matches = [
    ...root().querySelectorAll<HTMLButtonElement>(".match-card button"),
  ];
  matches[1].click();
  await flush();
  expect(element.client!.titleScrapeRefreshChoice).toHaveBeenCalledWith(
    element.scope,
    element.versionId,
    "kaleidescape",
    "12345678-1234-4234-9234-123456789abc",
    "match-1",
    true,
  );
});

it("always shows known fields and saves selected source columns", async () => {
  await open();
  button("Field Mapping").click();
  await flush();
  expect(root().querySelectorAll(".mapping-table tbody tr")).toHaveLength(2);
  expect(root().textContent).toContain("Raw Library");
  expect(root().textContent).toContain("Store Actor");
  const original = root().querySelector<HTMLInputElement>(
    'input[aria-label="Use Raw Library for Cast"]',
  )!;
  original.click();
  await flush();
  button("Save").click();
  await flush();
  expect(element.client!.applyMetadataDraft).toHaveBeenCalledOnce();
  const call = vi.mocked(element.client!.applyMetadataDraft).mock.calls[0][0];
  expect(call.message.type).toContain("metadata/title/draft");
  expect(call.message.data).toMatchObject({
    sources: { actors: "original" },
  });
});

it("offers TMDB image editing and an original-cover reset", async () => {
  await open();
  const edit = [
    ...root().querySelectorAll<HTMLButtonElement>(".image-links .text-link"),
  ].find((node) => node.textContent!.trim() === "Edit")!;
  edit.click();
  await flush();
  expect(element.client!.titleScrapePreview).toHaveBeenCalledWith(
    element.scope,
    element.versionId,
    "tmdb",
  );
  expect(root().querySelector<HTMLDialogElement>(".choice-dialog")!.open).toBe(
    true,
  );
  expect(root().textContent).toContain("Reset");
});

it("saves a selected TMDB cover without changing metadata fields", async () => {
  await open();
  const edit = [
    ...root().querySelectorAll<HTMLButtonElement>(".image-links .text-link"),
  ].find((node) => node.textContent!.trim() === "Edit")!;
  edit.click();
  await flush();
  root().querySelector<HTMLInputElement>('[name="artwork-choice"]')!.click();
  await flush();
  button("Use image").click();
  await flush();
  expect(element.client!.applyMetadataDraft).not.toHaveBeenCalled();
  button("Save").click();
  await flush();
  const call = vi.mocked(element.client!.applyMetadataDraft).mock.calls[0][0];
  expect(call.message.type).toContain("metadata/title/draft");
  expect(call.message.data).toMatchObject({
    images: { poster: "poster-0" },
  });
});

it("resets the original cover through a snapshot-checked action", async () => {
  await open();
  button("Reset").click();
  await flush();
  expect(element.client!.applyMetadataDraft).not.toHaveBeenCalled();
  button("Save").click();
  await flush();
  const call = vi.mocked(element.client!.applyMetadataDraft).mock.calls[0][0];
  expect(call.message.type).toContain("metadata/title/draft");
  expect(call.message.data).toMatchObject({
    resets: ["poster"],
    title_id: element.versionId,
    snapshot: options.snapshot,
  });
});

it("saves changes immediately when auto-save is enabled", async () => {
  options.auto_save = true;
  await open();
  expect(button("Save")).toBeUndefined();
  expect(root().querySelector(".inset-dialog > .manager-actions")).toBeNull();
  button("Reset").click();
  await flush();
  expect(element.client!.applyMetadataDraft).toHaveBeenCalledOnce();
});

it("suggests removing the year when refresh finds no data", async () => {
  vi.mocked(element.client!.titleScrapeRefresh).mockResolvedValue({
    outcome: "staged",
    plan_id: review.plan_id,
    provider: "tmdb",
    has_data: false,
    matched: null,
    values: {},
    images: [],
  });
  await open();
  [...root().querySelectorAll<HTMLButtonElement>(".source-row button")]
    .at(-1)!
    .click();
  await flush();
  const tmdb = root().querySelector('[data-provider="tmdb"]')!;
  const store = root().querySelector('[data-provider="kaleidescape"]')!;
  expect(tmdb.querySelector(".source-actions")!.textContent).toContain(
    "Try again with no year",
  );
  expect(store.textContent).not.toContain("Try again with no year");
  expect(element.client!.applyMetadataDraft).not.toHaveBeenCalled();
});
