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
  button("Artwork (8)").click();
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
  ).toBe(true);
  const cancel = new Event("cancel", { cancelable: true });
  root().querySelector("dialog")!.dispatchEvent(cancel);
  expect(cancel.defaultPrevented).toBe(true);
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
  button("Artwork (8)").click();
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
