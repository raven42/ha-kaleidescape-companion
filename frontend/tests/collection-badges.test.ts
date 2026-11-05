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
      libraryTitle({ collections: ["WatchSoon"], watched_status: "unwatched" }),
      true,
    ),
    host,
  );
  const badge = host.querySelector('.cover-flag.flag-watch-soon[role="img"]')!;
  expect(badge.getAttribute("aria-label")).toBe("Watch Soon");
  expect(badge.querySelector("svg circle")).not.toBeNull();
  expect(host.querySelectorAll(".cover-flag")).toHaveLength(1);
});
