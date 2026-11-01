/** Offline component simulations; actual responsive layout is operator-reviewed. */
import { afterEach, expect, it, vi } from "vitest";
import { render } from "lit";
import { renderRatings } from "../src/enrichment/ratings";
import { EnrichmentSettings } from "../src/enrichment/settings";
import { SOURCE_FIELDS } from "../src/enrichment/sources";
import "../src/library/library";
import type { KaleidescapeLibrary } from "../src/library/library";
import { FixtureTransport, info, libraryTitle } from "./fixture";

let element: HTMLElement | undefined;
afterEach(() => {
  element?.remove();
  vi.restoreAllMocks();
});

it("renders a percentage gauge and standard RT icons without remote assets or certification claims", () => {
  element = document.createElement("div");
  document.body.append(element);
  const ratings = (critic: number, audience: number) =>
    libraryTitle({
      ratings: {
        audience_rating: 6.7,
        critic_score: critic,
        audience_score: audience,
      },
    });
  render(renderRatings(ratings(81, 88)), element);
  expect(element.querySelector(".score-ring text")?.textContent).toContain(
    "67",
  );
  expect(element.querySelector(".movie-ratings")?.getAttribute("slot")).toBe(
    "collection",
  );
  const images = [...element.querySelectorAll("img")].map((image) => image.src);
  expect(images).toHaveLength(2);
  expect(images.every((src) => src.startsWith("data:image/svg+xml"))).toBe(
    true,
  );
  expect(element.textContent).not.toMatch(/certified|verified/i);
  render(renderRatings(ratings(59, 0)), element);
  expect(element.querySelector(".score-audience")?.textContent).toContain("0%");
  expect(
    [...element.querySelectorAll("img")].map((image) => image.src),
  ).not.toEqual(images);
  // An explicit null projection must not resurrect a cached provider score.
  render(
    renderRatings(
      libraryTitle({
        ratings: { audience_rating: null },
        enrichment: {
          tmdb: {
            provider: "tmdb",
            provider_id: "42",
            fetched_at: "",
            url: "",
            audience_rating: 8,
          },
        },
      }),
    ),
    element,
  );
  expect(element.querySelector(".movie-ratings")).toBeNull();
});

it("offers independent source choices plus a preset without enabling a scraper", async () => {
  const settings = new EnrichmentSettings();
  element = settings;
  settings.scope = { ...info, library_enabled: true };
  settings.draft = {
    metadata_tmdb_enabled: true,
    metadata_store_enabled: true,
  };
  const patches: Record<string, unknown>[] = [];
  settings.addEventListener("metadata-settings", (event) =>
    patches.push((event as CustomEvent).detail),
  );
  document.body.append(settings);
  await settings.updateComplete;
  const root = settings.shadowRoot!;
  expect(root.querySelectorAll(".field-sources select")).toHaveLength(
    SOURCE_FIELDS.length,
  );
  const preset = [...root.querySelectorAll("button")].find((button) =>
    button.textContent!.includes("Prefer TMDB"),
  )!;
  preset.click();
  expect(patches[0]).toMatchObject({
    metadata_source_actors: "tmdb",
    metadata_source_artwork: "kaleidescape",
    metadata_source_critic_score: "kaleidescape",
  });
  expect(patches[0]).not.toHaveProperty("metadata_tmdb_enabled");
  const artwork = root.querySelector<HTMLSelectElement>(
    '[name="metadata_source_artwork"]',
  )!;
  expect([...artwork.options].map((option) => option.value)).toEqual([
    "auto",
    "original",
    "kaleidescape",
    "tmdb",
  ]);
  artwork.value = "tmdb";
  artwork.dispatchEvent(new Event("change", { bubbles: true }));
  expect(patches[1]).toEqual({ metadata_source_artwork: "tmdb" });
});

it("defaults to the first quality-ranked version rather than the summary row and preserves an explicit selection", async () => {
  const transport = new FixtureTransport(),
    client = transport.client();
  const lower = libraryTitle({
    edition: "HD",
    rating: "PG",
    collections: ["Family"],
    synopsis: "Lower-quality version",
  });
  const highest = libraryTitle({
    id: "b".repeat(64),
    edition: "4K Cinematic",
    rating: "R",
    collections: ["Favorites"],
    synopsis: "Highest-quality version",
  });
  transport.libraryTitles = [lower, highest];
  transport.libraryGroups.set(lower.id, "fictional-work");
  transport.libraryGroups.set(highest.id, "fictional-work");
  const versions = vi.spyOn(client, "libraryVersions").mockResolvedValue({
    items: [highest, lower],
    total: 2,
    offset: 0,
    has_more: false,
    revision: 1,
  });
  const library = document.createElement(
    "kaleidescape-library",
  ) as KaleidescapeLibrary;
  element = library;
  library.client = client;
  library.scope = { ...info, library_enabled: true };
  document.body.append(library);
  const root = library.shadowRoot!;
  await vi.waitFor(() =>
    expect(root.querySelector("tbody .link")).toBeTruthy(),
  );
  root.querySelector<HTMLButtonElement>("tbody .link")!.click();
  await vi.waitFor(() =>
    expect(root.querySelector(".movie-synopsis")?.textContent).toContain(
      "Highest-quality",
    ),
  );
  root.querySelectorAll<HTMLButtonElement>('[role="tab"]')[1].click();
  await library.updateComplete;
  expect(root.querySelector(".movie-synopsis")?.textContent).toContain(
    "Lower-quality",
  );
  expect(root.querySelector(".movie-description .detail-badges")).toBeNull();
  expect(root.querySelector(".movie-heading-badges .format-hd")).toBeTruthy();
  expect(
    root.querySelector(".movie-heading-badges .format-cinematic"),
  ).toBeTruthy();
  expect(
    [...root.querySelectorAll(".movie-heading-badges .rating-badge")].map(
      (badge) => badge.textContent!.trim(),
    ),
  ).toEqual(["PG", "R"]);
  expect(
    [...root.querySelectorAll(".movie-heading-badges .collection-badge")].map(
      (badge) => badge.textContent!.trim(),
    ),
  ).toEqual(["Family", "Favorites"]);
  expect(root.querySelector(".movie-version-count")).toBeNull();
  expect(root.querySelector(".movie-intro")!.textContent).not.toContain(
    "2 versions",
  );
  expect(root.querySelector(".version-format-badges .format-hd")).toBeTruthy();
  expect(root.querySelector(".version-format-badges .rating-badge")).toBeNull();
  expect(
    root.querySelector(".movie-heading-badges .rating-badge"),
  ).toBeTruthy();
  root
    .querySelector("kaleidescape-title-edit")!
    .dispatchEvent(new CustomEvent("metadata-changed"));
  await vi.waitFor(() => expect(versions).toHaveBeenCalledTimes(2));
  await vi.waitFor(() =>
    expect(root.querySelector(".movie-synopsis")?.textContent).toContain(
      "Lower-quality",
    ),
  );
  expect(root.querySelectorAll(".library-footer")).toHaveLength(1);
  expect(root.querySelector(".library-status")).toBeNull();
  expect(
    [...root.querySelectorAll(".library-footer button")].some(
      (button) => button.textContent!.trim() === "Next",
    ),
  ).toBe(false);
  root
    .querySelector<HTMLButtonElement>(
      '.collection-badge[aria-label="Filter by collection: Family"]',
    )!
    .click();
  await vi.waitFor(() =>
    expect(root.querySelector<HTMLDialogElement>("#title-dialog")!.open).toBe(
      false,
    ),
  );
  expect(
    transport.calls.filter((call) => call.type.endsWith("/library/list")).at(-1)
      ?.filters,
  ).toMatchObject({ query: "", collection: ["Family"] });
});
