import { setUnifiedMovieDialog } from "../src/ui/movie-dialog-mode";
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
  setUnifiedMovieDialog(true);
  transport = new FixtureTransport();
  reader = document.createElement("kaleidescape-reader") as KaleidescapeReader;
  reader.client = transport.client();
  document.body.append(reader);
  await waitFor("The Lantern Voyage");
});
afterEach(() => {
  reader.remove();
});

it("keeps rows compact and exposes timing only in the independent detail region", async () => {
  const root = reader.shadowRoot!;
  const row = root.querySelector(".entry-list li")!;
  expect(row.querySelector("time")?.textContent).not.toContain(":");
  expect(row.textContent).not.toContain("min watched");
  expect(row.querySelector(".journal-row-status")?.textContent).toBe(
    "Completed",
  );
  expect(root.querySelector(".entries-header form")).not.toBeNull();
  expect(root.querySelector(".entries-list .pagination")).toBeNull();
  expect(root.querySelector(".entries-footer .pagination")).not.toBeNull();
  expect(root.querySelector('.entries-detail[tabindex="0"]')).not.toBeNull();
  button("The Lantern Voyage").click();
  await vi.waitFor(() =>
    expect(root.querySelector(".entries-detail")?.textContent).toContain(
      "Watched",
    ),
  );
  expect(row.textContent).not.toContain("Watched");
});

it("renders titles and timing as text without management controls or private metadata", async () => {
  expect(content()).toContain("Explore your viewing history.");
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
  expect(reader.shadowRoot!.querySelectorAll("img")).toHaveLength(1);
  expect(
    reader.shadowRoot!.querySelector("header img.companion-icon"),
  ).not.toBeNull();
  expect(
    transport.calls.every(
      (call) =>
        call.type.endsWith("/info") ||
        call.type.endsWith("/journal/list") ||
        (call.type.endsWith("/ui/preferences/get") &&
          ["search", "journal"].includes(String(call.area))),
    ),
  ).toBe(true);
});
it("filters titles and status and sends bounded page requests", async () => {
  const input = reader.shadowRoot!.querySelector<HTMLInputElement>(
    'input[name="search"]',
  )!;
  input.value = "Quiet";
  input.dispatchEvent(new Event("input"));
  const select = reader.shadowRoot!.querySelector<HTMLSelectElement>(
    "[name=filter_status]",
  )!;
  select.value = "partial";
  select.dispatchEvent(new Event("change"));
  await vi.waitFor(() =>
    expect(transport.calls.at(-1)).toMatchObject({ status: "partial" }),
  );
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
it("opens household-safe entry details without exposing administrator fields", async () => {
  button("The Lantern Voyage").click();
  await vi.waitFor(() =>
    expect(
      reader
        .shadowRoot!.querySelector(".entries-detail .journal-title")
        ?.textContent?.trim(),
    ).toBe("The Lantern Voyage"),
  );
  expect(content()).toContain("Runtime");
  expect(content()).not.toContain("fictional viewing for interface testing");
  expect(content()).not.toContain("fictional-source");
  expect(reader.shadowRoot!.querySelector("form.editor, textarea")).toBeNull();
  expect(button("Edit viewing")).toBeUndefined();
  expect(
    transport.calls.some((call) => call.type.endsWith("/journal/get")),
  ).toBe(true);
  expect(
    transport.calls.some((call) => call.type.endsWith("/journal/sessions")),
  ).toBe(false);
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
  await waitFor("The Lantern Voyage");
});

it("opens exact Library details in place for a household reader", async () => {
  transport.options.library_enabled = true;
  const title = transport.libraryTitles[0];
  transport.viewingLinks.set(transport.records[0].id, title.id);
  button("Refresh").click();
  await vi.waitFor(() => expect(button("Library").disabled).toBe(false));
  await vi.waitFor(() => expect(button("The Lantern Voyage")).toBeDefined());
  button("The Lantern Voyage").click();
  await vi.waitFor(() =>
    expect(
      reader.shadowRoot!.querySelector("kaleidescape-viewing-library"),
    ).not.toBeNull(),
  );
  const link = reader.shadowRoot!.querySelector(
    "kaleidescape-viewing-library",
  )!;
  await vi.waitFor(() =>
    expect(
      link
        .shadowRoot!.querySelector("kaleidescape-library")
        ?.shadowRoot?.querySelector<HTMLDialogElement>("#title-dialog")?.open,
    ).toBe(true),
  );
  expect(
    link
      .shadowRoot!.querySelector("kaleidescape-library")!
      .shadowRoot!.querySelector("kaleidescape-library-journal"),
  ).not.toBeNull();
  const journal = link
    .shadowRoot!.querySelector("kaleidescape-library")!
    .shadowRoot!.querySelector("kaleidescape-library-journal")!;
  await vi.waitFor(() =>
    expect(journal.shadowRoot!.querySelector("summary")).not.toBeNull(),
  );
  expect(journal.shadowRoot!.textContent).not.toContain("Edit Journal");
  expect(reader.shadowRoot!.querySelector(".entries-detail")).not.toBeNull();
  expect(button("＋ Add viewing")).toBeUndefined();
});

it("orders reader tabs Now Playing, Library then Journal and follows that order with Home and End", async () => {
  transport.options.library_enabled = true;
  button("Refresh").click();
  await vi.waitFor(() => expect(button("Library").disabled).toBe(false));
  const tabs = reader.shadowRoot!.querySelector('[role="tablist"]')!;
  expect(
    [...tabs.querySelectorAll("button")].map((tab) => tab.textContent!.trim()),
  ).toEqual(["Now Playing", "Library", "Journal"]);
  for (const [key, label] of [
    ["Home", "Now Playing"],
    ["End", "Journal"],
  ]) {
    tabs.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
    await reader.updateComplete;
    expect(button(label).getAttribute("aria-selected")).toBe("true");
  }
});

it("offers household playback snapshots and nested controls", async () => {
  button("Now Playing").click();
  await reader.updateComplete;
  const nowPlaying = reader.shadowRoot!.querySelector(
    "kaleidescape-now-playing",
  )!;
  await vi.waitFor(() => expect(nowPlaying.shadowRoot).toBeTruthy());
  const controls = nowPlaying.shadowRoot!.querySelector(
    "kaleidescape-device-controls",
  )!;
  await vi.waitFor(() =>
    expect(controls.shadowRoot!.textContent).toContain("Player controls"),
  );
  expect(
    transport.calls.some((call) => call.type.endsWith("/control/info")),
  ).toBe(true);
  expect(
    transport.calls.some((call) => call.type.endsWith("/control/discover")),
  ).toBe(false);
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
it("moves accepted Library playback to Now Playing for the same target", async () => {
  transport.options.library_enabled = true;
  button("Refresh").click();
  await vi.waitFor(() => expect(button("Library").disabled).toBe(false));
  button("Library").click();
  await reader.updateComplete;
  const library = reader.shadowRoot!.querySelector("kaleidescape-library")!;
  library.dispatchEvent(
    new CustomEvent("playback-started", {
      detail: "opaque-player",
      bubbles: true,
      composed: true,
    }),
  );
  await reader.updateComplete;
  expect(button("Now Playing").getAttribute("aria-selected")).toBe("true");
  await vi.waitFor(() =>
    expect(
      transport.calls.some(
        (call) =>
          call.type.endsWith("/now_playing") &&
          call.player_id === "opaque-player",
      ),
    ).toBe(true),
  );
});

it("shows one compact basic footer without database health information", async () => {
  const root = reader.shadowRoot!;
  expect(root.querySelectorAll("footer")).toHaveLength(1);
  const text = root.querySelector("footer")!.textContent!;
  expect(text).toContain("Total Viewings");
  expect(text).toContain("This Month");
  expect(text.replace(/\s+/g, " ")).toContain("Watched Time: Total");
  expect(text).not.toMatch(/Revision|Schema|Recording|Storage ready|database/);
  expect(
    root.querySelector(".journal-filters kaleidescape-journal-options"),
  ).not.toBeNull();
  expect(root.querySelector("[name=filter_status]")).not.toBeNull();
});
