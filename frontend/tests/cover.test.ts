import { afterEach, expect, it, vi } from "vitest";
import { CoverQueue, LibraryCover } from "../src/library/cover";
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
  expect(cover.shadowRoot!.textContent).toContain("No cached artwork");
  cover.remove();
  cover.queue.cache.dispose();
});
