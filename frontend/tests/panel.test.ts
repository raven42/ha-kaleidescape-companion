import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../src/panel";
import type { KaleidescapePanel } from "../src/panel";
import { ApiError } from "../src/api";
import type { ApiMessage, Hass, Viewing } from "../src/api";
import { draftData, draftFrom } from "../src/editor";
import { FixtureTransport, info, record } from "./fixture";

let panel: KaleidescapePanel;
let transport: FixtureTransport;
async function settle() {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await panel.updateComplete;
}
async function waitFor(text: string) {
  await vi.waitFor(() => expect(panel.shadowRoot!.textContent).toContain(text));
}
function button(text: string): HTMLButtonElement {
  const element = [...panel.shadowRoot!.querySelectorAll("button")].find(
    (item) => item.textContent?.trim() === text,
  );
  expect(element, `button ${text}`).toBeTruthy();
  return element!;
}
function input(name: string, value: string) {
  const element = panel.shadowRoot!.querySelector<HTMLInputElement>(
    `[name="${name}"]`,
  )!;
  element.value = value;
  element.dispatchEvent(new Event("input", { bubbles: true }));
}
async function save() {
  panel
    .shadowRoot!.querySelector("form.editor")!
    .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  await settle();
}
beforeEach(async () => {
  transport = new FixtureTransport();
  panel = document.createElement("kaleidescape-panel") as KaleidescapePanel;
  panel.client = transport.client();
  document.body.append(panel);
  window.confirm = vi.fn(() => true);
  await waitFor("The Lantern Voyage");
});
afterEach(() => {
  panel.remove();
  vi.useRealTimers();
});

describe("journal management", () => {
  it("loads the scoped list and saves only changed observed fields", async () => {
    button("The Lantern Voyage").click();
    await waitFor("Edit viewing");
    input("notes", "A correction only");
    await save();
    await waitFor("Entry saved.");
    const update = transport.calls.find((call) =>
      call.type.endsWith("/journal/update"),
    )!;
    expect(update.patch).toEqual({ notes: "A correction only" });
    expect(update.expected_revision).toBe(2);
    expect(update.dataset_id).toBe(info.dataset_id);
    expect(update).not.toHaveProperty("api_version");
    expect(transport.records[0].watched_seconds).toBe(6600);
  });
  it("creates a manual entry and requires explicit deletion confirmation", async () => {
    button("＋ Add viewing").click();
    await settle();
    input("title", "A fictional new entry");
    await save();
    await waitFor("Entry saved.");
    expect(transport.records).toHaveLength(4);
    button("Delete entry").click();
    await settle();
    expect(
      transport.calls.some((call) => call.type.endsWith("/journal/delete")),
    ).toBe(false);
    expect(panel.shadowRoot!.textContent!.replace(/\s+/g, " ")).toContain(
      "does not permanently erase",
    );
    button("Confirm deletion").click();
    await waitFor("Entry removed");
    expect(transport.records).toHaveLength(3);
  });
  it("preserves a conflict draft and never silently overwrites a newer record", async () => {
    button("The Lantern Voyage").click();
    await waitFor("Edit viewing");
    input("notes", "Keep my draft");
    transport.records[0].revision++;
    await save();
    await waitFor("changed elsewhere");
    expect(
      panel.shadowRoot!.querySelector<HTMLTextAreaElement>("textarea")!.value,
    ).toBe("Keep my draft");
    expect(transport.records[0].notes).not.toBe("Keep my draft");
    button("Reload entry").click();
    await settle();
    expect(window.confirm).toHaveBeenCalled();
    expect(
      panel.shadowRoot!.querySelector<HTMLTextAreaElement>("textarea")!.value,
    ).toBe(transport.records[0].notes);
  });
  it.each(["connection_lost", "not_ready", "storage_error", "unknown_error"])(
    "retries an uncertain committed write after %s with the same UUID and payload",
    async (code) => {
      const original = transport.callWS.bind(transport);
      let interrupt = true;
      vi.spyOn(transport, "callWS").mockImplementation(
        async <T>(message: ApiMessage) => {
          const result = await original<T>(message);
          if (interrupt && message.type.endsWith("/journal/create")) {
            interrupt = false;
            throw new ApiError(code);
          }
          return result;
        },
      );
      button("＋ Add viewing").click();
      await settle();
      input("title", "Saved once");
      await save();
      await waitFor("Retry same change");
      expect(
        transport.records.filter((row) => row.title === "Saved once"),
      ).toHaveLength(1);
      expect(panel.shadowRoot!.querySelector("fieldset")!.disabled).toBe(true);
      button("Retry same change").click();
      await waitFor("Entry saved.");
      const requests = transport.calls.filter((call) =>
        call.type.endsWith("/journal/create"),
      );
      expect(requests[0]).toEqual(requests[1]);
      expect(
        transport.records.filter((row) => row.title === "Saved once"),
      ).toHaveLength(1);
    },
  );
  it("renders malicious metadata as text without executing or creating markup", async () => {
    const payload =
      '<img src=x onerror="window.stolen=true"><script>attack()</script>';
    transport.records[0].title = payload;
    button("Refresh").click();
    await waitFor(payload);
    expect(panel.shadowRoot!.querySelector("img,script,iframe")).toBeNull();
    button(payload).click();
    await waitFor("Edit viewing");
    expect(
      panel.shadowRoot!.querySelector<HTMLInputElement>("#title")!.value,
    ).toBe(payload);
  });
  it("clears private records and drafts on authorization failure", async () => {
    button("The Lantern Voyage").click();
    await waitFor("Edit viewing");
    input("notes", "private draft");
    transport.failure = "unauthorized";
    await save();
    await waitFor("Access to this operation is denied");
    expect(panel.shadowRoot!.textContent).not.toContain("The Lantern Voyage");
    expect(panel.shadowRoot!.querySelector("textarea")).toBeNull();
  });
  it("ignores old detail responses after switching connections", async () => {
    const original = transport.callWS.bind(transport);
    let resolve!: (value: Viewing) => void;
    vi.spyOn(transport, "callWS").mockImplementation(
      <T>(message: ApiMessage): Promise<T> => {
        if (message.type.endsWith("/journal/get"))
          return new Promise((done) => {
            resolve = done as (value: Viewing) => void;
          });
        return original<T>(message);
      },
    );
    button("The Lantern Voyage").click();
    await settle();
    const replacement = new FixtureTransport();
    replacement.records = [record({ title: "Different connection" })];
    panel.client = replacement.client();
    await waitFor("Different connection");
    resolve(record());
    await settle();
    expect(panel.shadowRoot!.textContent).not.toContain("The Lantern Voyage");
    expect(panel.shadowRoot!.querySelector("textarea")).toBeNull();
  });
  it("applies search and pagination through opaque server cursors", async () => {
    const original = transport.callWS.bind(transport);
    vi.spyOn(transport, "callWS").mockImplementation(
      async <T>(message: ApiMessage) => {
        const result = await original<T>(message);
        if (message.type.endsWith("/journal/list") && !message.cursor)
          return { ...result, next_cursor: "opaque-test-cursor" };
        return result;
      },
    );
    button("Refresh").click();
    await settle();
    input("search", "Lantern");
    panel
      .shadowRoot!.querySelector("form.filters")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await settle();
    expect(
      transport.calls
        .filter((call) => call.type.endsWith("/journal/list"))
        .at(-1),
    ).toMatchObject({ query: "Lantern", limit: 25 });
    expect(panel.shadowRoot!.textContent).not.toContain(
      "Midnight at the Observatory",
    );
    button("Next").click();
    await settle();
    expect(transport.calls.at(-1)).toMatchObject({
      cursor: "opaque-test-cursor",
      query: "Lantern",
    });
  });
  it("drops the HA view on role or connection changes without making unauthorized calls", async () => {
    panel.client = undefined;
    const hass: Hass = {
      ...transport,
      user: { id: "test-admin", is_admin: true },
      connection: { connected: true },
      callWS: transport.callWS.bind(transport),
      fetchWithAuth: transport.fetchWithAuth.bind(transport),
    };
    panel.hass = hass;
    await waitFor("The Lantern Voyage");
    const calls = transport.calls.length;
    panel.hass = { ...hass, user: { id: "test-admin", is_admin: false } };
    await settle();
    expect(panel.shadowRoot!.textContent).not.toContain("The Lantern Voyage");
    expect(transport.calls.length).toBeGreaterThan(calls);
    expect(
      panel.shadowRoot!.querySelector("kaleidescape-reader"),
    ).not.toBeNull();
  });
});

it("does not normalize source identifiers or rewrite untouched timestamp precision", () => {
  const original = draftFrom(
    record({
      raw_content_id: "26-0.0-S_exact",
      started_at: "2026-10-24T19:15:00.123456Z",
    }),
  );
  expect(draftData({ ...original, notes: "Changed" }, original)).toEqual({
    notes: "Changed",
  });
  expect(
    draftData({ ...original, raw_content_id: "new-exact-ID" }, original),
  ).toEqual({ raw_content_id: "new-exact-ID" });
});

it("does not release a completed export after switching connections", async () => {
  let resolve!: (value: Blob) => void;
  vi.spyOn(panel.client!, "download").mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  const create = vi.fn(() => "blob:fictional");
  const original = URL.createObjectURL;
  URL.createObjectURL = create;
  try {
    button("Export JSON").click();
    await settle();
    panel.client = new FixtureTransport().client();
    await settle();
    resolve(new Blob(["fictional private export"]));
    await settle();
    expect(create).not.toHaveBeenCalled();
  } finally {
    URL.createObjectURL = original;
  }
});

it("requires confirmation to abandon an uncertain retry and inspect existing records", async () => {
  button("＋ Add viewing").click();
  await settle();
  input("title", "Unconfirmed entry");
  transport.failure = "busy";
  await save();
  await waitFor("Retry same change");
  const writes = transport.calls.filter((call) =>
    call.type.endsWith("/journal/create"),
  ).length;
  transport.failure = null;
  button("Discard retry & inspect journal").click();
  await waitFor("Retry discarded");
  expect(window.confirm).toHaveBeenCalled();
  expect(
    transport.calls.filter((call) => call.type.endsWith("/journal/create")),
  ).toHaveLength(writes);
  expect(panel.shadowRoot!.querySelector("textarea")).toBeNull();
  expect(button("＋ Add viewing").disabled).toBe(false);
});
