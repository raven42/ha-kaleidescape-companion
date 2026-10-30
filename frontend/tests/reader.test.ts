import { afterEach, beforeEach, expect, it, vi } from "vitest";
import "../src/ui/panel";
import type { KaleidescapeReader } from "../src/ui/reader";
import type { KaleidescapePanel } from "../src/ui/panel";
import type { ApiMessage, Hass } from "../src/core/api";
import { FixtureTransport, info } from "./fixture";

let reader: KaleidescapeReader;
let transport: FixtureTransport;
const content = () => reader.shadowRoot!.textContent!;
async function waitFor(text: string) {
  await vi.waitFor(() => expect(content()).toContain(text));
}
function button(text: string) {
  return [...reader.shadowRoot!.querySelectorAll("button")].find(
    (item) => item.textContent?.trim() === text,
  )!;
}
beforeEach(async () => {
  transport = new FixtureTransport();
  reader = document.createElement("kaleidescape-reader") as KaleidescapeReader;
  reader.client = transport.client();
  document.body.append(reader);
  await waitFor("The Lantern Voyage");
});
afterEach(() => {
  reader.remove();
});

it("renders titles and timing as text without management controls or private metadata", async () => {
  expect(content()).toContain("Read-only household journal");
  expect(content()).not.toContain("fictional viewing for interface testing");
  expect(content()).not.toContain("fictional-source");
  expect(reader.shadowRoot!.querySelector("textarea")).toBeNull();
  expect(
    [...reader.shadowRoot!.querySelectorAll("button")].map(
      (item) => item.textContent,
    ),
  ).not.toEqual(expect.arrayContaining(["Export JSON", "＋ Add viewing"]));
  transport.records[0].title = '<img src=x onerror="alert(1)">';
  button("Refresh").click();
  await waitFor("<img");
  expect(reader.shadowRoot!.querySelector("img")).toBeNull();
  expect(
    transport.calls.every(
      (call) =>
        call.type.endsWith("/info") ||
        call.type.endsWith("/journal/list") ||
        (call.type.endsWith("/ui/preferences/get") && call.area === "journal"),
    ),
  ).toBe(true);
});
it("filters titles and status and sends bounded page requests", async () => {
  const input = reader.shadowRoot!.querySelector<HTMLInputElement>(
    'input[name="search"]',
  )!;
  input.value = "Quiet";
  input.dispatchEvent(new Event("input"));
  const select = reader.shadowRoot!.querySelector<HTMLSelectElement>("select")!;
  select.value = "partial";
  select.dispatchEvent(new Event("change"));
  reader
    .shadowRoot!.querySelector("form")!
    .dispatchEvent(new Event("submit", { cancelable: true }));
  await vi.waitFor(() =>
    expect(transport.calls.at(-1)).toMatchObject({
      query: "Quiet",
      status: "partial",
      limit: 25,
    }),
  );
  await waitFor("A Map of Quiet Places");
  expect(content()).not.toContain("The Lantern Voyage");
});
it("clears records on denied access", async () => {
  transport.failure = "unauthorized";
  button("Refresh").click();
  await waitFor("Access to this operation is denied");
  expect(content()).not.toContain("The Lantern Voyage");
});
it("clears old pagination when a refresh cannot resolve the journal", async () => {
  vi.spyOn(reader.client!, "list").mockResolvedValueOnce({
    items: transport.records,
    revision: 5,
    next_cursor: "fictional-cursor",
  });
  button("Refresh").click();
  await vi.waitFor(() => expect(button("Next").disabled).toBe(false));
  transport.failure = "not_ready";
  button("Refresh").click();
  await waitFor("The integration is not loaded");
  expect(button("Next").disabled).toBe(true);
  expect(content()).not.toContain("The Lantern Voyage");
  transport.failure = null;
  button("Refresh").click();
  await waitFor("The Lantern Voyage");
});
it("ignores delayed records after the native HA connection is lost", async () => {
  let resolve!: (value: unknown) => void;
  const hass: Hass = {
    user: { id: "reader", is_admin: false },
    connection: { connected: true },
    callWS: <T>(message: ApiMessage) =>
      message.type.endsWith("/journal/list")
        ? new Promise<T>((done) => {
            resolve = done as (value: unknown) => void;
          })
        : transport.callWS<T>(message),
    fetchWithAuth: transport.fetchWithAuth.bind(transport),
  };
  reader.hass = hass;
  await vi.waitFor(() => expect(resolve).toBeTypeOf("function"));
  reader.hass = { ...hass, connection: { connected: false } };
  await reader.updateComplete;
  resolve({ items: transport.records, next_cursor: null, revision: 5 });
  await new Promise((done) => setTimeout(done, 0));
  expect(content()).not.toContain("The Lantern Voyage");
  expect(content()).toContain("Sign in to Home Assistant");
});
it("selects the reader for a non-admin standalone session", async () => {
  const client = transport.client();
  vi.spyOn(client, "info").mockResolvedValue({
    entries: [
      { ...info, permissions: { read: true, edit: false, export: false } },
    ],
  });
  const panel = document.createElement(
    "kaleidescape-panel",
  ) as KaleidescapePanel;
  panel.client = client;
  document.body.append(panel);
  try {
    await vi.waitFor(() =>
      expect(
        panel.shadowRoot!.querySelector("kaleidescape-reader"),
      ).not.toBeNull(),
    );
    expect(panel.shadowRoot!.textContent).not.toContain("Export JSON");
    expect(panel.shadowRoot!.textContent).not.toContain("＋ Add viewing");
    expect(
      panel.shadowRoot!.querySelector("kaleidescape-now-playing"),
    ).toBeNull();
    expect(
      transport.calls.some((call) => call.type.endsWith("/now_playing")),
    ).toBe(false);
  } finally {
    panel.remove();
  }
});

it("offers enabled Library browsing to readers without sync/settings and unmounts it on return", async () => {
  transport.options.library_enabled = true;
  button("Refresh").click();
  await vi.waitFor(() => expect(button("Library").disabled).toBe(false));
  button("Library").click();
  await reader.updateComplete;
  const library = reader.shadowRoot!.querySelector("kaleidescape-library")!;
  await vi.waitFor(() =>
    expect(library.shadowRoot!.textContent).toContain("Voyage to Europa"),
  );
  expect(library.shadowRoot!.textContent).not.toContain("Sync now");
  expect(button("Settings")).toBeUndefined();
  expect(
    transport.calls.some((call) => call.type.endsWith("/library/sync")),
  ).toBe(false);
  button("Journal").click();
  await reader.updateComplete;
  expect(reader.shadowRoot!.querySelector("kaleidescape-library")).toBeNull();
  expect(content()).toContain("The Lantern Voyage");
});

it("orders reader tabs Library then Journal and follows that order with Home and End", async () => {
  transport.options.library_enabled = true;
  button("Refresh").click();
  await vi.waitFor(() => expect(button("Library").disabled).toBe(false));
  const tabs = reader.shadowRoot!.querySelector('[role="tablist"]')!;
  expect(
    [...tabs.querySelectorAll("button")].map((tab) => tab.textContent!.trim()),
  ).toEqual(["Library", "Journal"]);
  for (const [key, label] of [
    ["Home", "Library"],
    ["End", "Journal"],
  ]) {
    tabs.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
    await reader.updateComplete;
    expect(button(label).getAttribute("aria-selected")).toBe("true");
  }
});

it("keeps Library disabled without requests before opt-in and clears it on connection loss", async () => {
  expect(button("Library").disabled).toBe(true);
  button("Library").click();
  expect(transport.calls.some((call) => call.type.includes("/library/"))).toBe(
    false,
  );
  transport.options.library_enabled = true;
  button("Refresh").click();
  await vi.waitFor(() => expect(button("Library").disabled).toBe(false));
  button("Library").click();
  await reader.updateComplete;
  reader.client = undefined;
  await reader.updateComplete;
  expect(reader.shadowRoot!.querySelector("kaleidescape-library")).toBeNull();
  expect(content()).not.toContain("Voyage to Europa");
});
