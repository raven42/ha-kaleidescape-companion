import { expect, it, vi } from "vitest";
import { CoverCache } from "../src/library/image-cache";

function urls() {
  let index = 0;
  const create = vi
    .spyOn(URL, "createObjectURL")
    .mockImplementation(() => `blob:cover-${++index}`);
  const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  return { create, revoke };
}
it("retains URLs within a byte/count-bounded LRU and revokes evictions", () => {
  const { create, revoke } = urls();
  const cache = new CoverCache(10, 2);
  const blob = new Blob(["1234"]);
  const a = cache.put("a", blob),
    b = cache.put("b", blob);
  expect(cache.get("a")).toBe(a);
  cache.put("c", blob);
  expect(revoke).toHaveBeenCalledWith(b);
  expect(cache.get("a")).toBe(a);
  expect(cache.get("b")).toBeUndefined();
  expect(cache.put("a", blob)).toBe(a);
  expect(create).toHaveBeenCalledTimes(3);
  cache.put("large", new Blob(["1234567890"]));
  expect(cache.get("a")).toBeUndefined();
  expect(cache.get("c")).toBeUndefined();
  expect(cache.put("oversized", new Blob(["12345678901"]))).toBeUndefined();
  cache.dispose();
  expect(revoke).toHaveBeenCalledTimes(4);
  expect(cache.put("late", blob)).toBeUndefined();
  expect(create).toHaveBeenCalledTimes(4);
});
it("prefers offscreen eviction, notifies mounted readers, and releases subscriptions", () => {
  const { revoke } = urls();
  const cache = new CoverCache(10, 2);
  const first = cache.put("visible", new Blob(["1"]));
  const invalidate = vi.fn(),
    offscreen = vi.fn();
  cache.watch("visible", { invalidate, visible: () => true });
  const second = cache.put("offscreen", new Blob(["2"]));
  const unsubscribe = cache.watch("offscreen", {
    invalidate: offscreen,
    visible: () => false,
  });
  cache.put("next", new Blob(["3"]));
  expect(revoke).toHaveBeenCalledWith(second);
  expect(revoke).not.toHaveBeenCalledWith(first);
  expect(offscreen).toHaveBeenCalledOnce();
  expect(invalidate).not.toHaveBeenCalled();
  unsubscribe();
  cache.dispose();
  expect(invalidate).toHaveBeenCalledOnce();
  expect(offscreen).toHaveBeenCalledOnce();
  expect(cache.get("visible")).toBeUndefined();
});

it("retains more than a thousand covers under the default limits", () => {
  const { revoke } = urls();
  const cache = new CoverCache();
  const blob = new Blob(["cover"]);
  for (let index = 0; index < 1500; index++) cache.put(String(index), blob);
  expect(cache.get("0")).toBeDefined();
  expect(cache.get("1499")).toBeDefined();
  expect(revoke).not.toHaveBeenCalled();
  cache.dispose();
});

it("can retain every cover for a session and trims when balanced mode resumes", () => {
  const { revoke } = urls();
  const cache = new CoverCache(10, 2);
  cache.setUnlimited(true);
  for (let index = 0; index < 5; index++)
    cache.put(String(index), new Blob(["1234"]));
  expect(revoke).not.toHaveBeenCalled();
  expect(cache.get("0")).toBeDefined();
  cache.setUnlimited(false);
  expect(revoke).toHaveBeenCalledTimes(3);
  expect(cache.get("0")).toBeDefined();
  cache.dispose();
});
