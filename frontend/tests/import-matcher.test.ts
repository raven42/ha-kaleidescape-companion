import { afterEach, expect, it, vi } from "vitest";
import "../src/ui/import-matcher";
import type { KaleidescapeImportMatcher } from "../src/ui/import-matcher";
import { FixtureTransport, info } from "./fixture";

let element: KaleidescapeImportMatcher;
const movie = {
  id: "a".repeat(64),
  title: "Fictional voyage",
  year: 2025,
  directors: ["Example Director"],
  version_count: 2,
  source_hint: "example",
};
function create() {
  element = document.createElement(
    "kaleidescape-import-matcher",
  ) as KaleidescapeImportMatcher;
  element.client = new FixtureTransport().client();
  element.scope = info;
  element.row = {
    key: "purchases:example",
    table: "library",
    title: "Unknown spelling",
    action: "new",
    changes: {},
    conflicts: [],
    reason: "",
    needs_match: true,
    can_match: true,
  };
  element.review = {
    plan_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    revision: 5,
    expires_in: 600,
    counts: { new: 1, merge: 0, unchanged: 0, skip: 0 },
    rows: [element.row],
  };
}
afterEach(() => {
  element?.remove();
  vi.restoreAllMocks();
});
it("supports partial completion and keyboard choice without executing imported names", async () => {
  create();
  const search = vi
    .spyOn(element.client!, "searchImportMatches")
    .mockResolvedValue({
      items: [{ ...movie, title: "<img src=x onerror=alert(1)>" }],
      has_more: false,
    });
  const chosen = vi.fn();
  element.addEventListener("match-choice", chosen);
  document.body.append(element);
  await element.updateComplete;
  await vi.waitFor(() =>
    expect(element.shadowRoot!.querySelector('[role="option"]')).not.toBeNull(),
  );
  const input = element.shadowRoot!.querySelector<HTMLInputElement>("input")!;
  input.value = "Voy";
  input.dispatchEvent(new Event("input"));
  await vi.waitFor(() =>
    expect(search).toHaveBeenLastCalledWith(
      info,
      element.review,
      element.row!.key,
      "Voy",
    ),
  );
  await vi.waitFor(() =>
    expect(element.shadowRoot!.querySelector('[role="option"]')).not.toBeNull(),
  );
  expect(element.shadowRoot!.querySelector("img")).toBeNull();
  input.dispatchEvent(
    new KeyboardEvent("keydown", { key: "ArrowUp", cancelable: true }),
  );
  input.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Enter", cancelable: true }),
  );
  expect(chosen.mock.calls[0][0].detail).toBe(movie.id);
});
it("drops suggestions that resolve after the account/review changes or disconnects", async () => {
  create();
  let finish!: (value: { items: (typeof movie)[]; has_more: boolean }) => void;
  vi.spyOn(element.client!, "searchImportMatches")
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    )
    .mockResolvedValue({ items: [], has_more: false });
  document.body.append(element);
  await element.updateComplete;
  element.scope = { ...info, dataset_id: "different-dataset" };
  element.row = { ...element.row!, title: "Different account query" };
  await element.updateComplete;
  finish({ items: [movie], has_more: false });
  await new Promise((resolve) => setTimeout(resolve, 0));
  await element.updateComplete;
  expect(element.shadowRoot!.querySelector('[role="option"]')).toBeNull();
  expect(element.shadowRoot!.textContent).not.toContain(movie.title);
  element.remove();
});
