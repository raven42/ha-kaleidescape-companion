import { modalClose } from "./dialog-helpers";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import "../src/ui/transfers";
import type { KaleidescapeTransfers } from "../src/ui/transfers";
import { ApiError, MAX_IMPORT_BYTES } from "../src/core/api";
import type { ImportReview } from "../src/core/api";
import type { KaleidescapeImportMatcher } from "../src/ui/import-matcher";
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
        key: `library:${i}`,
        table: "library",
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

it("opens the purchase reconciliation dialog from the database", async () => {
  modalClose(root()).click();
  await flush();
  button("Reconcile purchases").click();
  await flush();
  expect(root().querySelector("dialog")!.open).toBe(true);
  expect(root().querySelector("h2")!.textContent).toContain(
    "Reconcile purchases",
  );
  expect(text()).toContain("There are no unmatched purchases");
  expect(root().querySelector('input[type="file"]')).toBeNull();
});

it("loads unmatched purchases from the database for review", async () => {
  modalClose(root()).click();
  await flush();
  const plan = review(1);
  plan.rows[0] = {
    ...plan.rows[0],
    key: "purchases:fixture",
    title: "Unmatched fictional purchase",
    needs_match: true,
    can_match: true,
  };
  const load = vi
    .spyOn(element.client!, "reconcilePurchases")
    .mockResolvedValue(plan);
  button("Reconcile purchases").click();
  await vi.waitFor(() =>
    expect(text()).toContain("Unmatched fictional purchase"),
  );
  expect(load).toHaveBeenCalledWith(element.scope);
  expect(text()).toContain("Match title");
});

it("allows purchase-only reconciliation while automatic tracking is enabled", async () => {
  modalClose(root()).click();
  element.scope = { ...info, tracking_enabled: true };
  await flush();
  button("Reconcile purchases").click();
  await flush();
  expect(text()).not.toContain("Disable automatic tracking");
  expect(text()).toContain("There are no unmatched purchases");
  expect(root().querySelector('input[type="file"]')).toBeNull();
});

it("puts unresolved purchases first and uses the revised token after choosing a known movie", async () => {
  const value = review();
  value.rows[1] = {
    ...value.rows[1],
    table: "library",
    key: "purchases:unresolved",
    needs_match: true,
    can_match: true,
    selected_by_default: false,
  };
  vi.spyOn(element.client!, "searchImportMatches").mockResolvedValue({
    items: [
      {
        id: "b".repeat(64),
        title: "Known remake",
        year: 2026,
        directors: ["Fictional Director"],
        version_count: 2,
        source_hint: "fictional",
      },
    ],
    has_more: false,
  });
  const matched = {
    ...value.rows[1],
    needs_match: false,
    action: "merge" as const,
    detail: "Selected Library movie: Known remake · 2026",
    changes: { source_group: { before: null, after: "known-group" } },
  };
  vi.spyOn(element.client!, "matchImportPurchase").mockResolvedValue({
    plan_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    revision: 5,
    expires_in: 590,
    counts: { new: 1, merge: 2, unchanged: 0, skip: 0 },
    row: matched,
  });
  const apply = vi.spyOn(element.client!, "applyImport").mockResolvedValue({
    imported_count: 1,
    updated_count: 2,
    skipped_count: 0,
    revision: 6,
  });
  await preview(value);
  expect(root().querySelector("tbody tr")!.textContent).toContain(
    "Fictional 1",
  );
  button("Match title…").click();
  await flush();
  const matcher = root().querySelector<KaleidescapeImportMatcher>(
    "kaleidescape-import-matcher",
  )!;
  await matcher.updateComplete;
  expect(button("Apply 2 selected changes").disabled).toBe(true);
  expect(matcher.shadowRoot!.textContent).toContain("2026");
  matcher
    .shadowRoot!.querySelector<HTMLButtonElement>('[role="option"]')!
    .click();
  await flush();
  expect(apply).not.toHaveBeenCalled();
  expect(root().querySelector("kaleidescape-import-matcher")).toBeNull();
  button("Apply 3 selected changes").click();
  await flush();
  expect(apply.mock.calls[0][0].message).toMatchObject({
    plan_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    selected: ["library:0", "library:2", "purchases:unresolved"],
  });
});

it("leaves purchase records unchecked until their suggested links are approved", async () => {
  const value = review(1);
  value.rows[0] = {
    ...value.rows[0],
    table: "library",
    key: "purchases:purchase",
    selected_by_default: false,
    detail: "Review Library group link: 2025 · 2 versions (exact name only)",
  };
  value.counts = { new: 1, merge: 0, unchanged: 0, skip: 0 };
  const apply = vi.spyOn(element.client!, "applyImport").mockResolvedValue({
    imported_count: 1,
    updated_count: 0,
    skipped_count: 0,
    revision: 6,
  });
  await preview(value);
  const check = root().querySelector<HTMLInputElement>(
    'tbody input[type="checkbox"]',
  )!;
  expect(check.checked).toBe(false);
  expect(apply).not.toHaveBeenCalled();
  expect(text()).toContain("exact name only");
  check.click();
  await flush();
  button("Apply 1 selected change").click();
  await flush();
  expect(apply.mock.calls[0][0].message.selected).toEqual([
    "purchases:purchase",
  ]);
});

it("distinguishes incoming purchase records from existing Library entries", async () => {
  const value = review();
  value.rows[0] = {
    ...value.rows[0],
    key: "purchases:new-invoice",
    title: "Store wording",
    detail: "2020-01-02 · Selected Library movie: Catalog wording · 1998",
    selected_by_default: false,
    changes: {
      title: { before: null, after: "<img src=x onerror=alert(1)>" },
      purchased_on: { before: null, after: "2020-01-02" },
    },
  };
  value.rows[1] = {
    ...value.rows[1],
    key: "purchases:existing-invoice",
  };
  value.rows[2] = {
    ...value.rows[2],
    key: "purchases:merge-invoice",
    changes: { purchase_price: { before: null, after: "$12.99" } },
  };
  await preview(value);
  expect(text()).toContain("not a new movie");
  const rows = root().querySelectorAll("tbody tr");
  expect(rows[0].textContent).toContain(
    "Selected Library movie: Catalog wording",
  );
  expect(rows[0].textContent).toContain("Add purchase to Library entry");
  expect(rows[0].querySelector("summary")!.textContent).toContain(
    "Purchase record to add",
  );
  expect(JSON.parse(rows[0].querySelector("pre")!.textContent!)).toEqual(
    value.rows[0].changes,
  );
  expect(rows[0].textContent).not.toContain("Purchase title");
  expect(rows[0].querySelector("img")).toBeNull();
  expect(rows[0].querySelector<HTMLInputElement>("input")!.checked).toBe(false);
  expect(rows[1].textContent).toContain("Purchase already imported");
  expect(rows[2].textContent).toContain("Update purchase record");
  expect(JSON.parse(rows[2].querySelector("pre")!.textContent!)).toEqual({
    purchase_price: { before: null, after: "$12.99" },
  });
  expect(value.rows[0].changes.title).toEqual({
    before: null,
    after: "<img src=x onerror=alert(1)>",
  });
});

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
  expect(apply.mock.calls[0][0].message.selected).toEqual(["library:2"]);
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
  expect(dialog.open).toBe(true);
  expect(modalClose(root()).disabled).toBe(false);
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
  modalClose(root()).click();
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

it("keeps unmatched purchases unselectable even when selecting all changes", async () => {
  const value = review();
  value.rows[0] = {
    ...value.rows[0],
    needs_match: true,
    selected_by_default: false,
  };
  await preview(value);
  const unresolved = root().querySelector<HTMLInputElement>(
    'tbody input[type="checkbox"]',
  )!;
  expect(unresolved.disabled).toBe(true);
  button("Select all changes").click();
  await flush();
  expect(unresolved.checked).toBe(false);
  expect(text()).toContain("1 selected");
});
