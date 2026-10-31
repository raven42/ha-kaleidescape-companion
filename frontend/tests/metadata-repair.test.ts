import { modalClose } from "./dialog-helpers";
import { afterEach, expect, it, vi } from "vitest";
import "../src/ui/metadata-repair";
import type { MetadataRepair } from "../src/ui/metadata-repair";
import { ApiError } from "../src/core/api";
import type { MetadataReview } from "../src/core/api";
import { FixtureTransport, info } from "./fixture";

let element: MetadataRepair | undefined;
afterEach(() => {
  element?.remove();
  vi.restoreAllMocks();
});
const button = (root: ShadowRoot, label: string) =>
  [...root.querySelectorAll<HTMLButtonElement>("button")].find(
    (node) => node.textContent?.trim() === label,
  )!;
async function mount() {
  const transport = new FixtureTransport();
  const client = transport.client();
  element = document.createElement(
    "kaleidescape-metadata-repair",
  ) as MetadataRepair;
  element.client = client;
  element.scope = info;
  document.body.append(element);
  await element.updateComplete;
  return { client, transport, root: element.shadowRoot! };
}
async function review(root: ShadowRoot) {
  button(root, "Repair Journal Library metadata").click();
  await vi.waitFor(() => expect(root.querySelector("dialog")!.open).toBe(true));
}
it("reviews counts before a scoped confirmed repair and shows the outcome", async () => {
  const { root, transport } = await mount();
  await review(root);
  expect(root.textContent).toContain("3 entries with missing details");
  expect(root.textContent).toContain("Existing calendar events are not edited");
  expect(
    transport.calls.some((call) => call.type.endsWith("metadata/repair")),
  ).toBe(false);
  button(root, "Repair missing metadata").click();
  await vi.waitFor(() =>
    expect(root.querySelector("dialog")!.open).toBe(false),
  );
  expect(root.textContent).toContain("Updated 3 entries");
  const call = transport.calls.find((call) =>
    call.type.endsWith("metadata/repair"),
  )!;
  expect(call).toMatchObject({
    entry_id: info.entry_id,
    dataset_id: info.dataset_id,
    token: "a".repeat(64),
    confirmation: "REPAIR METADATA",
  });
  expect(call.request_id).toMatch(/^[a-f0-9-]{36}$/);
});
it("keeps the identical UUID and review after a lost repair response", async () => {
  const { root, client } = await mount();
  const repair = vi
    .spyOn(client, "repairMetadata")
    .mockRejectedValueOnce(new ApiError("connection_lost"))
    .mockResolvedValue({
      updated_count: 3,
      unchanged_count: 2,
      unmatched_count: 1,
      active_count: 0,
      revision: 1,
    });
  await review(root);
  button(root, "Repair missing metadata").click();
  await vi.waitFor(() =>
    expect(root.textContent).toContain("The result is unconfirmed"),
  );
  const cancel = new Event("cancel", { cancelable: true });
  root.querySelector("dialog")!.dispatchEvent(cancel);
  expect(cancel.defaultPrevented).toBe(true);
  expect(element!.confirmNavigation()).toBe(false);
  button(root, "Retry same repair").click();
  await vi.waitFor(() => expect(repair).toHaveBeenCalledTimes(2));
  expect(repair.mock.calls[1][0]).toBe(repair.mock.calls[0][0]);
});
it("requires another review after a stale plan", async () => {
  const { root, client } = await mount();
  vi.spyOn(client, "repairMetadata").mockRejectedValue(
    new ApiError("conflict"),
  );
  await review(root);
  button(root, "Repair missing metadata").click();
  await vi.waitFor(() =>
    expect(button(root, "Repair missing metadata").disabled).toBe(true),
  );
  expect(element!.confirmNavigation()).toBe(true);
  modalClose(root).click();
  await review(root);
  expect(button(root, "Repair missing metadata").disabled).toBe(false);
});
it("ignores a late review after a dataset change", async () => {
  const { root, client } = await mount();
  let release: (review: MetadataReview) => void = () => {};
  vi.spyOn(client, "metadataPreview").mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  );
  button(root, "Repair Journal Library metadata").click();
  element!.scope = { ...info, dataset_id: "another-dataset" };
  await element!.updateComplete;
  release({
    token: "b".repeat(64),
    updated_count: 999,
    unchanged_count: 0,
    unmatched_count: 0,
    active_count: 0,
  });
  await element!.updateComplete;
  expect(root.querySelector("dialog")!.open).toBe(false);
  expect(root.textContent).not.toContain("999");
});
it("shows secure request-ID failures before sending a write", async () => {
  const { root, client, transport } = await mount();
  vi.spyOn(client, "prepareMetadataRepair").mockImplementation(() => {
    throw new ApiError("request_id_unavailable");
  });
  await review(root);
  button(root, "Repair missing metadata").click();
  await vi.waitFor(() =>
    expect(root.textContent).toContain("cannot create a secure request ID"),
  );
  expect(
    transport.calls.some((call) => call.type.endsWith("metadata/repair")),
  ).toBe(false);
  expect(element!.confirmNavigation()).toBe(true);
});
