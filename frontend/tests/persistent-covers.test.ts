/// <reference types="node" />
import { afterEach, expect, it, vi } from "vitest";
import { Blob as NodeBlob } from "node:buffer";
import { IDBFactory } from "fake-indexeddb";
import { PersistentCovers } from "../src/library/persistent-covers";
import { CoverCache } from "../src/library/image-cache";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it("retains blobs across sessions and isolates user and dataset partitions", async () => {
  vi.stubGlobal("indexedDB", new IDBFactory());
  vi.stubGlobal("Blob", NodeBlob);
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:restored");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  const first = new PersistentCovers("user-a:dataset-a");
  await first.put(
    "cover",
    new Blob(["fictional cover"], { type: "image/png" }),
  );
  first.close();
  const cache = new CoverCache();
  cache.setPersistent("user-a:dataset-a");
  expect(await cache.restore("cover")).toBe("blob:restored");
  cache.dispose();
  const anotherUser = new PersistentCovers("user-b:dataset-a");
  const anotherDataset = new PersistentCovers("user-a:dataset-b");
  expect(await anotherUser.get("cover")).toBeUndefined();
  expect(await anotherDataset.get("cover")).toBeUndefined();
  await anotherUser.put("cover", new Blob(["different user"]));
  const clearing = new CoverCache();
  clearing.setPersistent("user-a:dataset-a");
  await clearing.restore("cover");
  await clearing.clear("user-a:dataset-a");
  expect(clearing.get("cover")).toBeUndefined();
  expect(await clearing.restore("cover")).toBeUndefined();
  expect(await anotherUser.get("cover")).toBeDefined();
  clearing.dispose();
  anotherUser.close();
  anotherDataset.close();
});

it("does not restore an in-flight cover after the cache is disposed", async () => {
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:unexpected");
  let resolve!: (blob: Blob) => void;
  vi.spyOn(PersistentCovers.prototype, "get").mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  const cache = new CoverCache();
  cache.setPersistent("user:dataset");
  const pending = cache.restore("cover");
  cache.dispose();
  resolve(new Blob(["fictional"]));
  expect(await pending).toBeUndefined();
  expect(URL.createObjectURL).not.toHaveBeenCalled();
});

it("saves covers already in memory when persistent retention is enabled", async () => {
  vi.stubGlobal("indexedDB", new IDBFactory());
  vi.stubGlobal("Blob", NodeBlob);
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:cover");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  const cache = new CoverCache();
  cache.put("existing", new Blob(["cover"]));
  cache.setPersistent("user:dataset");
  const storage = new PersistentCovers("user:dataset");
  await vi.waitFor(async () =>
    expect(await storage.get("existing")).toBeDefined(),
  );
  cache.dispose();
  storage.close();
});
