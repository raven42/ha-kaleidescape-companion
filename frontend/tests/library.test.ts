import { afterEach, beforeEach, expect, it, vi } from "vitest";
import "../src/library";
import type { KaleidescapeLibrary } from "../src/library";
import type { LibraryPage } from "../src/api";
import { FixtureTransport, info, libraryTitle } from "./fixture";

let element: KaleidescapeLibrary;
let transport: FixtureTransport;
const root = () => element.shadowRoot!;
const text = () => root().textContent!.replace(/\s+/g, " ");
function button(label: string) {
  return [...root().querySelectorAll("button")].find(
    (button) => button.textContent!.trim() === label,
  )!;
}
async function flush() {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await element.updateComplete;
}
function field(name: string, value: string) {
  const control = root().querySelector<HTMLInputElement | HTMLSelectElement>(
    `[name="${name}"]`,
  )!;
  control.value = value;
  control.dispatchEvent(
    new Event(control.tagName === "SELECT" ? "change" : "input", {
      bubbles: true,
    }),
  );
}
beforeEach(async () => {
  transport = new FixtureTransport();
  element = document.createElement(
    "kaleidescape-library",
  ) as KaleidescapeLibrary;
  element.client = transport.client();
  element.scope = { ...info, library_enabled: true };
  document.body.append(element);
  await flush();
});
afterEach(() => {
  element.remove();
  vi.restoreAllMocks();
});

it("queries the local cache, displays first detection and source status, and filters available metadata", async () => {
  expect(text()).toContain("Voyage to Europa");
  expect(text()).toContain("Paused takes priority");
  expect(text()).toContain("purchase/download date is unknown");
  expect(
    transport.calls.some((call) => call.type.endsWith("/library/sync")),
  ).toBe(false);
  field("library_query", "Midnight");
  field("library_status", "in_progress");
  field("library_sort", "length");
  field("library_order", "desc");
  field("actor", "Fictional Actor");
  button("Search & filter").click();
  await flush();
  const call = transport.calls
    .filter((call) => call.type.endsWith("/library/list"))
    .at(-1)!;
  expect(call.filters).toMatchObject({
    query: "Midnight",
    status: "in_progress",
    sort: "length",
    descending: true,
    actor: "Fictional Actor",
    offset: 0,
  });
  expect(root().querySelectorAll("tbody tr")).toHaveLength(1);
  expect(text()).toContain("In progress");
  button("Sync now").click();
  await flush();
  expect(
    transport.calls.some((call) => call.type.endsWith("/library/sync")),
  ).toBe(true);
});

it("renders untrusted metadata as text and disables unavailable metadata controls", async () => {
  transport.libraryTitles = [
    libraryTitle({
      title: "<img src=x onerror=attack()>",
      writers: [],
      studios: [],
    }),
  ];
  button("Refresh cached data").click();
  await flush();
  expect(text()).toContain("<img src=x onerror=attack()>");
  expect(root().querySelector("img,script")).toBeNull();
  expect(
    root().querySelector<HTMLInputElement>('[name="writer"]')!.disabled,
  ).toBe(true);
  expect(
    root().querySelector<HTMLInputElement>('[name="studio"]')!.disabled,
  ).toBe(true);
});

it("ignores stale list replies after replacing the connection and stops status polling on unmount", async () => {
  let resolve!: (page: LibraryPage) => void;
  vi.spyOn(element.client!, "libraryList").mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  button("Refresh cached data").click();
  await flush();
  const replacement = new FixtureTransport();
  element.client = replacement.client();
  await flush();
  resolve({
    items: [libraryTitle({ title: "Stale private title" })],
    offset: 0,
    total: 1,
    has_more: false,
    revision: 5,
    facets: {},
    truncated_facets: [],
  });
  await flush();
  expect(text()).not.toContain("Stale private title");
  element.remove();
  await flush();
  expect(root().querySelector("tbody tr")).toBeNull();
});

it("aborts cover requests, revokes object URLs, and never applies an old cover", async () => {
  let resolve!: (blob: Blob) => void;
  const artwork = vi.spyOn(element.client!, "libraryArtwork").mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  const create = vi
    .spyOn(URL, "createObjectURL")
    .mockReturnValue("blob:fictional-cover");
  const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  transport.libraryTitles = [libraryTitle({ artwork_key: "f".repeat(64) })];
  button("Refresh cached data").click();
  await flush();
  const signal = artwork.mock.calls[0][2];
  element.client = new FixtureTransport().client();
  await flush();
  expect(signal.aborted).toBe(true);
  resolve(new Blob(["fictional"], { type: "image/png" }));
  await flush();
  expect(create).not.toHaveBeenCalled();
  const client = element.client!;
  vi.spyOn(client, "libraryArtwork").mockResolvedValue(
    new Blob(["fictional"], { type: "image/png" }),
  );
  const replacement = new FixtureTransport();
  replacement.libraryTitles = [libraryTitle({ artwork_key: "f".repeat(64) })];
  vi.spyOn(client, "libraryList").mockResolvedValue(
    await replacement.client().libraryList(info),
  );
  button("Refresh cached data").click();
  await flush();
  expect(root().querySelector("img")!.src).toBe("blob:fictional-cover");
  root().querySelector("img")!.dispatchEvent(new Event("error"));
  await flush();
  expect(root().querySelector("img")).toBeNull();
  expect(text()).toContain("No cached artwork");
  element.remove();
  expect(revoke).toHaveBeenCalledWith("blob:fictional-cover");
});

it("clears private data and polling on denied access; disabled mounting performs no requests", async () => {
  transport.failure = "unauthorized";
  button("Refresh cached data").click();
  await flush();
  expect(text()).not.toContain("Voyage to Europa");
  expect(text()).toContain("Access to this operation is denied");
  element.scope = { ...info, library_enabled: false };
  element.client = new FixtureTransport().client();
  const list = vi.spyOn(element.client, "libraryList"),
    status = vi.spyOn(element.client, "libraryInfo");
  await flush();
  expect(list).not.toHaveBeenCalled();
  expect(status).not.toHaveBeenCalled();
});

it("keeps the cached catalog usable when a sync reports an outage", async () => {
  vi.spyOn(element.client!, "libraryInfo").mockResolvedValue({
    ...(await transport.client().libraryInfo(info)),
    error: "library_unreachable",
  });
  button("Refresh cached data").click();
  await flush();
  expect(text()).toContain("Cached data is retained");
  expect(text()).toContain("Voyage to Europa");
});
