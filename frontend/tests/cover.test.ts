import { afterEach, expect, it, vi } from "vitest";
import { CoverQueue, CoverSession, LibraryCover } from "../src/library/cover";
import { info } from "./fixture";

afterEach(() => {
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

it("settles artwork and dataset changes in one render while offscreen", async () => {
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  const cover = new LibraryCover();
  cover.queue = new CoverQueue();
  cover.scope = { ...info, library_enabled: true };
  cover.artworkKey = "first-cover";
  document.body.append(cover);
  expect(await cover.updateComplete).toBe(true);

  cover.artworkKey = "second-cover";
  expect(await cover.updateComplete).toBe(true);
  cover.scope = { ...info, dataset_id: "another-dataset" };
  expect(await cover.updateComplete).toBe(true);
  expect(cover.shadowRoot!.querySelector("img")).toBeNull();
  expect(cover.shadowRoot!.textContent).toContain("Loading artwork");
  cover.remove();
  cover.queue.cache.dispose();
});

it("prefetches near-viewport covers and reuses the session cache", async () => {
  let notify!: IntersectionObserverCallback;
  let options: IntersectionObserverInit | undefined;
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(
        callback: IntersectionObserverCallback,
        init?: IntersectionObserverInit,
      ) {
        notify = callback;
        options = init;
      }
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal("URL", {
    createObjectURL: vi.fn(() => "blob:cover"),
    revokeObjectURL: vi.fn(),
  });
  const queue = new CoverQueue();
  const cover = new LibraryCover();
  const artwork = vi.fn().mockResolvedValue(new Blob(["fictional"]));
  cover.client = {
    libraryArtwork: artwork,
  } as unknown as LibraryCover["client"];
  cover.queue = queue;
  cover.scope = { ...info, library_enabled: true };
  cover.artworkKey = "cover";
  document.body.append(cover);
  await cover.updateComplete;
  expect(options?.rootMargin).toBe("600px 0px");
  notify(
    [{ isIntersecting: true } as IntersectionObserverEntry],
    {} as IntersectionObserver,
  );
  await vi.waitFor(() => expect(artwork).toHaveBeenCalledTimes(1));
  await vi.waitFor(() =>
    expect(cover.shadowRoot!.querySelector("img")).not.toBeNull(),
  );
  notify(
    [{ isIntersecting: false } as IntersectionObserverEntry],
    {} as IntersectionObserver,
  );
  notify(
    [{ isIntersecting: true } as IntersectionObserverEntry],
    {} as IntersectionObserver,
  );
  expect(artwork).toHaveBeenCalledTimes(1);
  cover.remove();
  queue.cache.dispose();
});

it("retains covers within a scope and revokes them when scope or session changes", () => {
  vi.stubGlobal("URL", {
    createObjectURL: vi.fn(() => "blob:cover"),
    revokeObjectURL: vi.fn(),
  });
  const session = new CoverSession();
  session.bind({ ...info, library_enabled: true });
  const original = session.queue;
  original.cache.put("cover", new Blob(["fictional"]));
  session.bind({ ...info, library_enabled: true });
  expect(session.queue).toBe(original);
  expect(session.queue.cache.get("cover")).toBe("blob:cover");
  session.bind({ ...info, dataset_id: "another", library_enabled: true });
  expect(session.queue).not.toBe(original);
  expect(original.cache.get("cover")).toBeUndefined();
  expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:cover");
  session.queue.cache.put("cover", new Blob(["fictional"]));
  session.reset();
  expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2);
});

it("warms each current-page cover in the background and stops on cancellation", async () => {
  vi.stubGlobal("URL", {
    createObjectURL: vi.fn(() => "blob:cover"),
    revokeObjectURL: vi.fn(),
  });
  const queue = new CoverQueue();
  const artwork = vi.fn().mockResolvedValue(new Blob(["fictional"]));
  const client = {
    libraryArtwork: artwork,
  } as unknown as LibraryCover["client"];
  const scope = { ...info, library_enabled: true };
  const controller = new AbortController();
  await queue.prefetch(
    client!,
    scope,
    ["one", "two", "one"],
    controller.signal,
    vi.fn(),
  );
  expect(artwork).toHaveBeenCalledTimes(2);
  expect(
    queue.cache.get(JSON.stringify([scope.entry_id, scope.dataset_id, "two"])),
  ).toBe("blob:cover");
  controller.abort();
  await queue.prefetch(client!, scope, ["three"], controller.signal, vi.fn());
  expect(artwork).toHaveBeenCalledTimes(2);
  queue.cache.dispose();
});

it("serves visible cover requests before waiting background requests", async () => {
  const queue = new CoverQueue();
  const controller = new AbortController();
  const active = await Promise.all(
    Array.from({ length: 3 }, () => queue.acquire(controller.signal)),
  );
  const order: string[] = [];
  const background = queue.acquire(controller.signal, true).then((release) => {
    order.push("background");
    release();
  });
  const foreground = queue.acquire(controller.signal).then((release) => {
    order.push("foreground");
    release();
  });
  active[0]();
  await Promise.all([background, foreground]);
  expect(order).toEqual(["foreground", "background"]);
  active[1]();
  active[2]();
  queue.cache.dispose();
});
