/** Local collection symbols preserve filter actions and inert custom labels. */
import { expect, it, vi } from "vitest";
import { render } from "lit";
import {
  renderCollectionBadge,
  renderStatusBadges,
} from "../src/library/badges";
import { libraryTitle } from "./fixture";

it("renders themed collection pills and retains the original filter action", () => {
  const host = document.createElement("div");
  const choose = vi.fn();
  const values = [
    "All",
    "New",
    "Unwatched",
    "Played",
    "Favorites",
    "In progress",
  ];
  render(
    values.map((value) => renderCollectionBadge(value, () => choose(value))),
    host,
  );
  expect(
    [...host.querySelectorAll("button")].map((button) => button.className),
  ).toEqual([
    "collection-badge collection-all",
    "collection-badge collection-new",
    "collection-badge collection-unwatched",
    "collection-badge collection-watched",
    "collection-badge collection-favorite",
    "collection-badge collection-progress",
  ]);
  expect(host.querySelectorAll('svg[aria-hidden="true"]')).toHaveLength(6);
  host
    .querySelector<HTMLButtonElement>(
      '[aria-label="Filter by collection: Watched"]',
    )!
    .click();
  expect(choose).toHaveBeenCalledWith("Played");
  render(renderCollectionBadge("<script>custom</script>", choose, true), host);
  expect(host.querySelector("script")).toBeNull();
  expect(host.textContent).toContain("<script>custom</script>");
  expect(host.querySelector("button")!.disabled).toBe(true);
});

it("renders the Watch Soon flag as an accessible corner clock", () => {
  const host = document.createElement("div");
  render(
    renderStatusBadges(
      libraryTitle({
        collections: ["WatchSoon"],
        watched_status: "none",
        movie_statuses: [],
      }),
      true,
    ),
    host,
  );
  const badge = host.querySelector('.cover-flag.flag-watch-soon[role="img"]')!;
  expect(badge.getAttribute("aria-label")).toBe("Watch Soon");
  expect(badge.querySelector("svg circle")).not.toBeNull();
  expect(host.querySelectorAll(".cover-flag")).toHaveLength(1);
});

it("prioritizes cover statuses and shows a recently added edge behind them", () => {
  const host = document.createElement("div");
  for (const [statuses, watchSoon, recent, expected] of [
    [["in_progress", "watched"], true, true, "In progress"],
    [["watched"], true, true, "Watched"],
    [["unwatched"], true, true, "Watch Soon"],
    [["unwatched"], false, true, "Recently Added"],
    [["watched"], false, false, "Watched"],
    [[], false, false, null],
  ] as const) {
    render(
      renderStatusBadges(
        libraryTitle({
          movie_statuses: [...statuses],
          is_watch_soon: watchSoon,
          is_recently_added: recent,
          is_favorite: true,
        }),
        true,
      ),
      host,
    );
    const corner = [
      ...host.querySelectorAll(".cover-flag:not(.flag-favorite)"),
    ];
    expect(corner.map((badge) => badge.getAttribute("aria-label"))).toEqual(
      expected ? [expected] : [],
    );
    expect(host.querySelectorAll(".flag-favorite")).toHaveLength(1);
    const edge = host.querySelector<HTMLElement>(".cover-recent-edge");
    expect(!!edge).toBe(recent && expected !== "Recently Added");
    if (edge) {
      expect(edge.getAttribute("aria-label")).toBe("Recently Added");
      expect(edge.getAttribute("role")).toBe("img");
      expect(edge.nextElementSibling).toBe(corner[0]);
    }
    if (expected === "Recently Added") {
      expect(
        corner[0].querySelectorAll('svg[aria-hidden="true"] path'),
      ).toHaveLength(3);
      expect(corner[0].getAttribute("title")).toBe("Recently Added");
    }
  }
  render(
    renderStatusBadges(
      libraryTitle({ movie_statuses: ["watched"], is_recently_added: true }),
      true,
      ["recent"],
    ),
    host,
  );
  expect(host.querySelector(".cover-recent-edge")).toBeNull();
});

it("renders rectangular text labels for cover statuses and preserves all meanings", () => {
  const host = document.createElement("div");
  const row = libraryTitle({
    movie_statuses: ["in_progress", "watched", "unwatched"],
    is_recently_added: true,
    is_favorite: true,
  });
  render(renderStatusBadges(row, true, ["unwatched"], "modern", "text"), host);
  expect(
    [...host.querySelectorAll(".cover-text-flag")].map((badge) =>
      badge.textContent?.trim(),
    ),
  ).toEqual(["In progress", "Recently Added", "Favorites"]);
  expect(host.querySelector("svg, .cover-flag, .cover-recent-edge")).toBeNull();
  expect(
    host.querySelector('[role="img"][aria-label="Recently Added"]'),
  ).toBeTruthy();
  render(
    renderStatusBadges(row, true, ["unwatched"], "kaleidescape", "text"),
    host,
  );
  expect(host.querySelector(".cover-text-flag")?.textContent?.trim()).toBe(
    "Paused",
  );
  render(
    renderStatusBadges(
      libraryTitle({ movie_statuses: ["unwatched"], is_recently_added: true }),
      true,
      ["unwatched"],
      "modern",
      "text",
    ),
    host,
  );
  expect(
    [...host.querySelectorAll(".cover-text-flag")].map((badge) =>
      badge.textContent?.trim(),
    ),
  ).toEqual(["Recently Added"]);
  render(renderStatusBadges(row, false, [], "modern", "text"), host);
  expect(host.querySelectorAll(".status-text")).toHaveLength(5);
  expect(host.querySelector("svg")).toBeNull();
});
