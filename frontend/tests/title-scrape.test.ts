/** Simulated review dialogs with fictional metadata; no real browser/provider. */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import "../src/enrichment/title-scrape";
import type { TitleScrape } from "../src/enrichment/title-scrape";
import { ApiError } from "../src/core/api";
import type { ScrapeReview } from "../src/core/api";
import { FixtureTransport, info } from "./fixture";

let element: TitleScrape;
const review: ScrapeReview = {
  plan_id: "12345678-1234-4234-9234-123456789abc",
  title: "Fictional Voyage",
  fields: {
    actors: {
      before: ["Original Example"],
      after: ["<script>Lead Example</script>", "Supporting Example"],
    },
    directors: { before: [], after: ["Director Example"] },
  },
  images: Array.from({ length: 8 }, (_, index) => ({
    id: `poster-${index}`,
    kind: "poster",
    width: 500,
    height: 750,
  })),
  artwork_enabled: true,
};
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
async function scrape() {
  await open();
  root().querySelector<HTMLButtonElement>(".dialog-footer .primary")!.click();
  await flush();
}
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
  element = document.createElement("kaleidescape-title-scrape") as TitleScrape;
  element.client = new FixtureTransport().client();
  element.scope = { ...info, library_enabled: true };
  element.versionId = "a".repeat(64);
  vi.spyOn(element.client, "titleScrapeOptions").mockResolvedValue({
    providers: [{ id: "tmdb", label: "TMDB", available: true }],
    artwork_enabled: true,
  });
  vi.spyOn(element.client, "titleScrapePreview").mockResolvedValue(
    structuredClone(review),
  );
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

it("prefills the cleaned search title and shows current Library credits for comparison", async () => {
  vi.mocked(element.client!.titleScrapeOptions).mockResolvedValue({
    title: "Fictional Voyage (Director's Cut)",
    search_title: "Fictional Voyage",
    current: {
      title: "Fictional Voyage (Director's Cut)",
      year: 2025,
      directors: ["Example Director"],
      actors: ["Lead Example", "Supporting Example"],
    },
    providers: [{ id: "tmdb", label: "TMDB", available: true }],
    artwork_enabled: true,
  });
  await open();
  expect(
    root().querySelector<HTMLInputElement>('[name="scraper_query"]')!.value,
  ).toBe("Fictional Voyage");
  const current = root().querySelector(".current-movie")!;
  expect(current.textContent).toContain("Fictional Voyage (Director's Cut)");
  expect(current.textContent).toContain("2025");
  expect(current.textContent).toContain("Example Director");
  expect(current.textContent).toContain("Lead Example, Supporting Example");
});

it.each([false, true])(
  "saves a provider no-data flag with exact retry (previously marked: %s)",
  async (marked) => {
    vi.mocked(element.client!.titleScrapeOptions).mockResolvedValue({
      snapshot: "b".repeat(64),
      providers: [
        {
          id: "tmdb",
          label: "TMDB",
          available: true,
          unavailable: marked,
          missing_data: false,
        },
      ],
      artwork_enabled: true,
    });
    const apply = vi
      .spyOn(element.client!, "applyTitleScrape")
      .mockRejectedValueOnce(new ApiError("connection_lost"))
      .mockResolvedValue({ title_id: element.versionId, updated_count: 2 });
    await open();
    button(
      marked ? "Clear no-data flag" : "Mark no scraper data available",
    ).click();
    await flush();
    const pending = apply.mock.calls[0][0];
    expect(pending.message.type).toContain("metadata/title/availability");
    expect(pending.message.data).toEqual({
      title_id: element.versionId,
      provider: "tmdb",
      snapshot: "b".repeat(64),
      unavailable: !marked,
    });
    expect(
      root().querySelector<HTMLButtonElement>(".dialog-close")!.disabled,
    ).toBe(false);
    button("Retry exact apply").click();
    await flush();
    expect(apply.mock.calls[1][0]).toBe(pending);
    expect(root().querySelector<HTMLDialogElement>("dialog")!.open).toBe(false);
    expect(element.client!.titleScrapePreview).not.toHaveBeenCalled();
  },
);

it.each([false, true])(
  "defaults a missing backdrop only (existing: %s)",
  async (existing) => {
    vi.mocked(element.client!.titleScrapePreview).mockResolvedValue({
      ...structuredClone(review),
      has_backdrop: existing,
      images: [
        ...review.images,
        { id: "backdrop-1", kind: "backdrop", width: 780, height: 439 },
      ],
    });
    const prepare = vi.spyOn(element.client!, "prepareTitleScrape");
    await scrape();
    button("Backdrop (1)").click();
    await flush();
    expect(
      root().querySelector<HTMLInputElement>(".candidate input")!.checked,
    ).toBe(!existing);
    button("Apply selected data").click();
    await flush();
    expect(prepare.mock.calls[0][1].images).toEqual(
      existing ? {} : { backdrop: "backdrop-1" },
    );
  },
);

it("opens a TMDB image-only review without selecting metadata", async () => {
  element.artworkOnly = true;
  await flush();
  const prepare = vi.spyOn(element.client!, "prepareTitleScrape");
  await open();
  expect(element.client!.titleScrapePreview).toHaveBeenCalled();
  expect(root().querySelector(".scrape-fields")).toBeNull();
  expect(root().textContent).not.toContain("Metadata (2)");
  expect(button("Apply images").disabled).toBe(true);
  root().querySelector<HTMLInputElement>(".candidate input")!.click();
  await flush();
  button("Apply images").click();
  await flush();
  expect(prepare.mock.calls[0][1].fields).toEqual([]);
  expect(prepare.mock.calls[0][1].images).toEqual({ poster: "poster-0" });
});

it("does not fetch image choices without the artwork opt-in", async () => {
  element.artworkOnly = true;
  vi.mocked(element.client!.titleScrapeOptions).mockResolvedValue({
    providers: [{ id: "tmdb", label: "TMDB", available: true }],
    artwork_enabled: false,
  });
  await flush();
  await open();
  expect(element.client!.titleScrapePreview).not.toHaveBeenCalled();
  expect(root().textContent).toContain("Enable Sync artwork");
  expect(
    root().querySelector<HTMLButtonElement>(".dialog-footer .primary")!
      .disabled,
  ).toBe(true);
});

it("reviews fields and paged images, then retries the exact selected apply", async () => {
  const apply = vi
    .spyOn(element.client!, "applyTitleScrape")
    .mockRejectedValueOnce(new ApiError("connection_lost"))
    .mockResolvedValue({ title_id: element.versionId, updated_count: 2 });
  const changed = vi.fn();
  element.addEventListener("metadata-changed", changed);
  await scrape();
  expect(root().querySelector("script")).toBeNull();
  expect(root().textContent).toContain("<script>Lead Example</script>");
  const rows = [...root().querySelectorAll(".scrape-field")];
  rows
    .find((row) => row.textContent!.includes("Directors"))!
    .querySelector<HTMLInputElement>("input")!
    .click();
  button("Poster (8)").click();
  await flush();
  expect(root().querySelectorAll(".candidate")).toHaveLength(6);
  button("Next images").click();
  await flush();
  expect(root().querySelectorAll(".candidate")).toHaveLength(2);
  root().querySelectorAll<HTMLInputElement>(".candidate input")[1].click();
  await flush();
  button("Apply selected data").click();
  await flush();
  const pending = apply.mock.calls[0][0];
  expect(pending.message.data).toEqual({
    plan_id: review.plan_id,
    fields: ["actors"],
    images: { poster: "poster-7" },
  });
  expect(
    root().querySelector<HTMLButtonElement>(".dialog-close")!.disabled,
  ).toBe(false);
  button("Retry exact apply").click();
  await flush();
  expect(apply.mock.calls[1][0]).toBe(pending);
  expect(changed).toHaveBeenCalledTimes(1);
  expect(root().querySelector<HTMLDialogElement>("dialog")!.open).toBe(false);
  expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:fictional-preview");
});

it("ignores a late readonly preview after closing and hides actions from readers", async () => {
  let resolve!: (value: ScrapeReview) => void;
  vi.mocked(element.client!.titleScrapePreview).mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  await open();
  root().querySelector<HTMLButtonElement>(".dialog-footer .primary")!.click();
  await flush();
  root().querySelector<HTMLButtonElement>(".dialog-close")!.click();
  await flush();
  resolve(structuredClone(review));
  await flush();
  expect(root().querySelector(".scrape-fields")).toBeNull();
  expect(root().querySelector<HTMLDialogElement>("dialog")!.open).toBe(false);
  element.scope = {
    ...info,
    library_enabled: true,
    permissions: { read: true, edit: false, export: false },
  };
  await flush();
  expect(root().querySelector("button")).toBeNull();
});

it("keeps image downloads lazy and clears private selections on account changes", async () => {
  await scrape();
  expect(element.client!.titleScrapeImage).not.toHaveBeenCalled();
  button("Poster (8)").click();
  await flush();
  expect(element.client!.titleScrapeImage).toHaveBeenCalled();
  element.client = new FixtureTransport().client();
  await flush();
  expect(root().querySelector(".scrape-fields")).toBeNull();
  expect(root().querySelector("kaleidescape-scrape-image")).toBeNull();
  expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:fictional-preview");
});

it("shows only enabled providers and makes unavailable providers unselectable", async () => {
  vi.mocked(element.client!.titleScrapeOptions).mockResolvedValue({
    providers: [{ id: "tmdb", label: "TMDB", available: false }],
    artwork_enabled: false,
  });
  await open();
  expect(root().textContent).not.toContain("Kaleidescape store");
  expect(
    root().querySelector<HTMLOptionElement>('option[value="tmdb"]')!.disabled,
  ).toBe(true);
  expect(
    root().querySelector<HTMLButtonElement>(".dialog-footer .primary")!
      .disabled,
  ).toBe(true);
});

it("marks scrapers without saved data while leaving configured scrapers selectable", async () => {
  vi.mocked(element.client!.titleScrapeOptions).mockResolvedValue({
    providers: [
      { id: "tmdb", label: "TMDB", available: true, missing_data: true },
      {
        id: "kaleidescape",
        label: "Kaleidescape store",
        available: true,
        missing_data: false,
      },
    ],
    artwork_enabled: false,
  });
  await open();
  const missing = root().querySelector<HTMLOptionElement>(
    'option[value="tmdb"]',
  )!;
  expect(missing.textContent).toContain("TMDB ⚠");
  expect(missing.getAttribute("aria-label")).toContain("no saved data");
  expect(missing.disabled).toBe(false);
  expect(
    root().querySelector<HTMLOptionElement>('option[value="kaleidescape"]')!
      .textContent,
  ).not.toContain("⚠");
  expect(
    root().querySelector<HTMLButtonElement>(".dialog-footer .primary")!
      .disabled,
  ).toBe(false);
});

it("offers detailed candidates, permits a replacement title search, and saves the chosen match", async () => {
  const choices = {
    search_id: "12345678-1234-4234-9234-123456789abc",
    title: "Fictional Voyage",
    query: "Voyage",
    candidates: [
      {
        id: "match-0",
        title: "Fictional Voyage",
        year: 2025,
        actors: ["Lead Example", "Second Example", "Third Example"],
        directors: ["Director Example"],
        genres: ["Adventure"],
        has_artwork: true,
      },
    ],
  };
  vi.mocked(element.client!.titleScrapePreview)
    .mockResolvedValueOnce(choices)
    .mockResolvedValue({
      ...review,
      matched: { title: "Fictional Voyage", year: 2025 },
    });
  const search = vi
    .spyOn(element.client!, "titleScrapeSearch")
    .mockResolvedValueOnce({ ...choices, candidates: [] })
    .mockResolvedValue(choices);
  const apply = vi
    .spyOn(element.client!, "applyTitleScrape")
    .mockResolvedValue({ title_id: element.versionId, updated_count: 1 });
  await scrape();
  expect(root().querySelectorAll(".match-card")).toHaveLength(1);
  expect(root().textContent).toContain("Director Example");
  expect(root().textContent).toContain("Third Example");
  expect(root().textContent).toContain("Adventure");
  expect(root().querySelector("kaleidescape-scrape-image")).toBeTruthy();
  const input = root().querySelector<HTMLInputElement>(
    '[name="scraper_query"]',
  )!;
  input.value = "Alternate title";
  input.dispatchEvent(new Event("input", { bubbles: true }));
  button("Search titles").click();
  await flush();
  expect(search.mock.calls[0].at(-1)).toBe("Alternate title");
  expect(root().textContent).toContain("No matching movies found");
  button("Search titles").click();
  await flush();
  button("Use this match").click();
  await flush();
  expect(
    vi.mocked(element.client!.titleScrapePreview).mock.calls.at(-1)!.slice(-2),
  ).toEqual([choices.search_id, "match-0"]);
  expect(root().textContent).toContain("This source choice will be saved");
  button("Clear fields").click();
  await flush();
  button("Save match").click();
  await flush();
  expect(apply.mock.calls[0][0].message.data).toMatchObject({
    fields: [],
    images: {},
    save_match: true,
  });
});

it.each([false, true])(
  "allows close during an outstanding apply or uncertain retry (reply rejected: %s)",
  async (rejected) => {
    const cancel = vi
      .spyOn(element.client!, "cancelTitleScrape")
      .mockResolvedValue({ cancelled: true });
    let done!: (value: { title_id: string; updated_count: number }) => void;
    const apply = vi.spyOn(element.client!, "applyTitleScrape");
    if (rejected) apply.mockRejectedValue(new ApiError("connection_lost"));
    else
      apply.mockReturnValue(
        new Promise((resolve) => {
          done = resolve;
        }),
      );
    const changed = vi.fn();
    element.addEventListener("metadata-changed", changed);
    await scrape();
    button("Apply selected data").click();
    await flush();
    const close = root().querySelector<HTMLButtonElement>(".dialog-close")!;
    expect(close.disabled).toBe(false);
    close.click();
    await flush();
    expect(root().querySelector<HTMLDialogElement>("dialog")!.open).toBe(false);
    expect(cancel).toHaveBeenCalledWith(element.scope, review.plan_id);
    expect(root().textContent).not.toContain("Retry exact apply");
    if (!rejected) {
      done({ title_id: element.versionId, updated_count: 1 });
      await flush();
    }
    expect(changed).not.toHaveBeenCalled();
    expect(apply).toHaveBeenCalledTimes(1);
  },
);

it("reports a provider rejection as a confirmed error and releases the apply selection", async () => {
  vi.spyOn(element.client!, "applyTitleScrape").mockRejectedValue(
    new ApiError("provider_content_type"),
  );
  await scrape();
  button("Apply selected data").click();
  await flush();
  expect(root().textContent).toContain("unsupported content type");
  expect(root().textContent).not.toContain("Retry exact apply");
  expect(
    root().querySelector<HTMLButtonElement>(".dialog-close")!.disabled,
  ).toBe(false);
});
