import { afterEach, beforeEach, expect, it, vi } from "vitest";
import "../src/ui/purchase-repair";
import { ApiError } from "../src/core/api";
import type { KaleidescapePurchaseRepair } from "../src/ui/purchase-repair";
import { FixtureTransport, info } from "./fixture";

let element: KaleidescapePurchaseRepair;
const root = () => element.shadowRoot!;
const text = () => root().textContent!.replace(/\s+/g, " ");
const button = (label: string) =>
  [...root().querySelectorAll("button")].find(
    (item) => item.textContent?.trim() === label,
  )!;
async function flush() {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await element.updateComplete;
}
const row = {
  id: "a".repeat(64),
  title: "Fictional movie",
  purchased_on: "2020-01-02",
  purchase_price: "$12.99",
  retail_price: "$24.99",
  order_id: "ORDER-1",
  href: null,
  library_id: "b".repeat(64),
};
const review = {
  plan_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  revision: 5,
  action: "correct" as const,
  before: row,
  after: { ...row, purchase_price: "$8.99" },
  before_library: { title: "Fictional <img src=x>" },
  after_library: { title: "Fictional <img src=x>" },
  totals_change: [{ source_id: "fictional", before: "$12.99", after: "$8.99" }],
  expires_in: 600,
};

beforeEach(async () => {
  element = document.createElement(
    "kaleidescape-purchase-repair",
  ) as KaleidescapePurchaseRepair;
  element.client = new FixtureTransport().client();
  element.scope = info;
  element.row = row;
  element.token = "c".repeat(64);
  document.body.append(element);
  await flush();
});
afterEach(() => {
  element.remove();
  vi.unstubAllGlobals();
});

it("previews corrections and retries uncertain writes with the same request", async () => {
  const preview = vi
    .spyOn(element.client!, "previewPurchaseRepair")
    .mockResolvedValue(review);
  const apply = vi
    .spyOn(element.client!, "applyPurchaseRepair")
    .mockRejectedValueOnce(new ApiError("connection_lost"))
    .mockResolvedValueOnce({ revision: 6, event_id: "fictional" });
  const done = vi.fn();
  const busy = vi.fn();
  element.addEventListener("repair-complete", done);
  element.addEventListener("repair-busy", busy);
  const price = root().querySelector<HTMLInputElement>(
    '[name="purchase_price"]',
  )!;
  price.value = "$8.99";
  price.dispatchEvent(new Event("input"));
  button("Review change").click();
  await flush();
  expect(preview.mock.calls[0]).toEqual([
    element.scope,
    "correct",
    row.id,
    element.token,
    { purchase_price: "$8.99" },
  ]);
  expect(root().querySelector<HTMLDialogElement>("dialog")!.open).toBe(true);
  const purchase = root().querySelector('[aria-label="Purchase"]')!;
  const changed = purchase.querySelector(".diff-row.changed")!;
  expect(changed.textContent).toContain("Purchase price (changed)");
  expect(changed.querySelector(".before")?.textContent).toContain("$12.99");
  expect(changed.querySelector(".after")?.textContent).toContain("$8.99");
  expect(text()).toContain("Library totals");
  expect(text()).toContain("$8.99");
  expect(root().querySelector("img[src=x]")).toBeNull();
  const check = root().querySelector<HTMLInputElement>(
    'input[type="checkbox"]',
  )!;
  expect(check.closest("label")?.classList.contains("check")).toBe(true);
  check.click();
  await flush();
  button("Apply reviewed change").click();
  await flush();
  expect(element.confirmNavigation()).toBe(false);
  expect(busy.mock.calls.at(-1)?.[0].detail).toBe(true);
  button("Retry change").click();
  await flush();
  expect(apply).toHaveBeenCalledTimes(2);
  expect(apply.mock.calls[0][0]).toEqual(apply.mock.calls[1][0]);
  expect(done).toHaveBeenCalledOnce();
  expect(busy.mock.calls.at(-1)?.[0].detail).toBe(false);
});

it("explains invalid fields and blocks preview until they are corrected", async () => {
  const preview = vi
    .spyOn(element.client!, "previewPurchaseRepair")
    .mockResolvedValue(review);
  const set = (name: string, value: string) => {
    const field = root().querySelector<HTMLInputElement>(`[name="${name}"]`)!;
    field.value = value;
    field.dispatchEvent(new Event("input"));
  };
  set("title", " ");
  set("purchase_price", "12.9");
  set("retail_price", "-$24.99");
  set("href", "javascript:alert(1)");
  button("Review change").click();
  await flush();
  expect(preview).not.toHaveBeenCalled();
  for (const name of ["title", "purchase_price", "retail_price", "href"]) {
    const field = root().querySelector<HTMLInputElement>(`[name="${name}"]`)!;
    expect(field.getAttribute("aria-invalid")).toBe("true");
    expect(
      root().querySelector(`#${field.getAttribute("aria-describedby")}`)
        ?.textContent,
    ).toBeTruthy();
  }
  expect(text()).toContain("currency symbol and two decimal places");
  expect(text()).toContain("HTTP(S) link");
  set("title", row.title);
  set("purchase_price", "$8.99");
  set("retail_price", row.retail_price);
  set("href", "");
  button("Review change").click();
  await flush();
  expect(preview).toHaveBeenCalledOnce();
});

it("guards closing the modal with unsaved changes", async () => {
  const field = root().querySelector<HTMLInputElement>('[name="title"]')!;
  field.value = "Changed title";
  field.dispatchEvent(new Event("input"));
  const confirm = vi.fn(() => false);
  vi.stubGlobal("confirm", confirm);
  const cancel = vi.fn();
  element.addEventListener("repair-cancel", cancel);
  root()
    .querySelector("dialog")!
    .dispatchEvent(new Event("cancel", { cancelable: true }));
  expect(confirm).toHaveBeenCalledOnce();
  expect(cancel).not.toHaveBeenCalled();
  expect(root().querySelector<HTMLDialogElement>("dialog")!.open).toBe(true);
  confirm.mockReturnValue(true);
  root().querySelector<HTMLButtonElement>(".dialog-close")!.click();
  expect(cancel).toHaveBeenCalledOnce();
});

it("requires review before voiding and supports restoring a recorded repair", async () => {
  const preview = vi
    .spyOn(element.client!, "previewPurchaseRepair")
    .mockResolvedValue({
      ...review,
      action: "void",
      after: null,
      after_library: null,
    });
  const select = root().querySelector<HTMLSelectElement>("select")!;
  select.value = "void";
  select.dispatchEvent(new Event("change"));
  await flush();
  expect(text()).toContain("prevents its identity from being imported again");
  button("Review change").click();
  await flush();
  expect(preview.mock.calls[0][1]).toBe("void");
  expect(preview.mock.calls[0][4]).toEqual({});

  element.remove();
  element = document.createElement(
    "kaleidescape-purchase-repair",
  ) as KaleidescapePurchaseRepair;
  element.client = new FixtureTransport().client();
  element.scope = info;
  element.row = { request_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" };
  element.token = "d".repeat(64);
  element.reverse = true;
  document.body.append(element);
  await flush();
  const reverse = vi
    .spyOn(element.client!, "previewPurchaseRepair")
    .mockResolvedValue({ ...review, action: "reverse" });
  button("Review change").click();
  await flush();
  expect(reverse.mock.calls[0].slice(1)).toEqual([
    "reverse",
    element.row.request_id,
    element.token,
    {},
  ]);
});
