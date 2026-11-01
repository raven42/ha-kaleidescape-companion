/** Component/API simulations only; rendered device layout is reviewed by the operator. */
import { afterEach, expect, it, vi } from "vitest";
import "../src/library/title-edit";
import "../src/library/library";
import type { TitleEdit } from "../src/library/title-edit";
import type { KaleidescapeLibrary } from "../src/library/library";
import { ApiError } from "../src/core/api";
import type { LibraryEdit, PreparedMutation } from "../src/core/api";
import { FixtureTransport, info } from "./fixture";
import { ratingScores } from "../src/enrichment/ratings";
import { calendarDays } from "../src/ui/journal-calendar";
import { record, libraryTitle } from "./fixture";

let element: TitleEdit | KaleidescapeLibrary;
afterEach(() => {
  element?.remove();
  vi.restoreAllMocks();
});
const review: LibraryEdit = {
  snapshot: "a".repeat(64),
  version_count: 2,
  values: {
    title: "Fictional Film",
    sort_title: null,
    year: 2025,
    rating: "PG",
    synopsis: "A story.",
    actors: ["Lead Example"],
    directors: [],
    writers: [],
    producers: [],
    studios: [],
    genres: [],
  },
};
const button = (root: ShadowRoot, label: string) =>
  [...root.querySelectorAll<HTMLButtonElement>("button")].find(
    (item) => item.textContent!.trim() === label,
  )!;
async function editor() {
  const client = new FixtureTransport().client();
  vi.spyOn(client, "libraryEdit").mockResolvedValue(review);
  element = document.createElement("kaleidescape-title-edit") as TitleEdit;
  element.client = client;
  element.scope = { ...info, library_enabled: true };
  element.versionId = "a".repeat(64);
  document.body.append(element);
  await element.updateComplete;
  button(element.shadowRoot!, "Edit details").click();
  await vi.waitFor(() =>
    expect(element.shadowRoot!.querySelector('[name="title"]')).toBeTruthy(),
  );
  return { client, root: element.shadowRoot! };
}
it("restricts editing to display fields, locks drafts, and retries exactly after an uncertain save", async () => {
  const { client, root } = await editor();
  expect(root.querySelector('[name="id"]')).toBeNull();
  const sort = root.querySelector<HTMLInputElement>('[name="sort_title"]')!;
  sort.value = "Fictional Film, The";
  sort.dispatchEvent(new Event("input", { bubbles: true }));
  const save = vi
    .spyOn(client, "saveLibraryEdit")
    .mockRejectedValueOnce(new ApiError("transport_error"))
    .mockResolvedValue({ title_id: "a".repeat(64), updated_count: 2 });
  await element.updateComplete;
  button(root, "Save changes").click();
  await vi.waitFor(() => expect(button(root, "Retry exact save")).toBeTruthy());
  expect(
    root.querySelector<HTMLButtonElement>('[aria-label="Close"]')!.disabled,
  ).toBe(true);
  expect(save.mock.calls[0][0].message.patch).toEqual({
    sort_title: "Fictional Film, The",
  });
  button(root, "Retry exact save").click();
  await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(2));
  expect(save.mock.calls[1][0]).toBe(save.mock.calls[0][0]);
  await vi.waitFor(() =>
    expect(root.querySelector<HTMLDialogElement>("dialog")!.open).toBe(false),
  );
});
it("offers a confirmed source restore and never exposes the editor to readers", async () => {
  const { client, root } = await editor();
  const save = vi
    .spyOn(client, "saveLibraryEdit")
    .mockResolvedValue({ title_id: "a".repeat(64), updated_count: 2 });
  button(root, "Restore original metadata…").click();
  await element.updateComplete;
  expect(root.textContent).toContain("Background scraping stays paused");
  expect(root.querySelector('[name="title"]')).toBeNull();
  button(root, "Restore original metadata").click();
  await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(1));
  const pending = save.mock.calls[0][0] as PreparedMutation;
  expect(pending.message.type).toMatch(/library\/edit\/reset$/);
  expect(pending.message.confirmation).toBe("RESTORE SOURCE");
  element.scope = {
    ...info,
    permissions: { read: true, edit: false, export: false },
  };
  await element.updateComplete;
  expect(root.querySelector("button")).toBeNull();
});
it("loads current movie details independently of a list revision changed by scraping", async () => {
  const transport = new FixtureTransport(),
    client = transport.client();
  const versions = vi.spyOn(client, "libraryVersions");
  element = document.createElement(
    "kaleidescape-library",
  ) as KaleidescapeLibrary;
  element.client = client;
  element.scope = { ...info, library_enabled: true };
  document.body.append(element);
  await vi.waitFor(() =>
    expect(element.shadowRoot!.querySelector("tbody .link")).toBeTruthy(),
  );
  transport.revision++;
  element.shadowRoot!.querySelector<HTMLButtonElement>("tbody .link")!.click();
  await vi.waitFor(() => expect(versions).toHaveBeenCalled());
  expect(versions.mock.calls.at(-1)![3]).toBeUndefined();
  await vi.waitFor(() =>
    expect(
      element.shadowRoot!.querySelector(".movie-synopsis")?.textContent,
    ).toContain("fictional"),
  );
  expect(element.shadowRoot!.textContent).not.toContain("The journal changed");
});
it("keeps source-specific score scales, including zero, and hides unavailable scores", () => {
  const row = libraryTitle({
    enrichment: {
      tmdb: {
        provider: "tmdb",
        provider_id: "1",
        url: "",
        fetched_at: "",
        audience_rating: 8.25,
      },
      kaleidescape: {
        provider: "kaleidescape",
        provider_id: "1",
        url: "",
        fetched_at: "",
        critic_score: 96,
        audience_score: 0,
      },
    },
  });
  expect(ratingScores(row).map((item) => item.value)).toEqual([8.25, 96, 0]);
  expect(ratingScores(libraryTitle())).toEqual([]);
});
it("marks start/completion endpoints across months while same-day and partial viewings stay whole", () => {
  const row = record({
    started_at: new Date(2026, 9, 31, 23).toISOString(),
    ended_at: new Date(2026, 10, 1, 1).toISOString(),
  });
  expect(calendarDays(row)).toEqual([
    { day: "2026-10-31", phase: "start" },
    { day: "2026-11-01", phase: "completion" },
  ]);
  expect(calendarDays({ ...row, status: "partial" })).toEqual([
    { day: "2026-10-31", phase: "single" },
  ]);
  expect(
    calendarDays(
      record({
        started_at: new Date(2026, 9, 31, 19).toISOString(),
        ended_at: new Date(2026, 9, 31, 21).toISOString(),
      }),
    ),
  ).toEqual([{ day: "2026-10-31", phase: "single" }]);
});

it("switches display profiles after resizing without moving a pending write to another profile", async () => {
  const descriptor = Object.getOwnPropertyDescriptor(window, "innerWidth")!;
  const width = (value: number) =>
    Object.defineProperty(window, "innerWidth", { configurable: true, value });
  try {
    width(1400);
    const transport = new FixtureTransport(),
      client = transport.client();
    const original = client.uiPreferences.bind(client);
    const reads = vi
      .spyOn(client, "uiPreferences")
      .mockImplementation(async (scope, shared, area, profile) => {
        const result = await original(scope, shared, area, profile);
        return !shared && (area ?? "library") === "library"
          ? {
              ...result,
              values: {
                ...result.values,
                view: profile === "mobile" ? "list" : "covers",
                cover_size: profile === "mobile" ? 100 : 220,
              },
            }
          : result;
      });
    element = document.createElement(
      "kaleidescape-library",
    ) as KaleidescapeLibrary;
    element.client = client;
    element.scope = { ...info, library_enabled: true };
    document.body.append(element);
    await vi.waitFor(() =>
      expect(element.shadowRoot!.querySelector(".cover-grid")).toBeTruthy(),
    );
    width(400);
    window.dispatchEvent(new Event("resize"));
    await vi.waitFor(() =>
      expect(element.shadowRoot!.querySelector(".library-table")).toBeTruthy(),
    );
    expect(reads.mock.calls.some((call) => call[3] === "desktop")).toBe(true);
    expect(reads.mock.calls.some((call) => call[3] === "mobile")).toBe(true);
    element
      .shadowRoot!.querySelector<HTMLInputElement>('[name="show_titles"]')!
      .click();
    await vi.waitFor(() =>
      expect(
        transport.calls.some(
          (call) =>
            call.type.endsWith("ui/preferences/update") &&
            call.profile === "mobile",
        ),
      ).toBe(true),
    );
  } finally {
    element?.remove();
    Object.defineProperty(window, "innerWidth", descriptor);
  }
});
it("keeps scraper progress administrator-only in the Library footer", async () => {
  const transport = new FixtureTransport(),
    client = transport.client();
  const original = client.libraryInfo.bind(client);
  vi.spyOn(client, "libraryInfo").mockImplementation(async (scope) => ({
    ...(await original(scope)),
    metadata: {
      enabled: true,
      cached_groups: 101,
      running: true,
      active: 1,
      queued: 8,
      processed: 2,
      total: 11,
      updated: 3,
      skipped: 1,
      error: null,
      last_finished: null,
    },
  }));
  element = document.createElement(
    "kaleidescape-library",
  ) as KaleidescapeLibrary;
  element.client = client;
  element.scope = { ...info, library_enabled: true };
  document.body.append(element);
  await vi.waitFor(() =>
    expect(
      element.shadowRoot!.querySelector(".scraper-status")?.textContent,
    ).toContain("Scrapers running · 2/11 · 101 scraped"),
  );
  element.scope = {
    ...info,
    library_enabled: true,
    permissions: { read: true, edit: false, export: false },
  };
  await vi.waitFor(() =>
    expect(element.shadowRoot!.querySelector(".scraper-status")).toBeNull(),
  );
});
