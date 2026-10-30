import { afterEach, expect, it, vi } from "vitest";
import "../src/ui/viewing-library";
import type { ViewingLibrary } from "../src/ui/viewing-library";
import type { LibraryCover } from "../src/library/cover";
import { FixtureTransport, info } from "./fixture";

let element: ViewingLibrary;
function mount(transport: FixtureTransport) {
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  element = document.createElement(
    "kaleidescape-viewing-library",
  ) as ViewingLibrary;
  element.client = transport.client();
  element.scope = { ...info, library_enabled: true };
  element.viewingId = transport.records[0].id;
  document.body.append(element);
}
afterEach(() => {
  element?.remove();
  vi.unstubAllGlobals();
});

it("uses the linked artwork and emits the exact Library ID without executing titles", async () => {
  const transport = new FixtureTransport();
  const movie = transport.libraryTitles[0];
  movie.title = "<img src=x onerror=alert(1)>";
  transport.viewingLinks.set(transport.records[0].id, movie.id);
  mount(transport);
  const navigate = vi.fn();
  element.addEventListener("open-library-title", navigate);
  await vi.waitFor(() =>
    expect(element.shadowRoot!.querySelector("button")).not.toBeNull(),
  );
  const cover = element.shadowRoot!.querySelector(
    "kaleidescape-library-cover",
  ) as LibraryCover;
  expect(cover.artworkKey).toBe(movie.artwork_key);
  expect(element.shadowRoot!.querySelector("img")).toBeNull();
  element.shadowRoot!.querySelector<HTMLButtonElement>("button")!.click();
  expect(navigate.mock.calls[0][0].detail).toBe(movie.id);
});

it("does not request Library data when the feature is disabled", async () => {
  const transport = new FixtureTransport();
  mount(transport);
  element.scope = { ...info, library_enabled: false };
  await element.updateComplete;
  expect(transport.calls).toHaveLength(0);
  expect(element.shadowRoot!.querySelector("button")).toBeNull();
});

it("ignores a late link response after scope changes", async () => {
  const transport = new FixtureTransport();
  mount(transport);
  let resolve!: (value: { library: null }) => void;
  vi.spyOn(element.client!, "viewingLibrary").mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  await element.updateComplete;
  element.scope = { ...info, dataset_id: "different", library_enabled: false };
  await element.updateComplete;
  resolve({ library: null });
  await new Promise((done) => setTimeout(done, 0));
  expect(element.shadowRoot!.textContent?.trim()).toBe("");
});
