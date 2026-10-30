import { afterEach, beforeEach, expect, it, vi } from "vitest";
import "../src/ui/transfers";
import type { KaleidescapeTransfers } from "../src/ui/transfers";
import { ApiError, MAX_IMPORT_BYTES } from "../src/core/api";
import type { ImportReview } from "../src/core/api";
import { FixtureTransport, info } from "./fixture";

let element: KaleidescapeTransfers;
const root = () => element.shadowRoot!;
const text = () => root().textContent!.replace(/\s+/g, " ");
function button(label: string) {
  return [...root().querySelectorAll("button")].find(
    (button) => button.textContent?.trim() === label,
  )!;
}
async function flush() {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await element.updateComplete;
}
function choose(file: File) {
  const input = root().querySelector<HTMLInputElement>('input[type="file"]')!;
  Object.defineProperty(input, "files", { configurable: true, value: [file] });
  input.dispatchEvent(new Event("change", { bubbles: true }));
}
function review(count = 3): ImportReview {
  return {
    plan_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    revision: 5,
    expires_in: 600,
    rows: Array.from(
      { length: count },
      (_, i): ImportReview["rows"][number] => ({
        key: `library_titles:${i}`,
        table: "library_titles",
        title: `Fictional ${i}`,
        action: i === 0 ? "new" : i === 1 ? "unchanged" : "merge",
        changes:
          i === 1
            ? {}
            : { purchased_on: { before: null, after: "2020-01-02" } },
        conflicts: i === 1 ? ["year"] : [],
        reason: "",
      }),
    ),
    counts: { new: 1, merge: Math.max(count - 2, 0), unchanged: 1, skip: 0 },
  };
}
async function preview(value = review()) {
  vi.spyOn(element.client!, "previewImport").mockResolvedValue(value);
  choose(new File(["{}"], "corrected.sqlite"));
  await flush();
  button("Review import").click();
  await flush();
}
beforeEach(async () => {
  element = document.createElement(
    "kaleidescape-transfers",
  ) as KaleidescapeTransfers;
  element.client = new FixtureTransport().client();
  element.scope = { ...info, tracking_enabled: false };
  document.body.append(element);
  await flush();
  button("Merge Import").click();
  await flush();
});
afterEach(() => element.remove());

it("reviews before writes, permits explicit deselection, and reports new/merged counts", async () => {
  const apply = vi.spyOn(element.client!, "applyImport").mockResolvedValue({
    imported_count: 0,
    updated_count: 1,
    skipped_count: 2,
    revision: 6,
  });
  expect(button("Review import").disabled).toBe(true);
  await preview();
  expect(apply).not.toHaveBeenCalled();
  expect(text()).toContain("1 new · 1 mergeable · 1 unchanged");
  const checks = root().querySelectorAll<HTMLInputElement>(
    'tbody input[type="checkbox"]',
  );
  expect(checks[1].disabled).toBe(true);
  checks[0].click();
  await flush();
  button("Apply 1 selected change").click();
  await flush();
  expect(apply.mock.calls[0][0].message.selected).toEqual(["library_titles:2"]);
  expect(text()).toContain("filled missing data in 1");
  expect(root().querySelector<HTMLDialogElement>("dialog")!.open).toBe(false);
});
it("pages compactly and selects all changes across filtered review pages", async () => {
  await preview(review(250));
  expect(root().querySelectorAll("tbody tr")).toHaveLength(100);
  button("Select none").click();
  await flush();
  expect(button("Apply 0 selected changes").disabled).toBe(true);
  const search = root().querySelector<HTMLInputElement>(
    'input[type="search"]',
  )!;
  search.value = "Fictional 249";
  search.dispatchEvent(new Event("input"));
  await flush();
  expect(root().querySelectorAll("tbody tr")).toHaveLength(1);
  button("Select all changes").click();
  await flush();
  expect(text()).toContain("249 selected");
  expect(button("Apply 249 selected changes").disabled).toBe(false);
});
it("locks the exact selection and UUID for uncertain retries, even if the review expires", async () => {
  await preview();
  const apply = vi
    .spyOn(element.client!, "applyImport")
    .mockRejectedValueOnce(new ApiError("connection_lost"))
    .mockResolvedValueOnce({
      imported_count: 1,
      updated_count: 1,
      skipped_count: 1,
      revision: 6,
    });
  button("Apply 2 selected changes").click();
  await flush();
  expect(text()).toContain("unconfirmed");
  const dialog = root().querySelector<HTMLDialogElement>("dialog")!;
  const cancel = new Event("cancel", { cancelable: true });
  dialog.dispatchEvent(cancel);
  await flush();
  expect(cancel.defaultPrevented).toBe(true);
  expect(dialog.open).toBe(true);
  expect(button("Cancel").disabled).toBe(true);
  expect(
    root().querySelector<HTMLInputElement>('input[type="file"]')!.disabled,
  ).toBe(true);
  button("Retry same import").click();
  await flush();
  expect(apply.mock.calls[0][0]).toEqual(apply.mock.calls[1][0]);
  expect(dialog.open).toBe(false);
});
it("clears stale plans for review and never retries a changed database automatically", async () => {
  await preview();
  const apply = vi
    .spyOn(element.client!, "applyImport")
    .mockRejectedValue(new ApiError("conflict"));
  button("Apply 2 selected changes").click();
  await flush();
  expect(root().querySelector("tbody")).toBeNull();
  expect(button("Review import").disabled).toBe(false);
  expect(apply).toHaveBeenCalledTimes(1);
});
it("rejects unsupported/oversized files before upload and requires disabled recording", async () => {
  const fetch = vi.spyOn(element.client!, "previewImport");
  choose(new File(["SQL"], "data.sql"));
  await flush();
  button("Review import").click();
  await flush();
  expect(text()).toContain("Some values were rejected");
  const file = new File(["{}"], "data.json");
  Object.defineProperty(file, "size", { value: MAX_IMPORT_BYTES + 1 });
  choose(file);
  await flush();
  button("Review import").click();
  await flush();
  expect(text()).toContain("32 MiB");
  element.scope = { ...info, tracking_enabled: true };
  await flush();
  expect(button("Review import").disabled).toBe(true);
  expect(fetch).toHaveBeenCalledTimes(2);
});
it("clears cancelled selection and opens export without starting a transfer", async () => {
  choose(new File(["{}"], "fictional-private.json"));
  await flush();
  button("Cancel").click();
  await flush();
  expect(text()).not.toContain("fictional-private");
  button("Export").click();
  await flush();
  expect(button("Export JSON")).toBeDefined();
  expect(root().querySelector('input[type="file"]')).toBeNull();
});
it("aborts preview on connection change, ignores late private results, and clears on access loss", async () => {
  let resolve!: (value: ImportReview) => void;
  const upload = vi.spyOn(element.client!, "previewImport").mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  choose(new File(["{}"], "private.json"));
  await flush();
  button("Review import").click();
  await flush();
  element.client = new FixtureTransport().client();
  await flush();
  expect(upload.mock.calls[0][2].aborted).toBe(true);
  resolve(review());
  await flush();
  expect(text()).not.toContain("Fictional 0");
  expect(text()).not.toContain("private.json");
  button("Merge Import").click();
  await flush();
  vi.spyOn(element.client!, "previewImport").mockRejectedValue(
    new ApiError("unauthorized"),
  );
  choose(new File(["{}"], "private.json"));
  await flush();
  button("Review import").click();
  await flush();
  expect(text()).not.toContain("private.json");
  expect(text()).toContain("Access to this operation is denied");
});
