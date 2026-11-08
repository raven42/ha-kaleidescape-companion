/** Fictional queue transport and simulated dialogs; no device connections. */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import "../src/library/collections";
import type { LibraryCollectionAdd } from "../src/library/collections";
import { ApiError } from "../src/core/api";
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
  element.choices = [
    "Favorites",
    "WatchSoon",
    "New",
    "Played",
    "Paused",
    "Science Fiction",
  ];
  document.body.append(element);
  await flush();
});
afterEach(() => {
  element.remove();
  vi.restoreAllMocks();
});
async function choose() {
  button("Collection").click();
  await flush();
}

it("does not offer collection writes to readers or when disabled", async () => {
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
it("opens immediately with cached names and queues one selected version", async () => {
  const changed = vi.fn();
  element.addEventListener("collection-changed", changed);
  await choose();
  expect(transport.calls).toHaveLength(0);
  button("Add to Science Fiction").click();
  await flush();
  expect(transport.calls[0]).toMatchObject({
    type: "kaleidescape_companion/library/collections/queue",
    title_id: "c".repeat(64),
    collection: "Science Fiction",
    operation: "add",
    revision: 5,
  });
  expect(transport.calls[0]).not.toHaveProperty("source_handle");
  expect(changed).toHaveBeenCalledOnce();
  expect(root().querySelector("dialog")!.open).toBe(false);
});
it("retries an unconfirmed enqueue with the same request ID", async () => {
  await choose();
  vi.spyOn(element.client!, "queueCollectionChange").mockRejectedValueOnce(
    new ApiError("connection_lost"),
  );
  const prepared = vi.spyOn(element.client!, "prepareCollectionChange");
  button("Add to Science Fiction").click();
  await flush();
  const pending = prepared.mock.results[0].value;
  expect(element.confirmNavigation()).toBe(false);
  button("Retry queue request").click();
  await flush();
  expect(prepared).toHaveBeenCalledOnce();
  expect(transport.calls.at(-1)?.request_id).toBe(pending.message.request_id);
  expect(element.confirmNavigation()).toBe(true);
});
it("explains that Paused requires playback and Watched/Unwatched are exclusive", async () => {
  await choose();
  expect(root().textContent).toContain("Start playback to add In Progress");
  expect(button("Add to In Progress").disabled).toBe(true);
  expect(root().textContent).toContain("Watched and Unwatched cannot overlap");
  expect(button("Move to Watched").disabled).toBe(false);
});
it("offers removal from an existing built-in membership", async () => {
  element.version = {
    ...transport.libraryTitles[2],
    collections: ["WatchSoon"],
  };
  await flush();
  await choose();
  button("Remove from Watch Soon").click();
  await flush();
  expect(transport.calls.at(-1)).toMatchObject({
    collection: "WatchSoon",
    operation: "remove",
  });
});
it("refreshes the selected version from the server and uses its new revision", async () => {
  await choose();
  const refresh = vi
    .spyOn(element.client!, "refreshTitleCollections")
    .mockResolvedValue({
      collections: ["WatchSoon", "New"],
      revision: 6,
    });
  const updated = vi.fn();
  element.addEventListener("collection-refreshed", updated);
  root()
    .querySelector<HTMLButtonElement>('[aria-label="Refresh collections"]')!
    .click();
  await flush();
  expect(refresh).toHaveBeenCalledWith(element.scope, element.version!.id, 5);
  expect(root().querySelector("dialog")!.open).toBe(true);
  expect(root().textContent).toContain(
    "Collection status refreshed from the server",
  );
  expect(updated).toHaveBeenCalledOnce();
  button("Remove from Watch Soon").click();
  await flush();
  expect(transport.calls.at(-1)).toMatchObject({
    operation: "remove",
    revision: 6,
  });
});

it("discards refresh results when administrator access changes", async () => {
  await choose();
  let done!: (value: { collections: string[]; revision: number }) => void;
  vi.spyOn(element.client!, "refreshTitleCollections").mockReturnValue(
    new Promise((resolve) => {
      done = resolve;
    }),
  );
  const updated = vi.fn();
  element.addEventListener("collection-refreshed", updated);
  root()
    .querySelector<HTMLButtonElement>('[aria-label="Refresh collections"]')!
    .click();
  await flush();
  expect(root().textContent).toContain("Refreshing this version");
  element.scope = undefined;
  await flush();
  done({ collections: ["WatchSoon"], revision: 6 });
  await flush();
  expect(updated).not.toHaveBeenCalled();
});
it.each(["scope", "enabled"] as const)(
  "ignores a late result after %s changes",
  async (field) => {
    await choose();
    let done!: (result: { status: string; request_id: string }) => void;
    vi.spyOn(element.client!, "queueCollectionChange").mockReturnValueOnce(
      new Promise((resolve) => {
        done = resolve;
      }),
    );
    const changed = vi.fn();
    element.addEventListener("collection-changed", changed);
    button("Add to Science Fiction").click();
    await flush();
    if (field === "scope") {
      element.scope = undefined;
      element.version = undefined;
    } else element.enabled = false;
    await flush();
    done({ status: "queued", request_id: "fictional" });
    await flush();
    expect(root().textContent).not.toContain("The Lantern Voyage");
    expect(changed).not.toHaveBeenCalled();
  },
);
it("renders cached names as text", async () => {
  element.choices = ['<img src=x onerror="alert(1)">'];
  button("Collection").click();
  await flush();
  expect(root().querySelector("img")).toBeNull();
  expect(
    root().querySelector(".collection-copy strong")!.textContent,
  ).toContain("<img");
});
