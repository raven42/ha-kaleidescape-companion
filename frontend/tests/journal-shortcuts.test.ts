/** Calendar mobile commands share host actions and never contact devices themselves. */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { html, render } from "lit";
import "../src/ui/journal-shortcuts";
import type { JournalShortcuts } from "../src/ui/journal-shortcuts";
import { journalTotals } from "../src/ui/journal-view";
import { info } from "./fixture";
let element: JournalShortcuts;
const root = () => element.shadowRoot!;
const button = (label: string) =>
  root().querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)!;
beforeEach(async () => {
  element = document.createElement(
    "kaleidescape-journal-shortcuts",
  ) as JournalShortcuts;
  element.count = 43;
  document.body.append(element);
  await element.updateComplete;
});
afterEach(() => element.remove());
it("shows household shortcuts without an Add or unconditional Clear action", () => {
  expect(button("Add viewing")).toBeNull();
  expect(button("Clear Journal search and filters")).toBeNull();
  const options = vi.fn();
  element.addEventListener("journal-open-options", options);
  button("Journal options").click();
  expect(options).toHaveBeenCalledOnce();
});
it("shows the viewing count and delegates refresh", () => {
  expect(root().querySelector("h2")?.textContent).toBe("Viewings (43)");
  expect(button("Search Journal")).toBeNull();
  const refresh = vi.fn();
  element.addEventListener("journal-refresh", refresh);
  button("Refresh Journal").click();
  expect(refresh).toHaveBeenCalledOnce();
});
it("delegates Add viewing only when offered and disables all actions while blocked", async () => {
  element.allowAdd = true;
  await element.updateComplete;
  const add = vi.fn();
  element.addEventListener("journal-add", add);
  button("Add viewing").click();
  expect(add).toHaveBeenCalledOnce();
  element.disabled = true;
  await element.updateComplete;
  button("Add viewing").click();
  expect(add).toHaveBeenCalledOnce();
  expect(
    [...root().querySelectorAll(".shortcuts button")].every(
      (b) => (b as HTMLButtonElement).disabled,
    ),
  ).toBe(true);
});
it("offers a separate way to leave a movie-filtered calendar", async () => {
  const clear = vi.fn();
  element.addEventListener("journal-clear-movie", clear);
  expect(button("Show all viewings")).toBeNull();
  element.filterLabel = "Viewings for a fictional movie";
  await element.updateComplete;
  button("Show all viewings").click();
  expect(clear).toHaveBeenCalledOnce();
  expect(button("Clear Journal search and filters")).toBeNull();
});
it("shows the selected month, yearly and all-time totals, respecting every visibility choice", () => {
  const target = document.createElement("div");
  const calendar = {
    month: "November 2026",
    monthName: "November",
    count: 1,
    watchedSeconds: 5400,
    loading: false,
    error: "",
    empty: false,
  };
  const totals = {
    ...info,
    viewing_count: 8,
    watched_seconds: 36000,
    year_viewing_count: 3,
    year_watched_seconds: 10800,
  };
  for (let bits = 0; bits < 8; bits++) {
    const options = {
      calendar_show_month: !!(bits & 1),
      calendar_show_year: !!(bits & 2),
      calendar_show_total: !!(bits & 4),
    };
    render(html`${journalTotals(totals, calendar, true, options)}`, target);
    const spans = [...target.querySelectorAll(".calendar-totals > span")].map(
      (span) => span.textContent!.replace(/\s+/g, " ").trim(),
    );
    expect(spans).toEqual([
      ...(options.calendar_show_month ? ["November: 1"] : []),
      ...(options.calendar_show_year ? ["Year: 3"] : []),
      ...(options.calendar_show_total ? ["Total: 8"] : []),
    ]);
    expect(
      target.querySelector(".calendar-totals")?.getAttribute("style") ?? "",
    ).toContain(spans.length ? `repeat(${spans.length},` : "");
  }
  render(html`${journalTotals(info, undefined, true)}`, target);
  expect(target.textContent!.replace(/\s+/g, " ")).toContain(
    "Selected Month: —",
  );
});
