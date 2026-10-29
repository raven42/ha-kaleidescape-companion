/** Fictional device adapter and simulated dialogs; no browser/device connection. */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import "../src/library/collections";
import type { LibraryCollectionAdd } from "../src/library/collections";
import { ApiError } from "../src/core/api";
import type { CollectionAddResult } from "../src/core/api";
import { FixtureTransport, info } from "./fixture";

let element: LibraryCollectionAdd;
let transport: FixtureTransport;
const root = () => element.shadowRoot!;
const button = (label: string) =>
  [...root().querySelectorAll<HTMLButtonElement>("button")].find(
    (item) => item.textContent?.trim() === label,
  )!;
async function flush() {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await element.updateComplete;
}
beforeEach(async () => {
  transport = new FixtureTransport();
  element = document.createElement(
    "kaleidescape-library-collection-add",
  ) as LibraryCollectionAdd;
  element.client = transport.client();
  element.scope = { ...info, library_enabled: true };
  element.version = transport.libraryTitles[2];
  element.revision = 5;
  element.enabled = true;
  document.body.append(element);
  await flush();
});
afterEach(() => {
  element.remove();
  vi.restoreAllMocks();
});
async function choose() {
  button("Add to Collection…").click();
  await vi.waitFor(() =>
    expect(root().querySelectorAll("option")).toHaveLength(2),
  );
  const select = root().querySelector<HTMLSelectElement>("select")!;
  select.value = "Science Fiction";
  select.dispatchEvent(new Event("change"));
  await flush();
}

it("shows no add control or device-target request to readers or when disabled", async () => {
  element.enabled = false;
  await flush();
  expect(root().querySelector("button")).toBeNull();
  element.enabled = true;
  element.scope = {
    ...info,
    permissions: { read: true, edit: false, export: false },
  };
  await flush();
  expect(root().querySelector("button")).toBeNull();
  expect(transport.calls).toHaveLength(0);
});

it("loads choices only on explicit open and sends the chosen individual version", async () => {
  const changed = vi.fn();
  element.addEventListener("collection-changed", changed);
  expect(transport.calls).toHaveLength(0);
  await choose();
  expect(transport.calls[0]).toMatchObject({
    type: "kaleidescape_companion/library/collections/targets",
    title_id: "c".repeat(64),
    revision: 5,
  });
  button("Add selected version").click();
  await flush();
  const add = transport.calls.find((call) =>
    call.type.endsWith("/collections/add"),
  )!;
  expect(add).toMatchObject({
    title_id: "c".repeat(64),
    collection: "Science Fiction",
    revision: 5,
  });
  expect(add).not.toHaveProperty("source_handle");
  expect(changed).toHaveBeenCalledOnce();
  expect(root().querySelector("dialog")!.open).toBe(false);
  expect(transport.libraryTitles[2].collections).toContain("Science Fiction");
});

it("checks a lost reply without posting again and protects dismissal until checked", async () => {
  await choose();
  vi.spyOn(element.client!, "collectionAdd").mockRejectedValueOnce(
    new ApiError("connection_lost"),
  );
  const prepared = vi.spyOn(element.client!, "prepareCollectionAdd");
  button("Add selected version").click();
  await flush();
  const pending = prepared.mock.results[0].value;
  const id = String(pending.message.request_id);
  const dialog = root().querySelector("dialog")!;
  expect(element.confirmNavigation()).toBe(false);
  expect(dialog.dispatchEvent(new Event("cancel", { cancelable: true }))).toBe(
    false,
  );
  transport.collectionResults.set(id, { status: "confirmed", request_id: id });
  button("Check add result").click();
  await flush();
  expect(
    transport.calls.filter((call) => call.type.endsWith("/collections/add")),
  ).toHaveLength(0);
  expect(transport.calls.at(-1)).toMatchObject({
    type: "kaleidescape_companion/library/collections/check",
    request_id: id,
  });
  expect(dialog.open).toBe(false);
  expect(element.confirmNavigation()).toBe(true);
});

it("clears private state and ignores a late accepted result after scope loss", async () => {
  await choose();
  let done!: (result: CollectionAddResult) => void;
  vi.spyOn(element.client!, "collectionAdd").mockReturnValueOnce(
    new Promise((resolve) => {
      done = resolve;
    }),
  );
  const changed = vi.fn();
  element.addEventListener("collection-changed", changed);
  button("Add selected version").click();
  await flush();
  element.scope = undefined;
  element.version = undefined;
  await flush();
  done({ status: "confirmed", request_id: "fictional" });
  await flush();
  expect(root().textContent).not.toContain("The Lantern Voyage");
  expect(changed).not.toHaveBeenCalled();
});

it("ignores a cancelled target lookup and never mounts label markup", async () => {
  let done!: (value: { collections: string[]; revision: number }) => void;
  vi.spyOn(element.client!, "collectionTargets").mockReturnValueOnce(
    new Promise((resolve) => {
      done = resolve;
    }),
  );
  button("Add to Collection…").click();
  await flush();
  button("Cancel").click();
  await flush();
  done({ collections: ['<img src=x onerror="alert(1)">'], revision: 5 });
  await flush();
  expect(root().querySelector("dialog")!.open).toBe(false);
  expect(root().querySelector("img")).toBeNull();
});

it("clears a pending form on opt-out and ignores its late response", async () => {
  await choose();
  let done!: (result: CollectionAddResult) => void;
  vi.spyOn(element.client!, "collectionAdd").mockReturnValueOnce(
    new Promise((resolve) => {
      done = resolve;
    }),
  );
  const changed = vi.fn();
  element.addEventListener("collection-changed", changed);
  button("Add selected version").click();
  await flush();
  element.enabled = false;
  await flush();
  done({ status: "confirmed", request_id: "fictional" });
  await flush();
  expect(root().querySelector("dialog")).toBeNull();
  expect(element.confirmNavigation()).toBe(true);
  expect(changed).not.toHaveBeenCalled();
});
