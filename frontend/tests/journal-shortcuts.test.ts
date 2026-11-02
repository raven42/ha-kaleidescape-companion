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
  element.context = {};
  element.scopeKey = "fictional:dataset";
  element.value = "Original";
  document.body.append(element);
  await element.updateComplete;
});
afterEach(() => element.remove());
it("shows household shortcuts without an Add viewing action and delegates Options/Clear", () => {
  expect(button("Add viewing")).toBeNull();
  const clear = vi.fn(),
    options = vi.fn();
  element.addEventListener("journal-clear", clear);
  element.addEventListener("journal-open-options", options);
  button("Clear Journal search and filters").click();
  button("Journal options").click();
  expect(clear).toHaveBeenCalledOnce();
  expect(options).toHaveBeenCalledOnce();
});
it("submits popup search only on apply and clears it on context changes", async () => {
  const search = vi.fn();
  element.addEventListener("journal-search", search);
  button("Search Journal").click();
  await element.updateComplete;
  const input = root().querySelector<HTMLInputElement>("input")!;
  expect(input.value).toBe("Original");
  input.value = "Fictional";
  input.dispatchEvent(new Event("input"));
  expect(search).not.toHaveBeenCalled();
  root()
    .querySelector("form")!
    .dispatchEvent(new Event("submit", { cancelable: true }));
  expect((search.mock.calls[0][0] as CustomEvent).detail).toBe("Fictional");
  expect(root().querySelector("dialog")!.open).toBe(false);
  button("Search Journal").click();
  await element.updateComplete;
  element.context = {};
  element.value = "";
  await element.updateComplete;
  expect(root().querySelector("dialog")!.open).toBe(false);
  expect(input.value).toBe("");
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
it("keeps mobile calendar totals to the selected month's count and watched time, including loading and singular forms", () => {
  const target = document.createElement("div");
  render(
    html`${journalTotals(info, { month: "Fictional month", count: 1, watchedSeconds: 5400, loading: false, error: "", empty: false }, true)}`,
    target,
  );
  expect(target.querySelector(".calendar-totals-compact")!.textContent).toBe(
    "1 viewing · 1h 30m watched",
  );
  expect(
    target.querySelector(".calendar-totals-compact")!.textContent,
  ).not.toContain("Total");
  render(html`${journalTotals(info, undefined, true)}`, target);
  expect(
    target.querySelector(".calendar-totals-compact")!.textContent,
  ).toContain("— viewings");
});
