import { afterEach, expect, it, vi } from "vitest";
import "../src/library/purchase-edit";
import { ApiError } from "../src/core/api";
import type { GroupPurchaseEdit } from "../src/core/api";
import type { GroupPurchaseEditor } from "../src/library/purchase-edit";
import { storeLink } from "../src/library/purchase-details";
import { FixtureTransport, info } from "./fixture";

let element: GroupPurchaseEditor;
afterEach(() => {
  element?.remove();
  vi.restoreAllMocks();
});
const receipt = {
  id: "a".repeat(64),
  title: "Fictional Film",
  purchased_on: "2020-01-02",
  purchase_price: "$9.99",
  retail_price: "$19.99",
  order_id: "FICTIONAL-1",
  href: "/movie-store/movie/fictional",
};
const initial: GroupPurchaseEdit = {
  snapshot: "b".repeat(64),
  unavailable: false,
  records: [receipt],
  manual: [
    {
      library_id: "c".repeat(64),
      purchased_on: "2020-01-02",
      purchase_price: null,
      retail_price: null,
      order_id: null,
      href: null,
    },
  ],
};
const button = (root: ShadowRoot, label: string) =>
  [...root.querySelectorAll<HTMLButtonElement>("button")].find(
    (item) => item.textContent?.trim() === label,
  )!;
async function mount(review = initial) {
  const client = new FixtureTransport().client();
  vi.spyOn(client, "groupPurchaseEdit").mockResolvedValue(review);
  element = document.createElement(
    "kaleidescape-group-purchase-edit",
  ) as GroupPurchaseEditor;
  element.client = client;
  element.scope = info;
  element.titleId = "d".repeat(64);
  document.body.append(element);
  await vi.waitFor(() =>
    expect(
      element.shadowRoot!.querySelector(
        '[name="purchase_information_unavailable"]',
      ),
    ).toBeTruthy(),
  );
  return { root: element.shadowRoot!, client };
}
function change(root: ShadowRoot, name: string, value: string) {
  const input = root.querySelector<HTMLInputElement>(`[name="${name}"]`)!;
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

it("shows one combined purchase form and retries the exact save", async () => {
  const { root, client } = await mount();
  expect(root.querySelectorAll('[name="purchase_price"]')).toHaveLength(1);
  expect(
    root.querySelector<HTMLInputElement>('[name="purchased_on"]')!.value,
  ).toBe("2020-01-02");
  const save = vi
    .spyOn(client, "saveGroupPurchaseEdit")
    .mockRejectedValueOnce(new ApiError("connection_lost"))
    .mockResolvedValueOnce({});
  const done = vi.fn();
  element.addEventListener("purchase-complete", done);
  change(root, "purchase_price", "$8.99");
  button(root, "Save changes").click();
  await vi.waitFor(() => expect(button(root, "Retry exact save")).toBeTruthy());
  expect(save.mock.calls[0][0].message.data).toEqual({
    receipt_id: receipt.id,
    unavailable: false,
    fields: { purchase_price: "$8.99" },
  });
  expect(element.confirmNavigation()).toBe(false);
  button(root, "Retry exact save").click();
  await vi.waitFor(() => expect(done).toHaveBeenCalledOnce());
  expect(save.mock.calls[1][0]).toBe(save.mock.calls[0][0]);
});

it("hides purchase fields and saves only the unavailable setting", async () => {
  const { root, client } = await mount();
  const save = vi.spyOn(client, "saveGroupPurchaseEdit").mockResolvedValue({});
  root
    .querySelector<HTMLInputElement>(
      '[name="purchase_information_unavailable"]',
    )!
    .click();
  await element.updateComplete;
  expect(root.querySelector('[name="purchase_price"]')).toBeNull();
  button(root, "Save changes").click();
  await vi.waitFor(() => expect(save).toHaveBeenCalledOnce());
  expect(save.mock.calls[0][0].message.data).toEqual({
    receipt_id: receipt.id,
    unavailable: true,
    fields: {},
  });
});

it("edits the selected actual receipt without combining distinct transactions", async () => {
  const second = {
    ...receipt,
    id: "e".repeat(64),
    purchased_on: "2021-02-03",
    order_id: "FICTIONAL-2",
    purchase_price: "$5.99",
  };
  const { root, client } = await mount({
    ...initial,
    records: [receipt, second],
  });
  const select = root.querySelector<HTMLSelectElement>(
    '[name="purchase_record"]',
  )!;
  select.value = "1";
  select.dispatchEvent(new Event("change"));
  await element.updateComplete;
  expect(
    root.querySelector<HTMLInputElement>('[name="purchase_price"]')!.value,
  ).toBe("$5.99");
  const save = vi.spyOn(client, "saveGroupPurchaseEdit").mockResolvedValue({});
  change(root, "purchase_price", "$4.99");
  button(root, "Save changes").click();
  await vi.waitFor(() => expect(save).toHaveBeenCalledOnce());
  expect(save.mock.calls[0][0].message.data).toEqual({
    receipt_id: second.id,
    unavailable: false,
    fields: { purchase_price: "$4.99" },
  });
});

it("shows a value from another receipt but requires selecting its owner to edit it", async () => {
  const first = { ...receipt, purchase_price: null };
  const second = {
    ...receipt,
    id: "e".repeat(64),
    order_id: "FICTIONAL-2",
    purchase_price: "$5.99",
  };
  const { root } = await mount({ ...initial, records: [first, second] });
  let price = root.querySelector<HTMLInputElement>('[name="purchase_price"]')!;
  expect(price.value).toBe("$5.99");
  expect(price.disabled).toBe(true);
  expect(root.textContent).toContain(
    "Select the purchase record containing this value",
  );
  const select = root.querySelector<HTMLSelectElement>(
    '[name="purchase_record"]',
  )!;
  select.value = "1";
  select.dispatchEvent(new Event("change"));
  await element.updateComplete;
  price = root.querySelector<HTMLInputElement>('[name="purchase_price"]')!;
  expect(price.value).toBe("$5.99");
  expect(price.disabled).toBe(false);
});

it("pulls missing manual values from different versions without requiring a receipt", async () => {
  const { root, client } = await mount({
    ...initial,
    records: [],
    manual: [
      {
        library_id: "a".repeat(64),
        purchased_on: "2020-01-02",
        purchase_price: null,
        retail_price: null,
      },
      {
        library_id: "b".repeat(64),
        purchased_on: null,
        purchase_price: "$9.99",
        retail_price: "$19.99",
      },
    ],
  });
  expect(
    root.querySelector<HTMLInputElement>('[name="purchased_on"]')!.value,
  ).toBe("2020-01-02");
  expect(
    root.querySelector<HTMLInputElement>('[name="purchase_price"]')!.value,
  ).toBe("$9.99");
  expect(root.querySelector('[name="title"]')).toBeNull();
  const save = vi.spyOn(client, "saveGroupPurchaseEdit").mockResolvedValue({});
  change(root, "retail_price", "$18.99");
  button(root, "Save changes").click();
  await vi.waitFor(() => expect(save).toHaveBeenCalledOnce());
  expect(save.mock.calls[0][0].message.data).toEqual({
    receipt_id: null,
    unavailable: false,
    fields: { retail_price: "$18.99" },
  });
});

it("only turns recognized Store references into safe links", () => {
  expect(storeLink("/movie-store/movie/fictional")).toBe(
    "https://www.kaleidescape.com/movie-store/movie/fictional",
  );
  expect(
    storeLink("https://store.kaleidescape.com/movie-store/movie/details/123"),
  ).toBe("https://store.kaleidescape.com/movie-store/movie/details/123");
  for (const invalid of [
    "javascript:alert(1)",
    "https://evil.example/movie-store/movie/1",
    "//evil.example/movie-store/movie/1",
    "/movie-store/../private",
    "https://www.kaleidescape.com:444/movie-store/movie/1",
    "https://user@www.kaleidescape.com/movie-store/movie/1",
  ])
    expect(storeLink(invalid)).toBeUndefined();
});
