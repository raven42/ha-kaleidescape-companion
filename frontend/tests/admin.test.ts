import { afterEach, beforeEach, expect, it, vi } from "vitest";
import "../src/advanced";
import "../src/settings";
import type { KaleidescapeAdvanced } from "../src/advanced";
import type { KaleidescapeSettings } from "../src/settings";
import type { KaleidescapeTransfers } from "../src/transfers";
import { ApiError } from "../src/api";
import type { ApiMessage, DatabasePage } from "../src/api";
import { FixtureTransport, info, record } from "./fixture";

let transport: FixtureTransport;
let element: KaleidescapeAdvanced | KaleidescapeSettings;
const root = () => element.shadowRoot!;
const text = () => root().textContent!.replace(/\s+/g, " ");
function button(label: string) {
  const button = [...root().querySelectorAll("button")].find(
    (item) => item.textContent?.trim() === label,
  );
  expect(button, label).toBeTruthy();
  return button!;
}
async function waitFor(value: string) {
  await vi.waitFor(() => expect(text()).toContain(value));
}
async function flush() {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await element.updateComplete;
}
function input(name: string, value: string) {
  const input = root().querySelector<HTMLInputElement>(`[name="${name}"]`)!;
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
}
async function mount(
  tag: "kaleidescape-advanced" | "kaleidescape-settings",
  tracking = false,
) {
  transport.trackingEnabled = tracking;
  element = document.createElement(tag) as typeof element;
  element.client = transport.client();
  element.scope = { ...info, tracking_enabled: tracking };
  document.body.append(element);
  await waitFor(
    tag === "kaleidescape-advanced" ? "The Lantern Voyage" : "Save settings",
  );
}
function selectViewing() {
  const checkbox = [
    ...root().querySelectorAll<HTMLInputElement>('input[type="checkbox"]'),
  ].find(
    (input) => input.getAttribute("aria-label") === `Select ${record().title}`,
  )!;
  checkbox.checked = true;
  checkbox.dispatchEvent(new Event("change", { bubbles: true }));
}
async function confirmPurge(value: string) {
  input("purge_confirmation", value);
  await flush();
  button("Confirm permanent purge").click();
  await flush();
}
beforeEach(() => {
  transport = new FixtureTransport();
  vi.spyOn(HTMLFormElement.prototype, "reportValidity").mockReturnValue(true);
  window.confirm = vi.fn(() => true);
});
afterEach(() => {
  element?.remove();
});

it("renders a settings page and saves the native integration options flow", async () => {
  await mount("kaleidescape-settings");
  expect(root().querySelector("dialog")).toBeNull();
  expect(
    root().querySelector<HTMLInputElement>('[name="minimum_runtime_minutes"]')!
      .value,
  ).toBe("10");
  const saved = vi.fn();
  element.addEventListener("settings-saved", saved);
  input("minimum_runtime_minutes", "20");
  button("Save settings").click();
  await flush();
  expect(
    transport.calls.find((call) => call.type.endsWith("/settings/submit")),
  ).toMatchObject({
    flow_id: "fixture-flow",
    data: { minimum_runtime_minutes: 20, tracking_enabled: false },
    entry_id: info.entry_id,
    dataset_id: info.dataset_id,
  });
  expect(saved).toHaveBeenCalledOnce();
});

it("keeps library sync opt-in and saves library controls through the native options flow", async () => {
  await mount("kaleidescape-settings");
  const enabled = root().querySelector<HTMLInputElement>(
    '[name="library_enabled"]',
  )!;
  expect(enabled.checked).toBe(false);
  expect(root().querySelector('[name="library_host"]')).toBeNull();
  enabled.checked = true;
  enabled.dispatchEvent(new Event("change", { bubbles: true }));
  await flush();
  input("library_host", "");
  input("library_interval_hours", "12");
  input("custom_collection", "Demo extras");
  button("Add hidden name").click();
  await flush();
  input("custom_collection", "Archived collection");
  button("Add hidden name").click();
  await flush();
  const artwork = root().querySelector<HTMLInputElement>(
    '[name="library_sync_artwork"]',
  )!;
  artwork.checked = true;
  artwork.dispatchEvent(new Event("change", { bubbles: true }));
  await flush();
  expect(text()).toContain("additional disk space");
  expect(text()).toContain("256 MiB limit");
  button("Save settings").click();
  await flush();
  expect(
    transport.calls.find((call) => call.type.endsWith("/settings/submit"))!
      .data,
  ).toMatchObject({
    library_enabled: true,
    library_host: "",
    library_interval_hours: 12,
    library_excluded_collections: ["Demo extras", "Archived collection"],
    library_sync_collections: true,
    library_sync_details: true,
    library_sync_artwork: true,
    library_artwork_cache_mb: 512,
  });
});
it("cancels without saving and returns server validation errors on the settings page", async () => {
  await mount("kaleidescape-settings");
  const original = transport.callWS.bind(transport);
  vi.spyOn(transport, "callWS").mockImplementation(
    async <T>(message: ApiMessage) => {
      if (message.type.endsWith("/settings/submit"))
        return {
          type: "form",
          flow_id: "fixture-flow",
          errors: { base: "missing_entities" },
        } as T;
      return original<T>(message);
    },
  );
  button("Save settings").click();
  await waitFor("Select all three source entities");
  element.remove();
  await flush();
  expect(transport.calls.at(-1)?.type).toMatch(/settings\/cancel$/);
});
it("does not resubmit an unconfirmed options save and clears fields on denial", async () => {
  await mount("kaleidescape-settings");
  transport.failure = "connection_lost";
  button("Save settings").click();
  await waitFor("save result is unconfirmed");
  expect(root().querySelector("fieldset")!.disabled).toBe(true);
  element.remove();
  transport.failure = "unauthorized";
  element = document.createElement(
    "kaleidescape-settings",
  ) as KaleidescapeSettings;
  element.client = transport.client();
  element.scope = info;
  document.body.append(element);
  await waitFor("Access to this operation is denied");
  expect(root().querySelector("input")).toBeNull();
});
it("shows raw deleted records as text, bounded table navigation, and refuses purge while tracking", async () => {
  transport.deletedRecords = [
    record({
      id: "fictional-deleted",
      title: "<img src=x onerror=attack()>",
      deleted_at: "2026-10-26T01:00:00Z",
    }),
  ];
  await mount("kaleidescape-advanced", true);
  expect(text()).toContain("Deleted");
  expect(text()).toContain("<img src=x onerror=attack()>");
  expect(root().querySelector("img,script")).toBeNull();
  expect(button("Purge all entries").disabled).toBe(true);
  expect(transport.calls[0]).toMatchObject({ table: "viewings", offset: 0 });
});
it("requires typed confirmation and purges only selected entries", async () => {
  await mount("kaleidescape-advanced");
  selectViewing();
  await flush();
  button("Purge entry").click();
  await flush();
  button("Purge selected (1)").click();
  await flush();
  expect(button("Confirm permanent purge").disabled).toBe(true);
  await confirmPurge("purge");
  expect(transport.records).toHaveLength(3);
  await confirmPurge("PURGE");
  await waitFor("Permanently purged 1 entries");
  expect(transport.records).toHaveLength(2);
  expect(
    transport.calls.find((call) => call.type.endsWith("/database/purge")),
  ).toMatchObject({
    viewing_ids: [record().id],
    all: false,
    confirmation: "PURGE",
    expected_revision: 5,
  });
});

it("creates a manual viewing from the toolbar and retries an uncertain create exactly", async () => {
  await mount("kaleidescape-advanced");
  const original = transport.callWS.bind(transport);
  let interrupt = true;
  vi.spyOn(transport, "callWS").mockImplementation(
    async <T>(message: ApiMessage) => {
      const result = await original<T>(message);
      if (interrupt && message.type.endsWith("/journal/create")) {
        interrupt = false;
        throw new ApiError("connection_lost");
      }
      return result;
    },
  );
  const toolbar = root().querySelector(".database-toolbar")!;
  expect(toolbar.textContent).toContain("New Entry");
  button("New Entry").click();
  await flush();
  input("title", "A fictional database entry");
  root()
    .querySelector("form.editor")!
    .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  await waitFor("Retry same change");
  expect(transport.records).toHaveLength(4);
  expect(
    root().querySelector("#table-sessions")!.hasAttribute("disabled"),
  ).toBe(true);
  button("Retry same change").click();
  await waitFor("Viewing saved.");
  expect(transport.records).toHaveLength(4);
  const calls = transport.calls.filter((call) =>
    call.type.endsWith("/journal/create"),
  );
  expect(calls).toHaveLength(2);
  expect(calls[0]).toEqual(calls[1]);
  expect(calls[0].data).toMatchObject({
    title: "A fictional database entry",
    status: "partial",
    watched_seconds: 0,
  });
  expect(
    root().querySelector<HTMLTextAreaElement>('[name="notes"]'),
  ).not.toBeNull();
  root().querySelector<HTMLButtonElement>("#table-sessions")!.click();
  await flush();
  expect(button("New Entry").disabled).toBe(true);
});

it("groups the entries pagination controls separately from their row count", async () => {
  await mount("kaleidescape-advanced");
  const pagination = root().querySelector(
    ".database-entries .database-pagination",
  )!;
  expect(pagination.querySelector("small")!.textContent).toContain("Rows");
  const actions = pagination.querySelector(".actions")!;
  expect(
    [...actions.querySelectorAll("button")].map((button) =>
      button.textContent!.trim(),
    ),
  ).toEqual(["First", "Previous", "Next"]);
  expect(actions.querySelector("small")).toBeNull();
});

it("changes database page sizes, searches, and sorts while clearing page selections", async () => {
  transport.records.push(
    ...Array.from({ length: 500 }, (_, index) =>
      record({
        id: `fictional-${String(index).padStart(3, "0")}`,
        title: `Fictional row ${String(index).padStart(3, "0")}`,
      }),
    ),
  );
  await mount("kaleidescape-advanced");
  const select = async (name: string, value: string) => {
    const control = root().querySelector<HTMLSelectElement>(
      `[name="${name}"]`,
    )!;
    control.value = value;
    control.dispatchEvent(new Event("change", { bubbles: true }));
    await flush();
  };
  expect(
    [...root().querySelectorAll('[name="database_limit"] option')].map(
      (option) => option.textContent,
    ),
  ).toEqual(["10", "25", "100", "500"]);
  selectViewing();
  await select("database_limit", "100");
  expect(root().querySelectorAll(".entry-list li")).toHaveLength(100);
  expect(button("Delete entry").disabled).toBe(true);
  button("Next").click();
  await flush();
  expect(transport.calls.at(-1)).toMatchObject({
    offset: 100,
    limit: 100,
    revision: 5,
  });
  expect(text()).toContain("Rows 101–200 of 503");
  await select("database_sort", "title");
  expect(transport.calls.at(-1)).toMatchObject({ offset: 0, sort: "title" });
  expect(root().querySelector(".entry-name")!.textContent).toContain(
    "A Map of Quiet Places",
  );
  button("Ascending ↑").click();
  await flush();
  expect(transport.calls.at(-1)).toMatchObject({
    sort: "title",
    descending: true,
  });
  expect(root().querySelector(".entry-name")!.textContent).toContain(
    "The Lantern Voyage",
  );
  await select("database_limit", "500");
  expect(root().querySelectorAll(".entry-list li")).toHaveLength(500);
  const checkboxes = root().querySelectorAll<HTMLInputElement>(
    '.entry-list input[type="checkbox"]',
  );
  for (const checkbox of [...checkboxes].slice(0, 100)) {
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event("change", { bubbles: true }));
  }
  await flush();
  expect(checkboxes[100].disabled).toBe(true);
  expect(checkboxes[0].disabled).toBe(false);
  expect(text()).toContain("100 selected (maximum 100)");
  button("Next").click();
  await flush();
  expect(root().querySelectorAll(".entry-list li")).toHaveLength(3);
  expect(button("Next").disabled).toBe(true);
  input("database_query", "Fictional row 49");
  root()
    .querySelector("form.database-filters")!
    .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  await flush();
  expect(transport.calls.at(-1)).toMatchObject({
    offset: 0,
    query: "Fictional row 49",
    limit: 500,
    sort: "title",
    descending: true,
  });
  expect(root().querySelectorAll(".entry-list li")).toHaveLength(10);
  expect(text()).toContain("Rows 1–10 of 10");
  root().querySelector<HTMLButtonElement>("#table-sessions")!.click();
  await flush();
  expect(transport.calls.at(-1)).toMatchObject({
    table: "sessions",
    query: "",
    limit: 500,
    descending: false,
  });
  expect(transport.calls.at(-1)!.sort).toBeUndefined();
});

it("preserves the database draft and applied controls when browsing changes are cancelled", async () => {
  await mount("kaleidescape-advanced");
  button("New Entry").click();
  await flush();
  input("title", "Keep this fictional draft");
  const before = transport.calls.length;
  vi.mocked(window.confirm).mockReturnValue(false);
  for (const [name, value, applied] of [
    ["database_limit", "100", "25"],
    ["database_sort", "title", "id"],
  ]) {
    const control = root().querySelector<HTMLSelectElement>(
      `[name="${name}"]`,
    )!;
    control.value = value;
    control.dispatchEvent(new Event("change", { bubbles: true }));
    expect(control.value).toBe(applied);
  }
  button("Ascending ↑").click();
  input("database_query", "Another title");
  root()
    .querySelector("form.database-filters")!
    .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  await flush();
  expect(transport.calls).toHaveLength(before);
  expect(root().querySelector<HTMLInputElement>('[name="title"]')!.value).toBe(
    "Keep this fictional draft",
  );
});

it("uses one database surface with a shared toolbar and the main underline tab design", async () => {
  await mount("kaleidescape-advanced");
  expect(root().querySelectorAll(".card")).toHaveLength(1);
  const toolbar = root().querySelector(".database-toolbar")!;
  expect(
    [...toolbar.querySelectorAll("button")].map((button) =>
      button.textContent!.trim(),
    ),
  ).toEqual(["New Entry", "Delete entry", "Purge entry", "Refresh database"]);
  expect(toolbar.querySelector("kaleidescape-transfers")).not.toBeNull();
  expect(
    root().querySelector('.page-tabs[aria-label="Database tables"]'),
  ).not.toBeNull();
  expect(root().querySelector<HTMLDialogElement>("#purge-dialog")!.open).toBe(
    false,
  );
  expect(button("Delete entry").disabled).toBe(true);
  root().querySelector<HTMLButtonElement>("#table-sessions")!.click();
  await flush();
  expect(button("New Entry").disabled).toBe(true);
  expect(button("Delete entry").disabled).toBe(true);
  expect(button("Purge entry").disabled).toBe(true);
});

it("deletes one selected viewing only after confirmation and retries the same request", async () => {
  await mount("kaleidescape-advanced");
  selectViewing();
  await flush();
  vi.mocked(window.confirm).mockReturnValueOnce(false);
  button("Delete entry").click();
  await flush();
  expect(
    transport.calls.some((call) => call.type.endsWith("/journal/delete")),
  ).toBe(false);
  const original = transport.callWS.bind(transport);
  let interrupt = true;
  vi.spyOn(transport, "callWS").mockImplementation(
    async <T>(message: ApiMessage) => {
      const result = await original<T>(message);
      if (interrupt && message.type.endsWith("/journal/delete")) {
        interrupt = false;
        throw new ApiError("connection_lost");
      }
      return result;
    },
  );
  button("Delete entry").click();
  await waitFor("Retry same change");
  expect(transport.records).toHaveLength(2);
  expect(transport.deletedRecords).toHaveLength(1);
  expect(button("Refresh database").disabled).toBe(true);
  button("Retry same change").click();
  await waitFor("Viewing deleted from the journal");
  const calls = transport.calls.filter((call) =>
    call.type.endsWith("/journal/delete"),
  );
  expect(calls).toHaveLength(2);
  expect(calls[0]).toEqual(calls[1]);
  expect(calls[0]).toMatchObject({
    viewing_id: record().id,
    expected_revision: 2,
  });
  expect(transport.deletedRecords).toHaveLength(1);
  expect(text()).toContain("Deleted");
});

it("keeps multi-selection for purge and disables a single-entry delete for multiple or deleted records", async () => {
  transport.deletedRecords = [
    record({ id: "fictional-deleted", deleted_at: "2026-10-26T01:00:00Z" }),
  ];
  await mount("kaleidescape-advanced");
  const boxes = [
    ...root().querySelectorAll<HTMLInputElement>(".entry-list input"),
  ];
  for (const box of boxes.slice(0, 2)) {
    box.checked = true;
    box.dispatchEvent(new Event("change", { bubbles: true }));
  }
  await flush();
  expect(button("Delete entry").disabled).toBe(true);
  button("Purge entry").click();
  await flush();
  expect(root().querySelector<HTMLDialogElement>("#purge-dialog")!.open).toBe(
    true,
  );
  expect(button("Purge selected (2)").disabled).toBe(false);
  button("Cancel purge").click();
  await flush();
  for (const box of boxes) {
    box.checked = box === boxes.at(-1);
    box.dispatchEvent(new Event("change", { bubbles: true }));
  }
  await flush();
  expect(button("Delete entry").disabled).toBe(true);
});

it("preserves a dirty viewing when import navigation or table navigation is cancelled", async () => {
  await mount("kaleidescape-advanced");
  root().querySelector<HTMLButtonElement>(".entry-name")!.click();
  await flush();
  input("notes", "Keep this draft");
  await flush();
  vi.mocked(window.confirm).mockReturnValue(false);
  const transfers = root().querySelector<KaleidescapeTransfers>(
    "kaleidescape-transfers",
  )!;
  await transfers.updateComplete;
  [...transfers.shadowRoot!.querySelectorAll("button")]
    .find((button) => button.textContent!.trim() === "Import")!
    .click();
  await transfers.updateComplete;
  expect(
    transfers.shadowRoot!.querySelector<HTMLDialogElement>("dialog")!.open,
  ).toBe(false);
  root().querySelector<HTMLButtonElement>("#table-sessions")!.click();
  await flush();
  expect(
    root().querySelector<HTMLTextAreaElement>('[name="notes"]')!.value,
  ).toBe("Keep this draft");
  expect(
    root().querySelector("#table-viewings")!.getAttribute("aria-selected"),
  ).toBe("true");
});

it("cancels inline settings changes through the original HA options flow", async () => {
  await mount("kaleidescape-settings");
  input("minimum_runtime_minutes", "10");
  expect((element as KaleidescapeSettings).confirmNavigation()).toBe(true);
  expect(window.confirm).not.toHaveBeenCalled();
  input("minimum_runtime_minutes", "20");
  button("Cancel changes").click();
  await flush();
  expect(
    transport.calls.some((call) => call.type.endsWith("/settings/cancel")),
  ).toBe(true);
  expect(
    transport.calls.some((call) => call.type.endsWith("/settings/submit")),
  ).toBe(false);
  expect(
    root().querySelector<HTMLInputElement>('[name="minimum_runtime_minutes"]')!
      .value,
  ).toBe("10");
});

it("uses table tabs and an inline selection list with a separate editable detail pane", async () => {
  await mount("kaleidescape-advanced");
  expect(root().querySelector('select[name="database_table"]')).toBeNull();
  expect(root().querySelectorAll('[role="tab"]')).toHaveLength(12);
  expect(
    root().querySelector("ul.entry-list li input + button"),
  ).not.toBeNull();
  expect(root().querySelector("ul details")).toBeNull();
  const title = [
    ...root().querySelectorAll<HTMLButtonElement>(".entry-name"),
  ].find((button) => button.textContent?.includes("The Lantern Voyage"))!;
  title.click();
  await flush();
  expect(
    root().querySelector('[aria-label="Selected database entry"]')!.textContent,
  ).toContain("Edit viewing");
  input("notes", "A correction from Advanced");
  root()
    .querySelector("form.editor")!
    .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  await waitFor("Viewing saved.");
  const update = transport.calls.find((call) =>
    call.type.endsWith("/database/update"),
  )!;
  expect(update.patch).toEqual({ notes: "A correction from Advanced" });
  expect(update.expected_revision).toBe(2);
  const session = root().querySelector<HTMLButtonElement>("#table-sessions")!;
  session.click();
  await flush();
  expect(transport.calls.at(-1)).toMatchObject({
    table: "sessions",
    offset: 0,
  });
  expect(root().querySelector("form.editor")).toBeNull();
});

it("locks an uncertain edit to its original UUID and retains conflicting drafts", async () => {
  await mount("kaleidescape-advanced");
  root().querySelector<HTMLButtonElement>(".entry-name")!.click();
  await flush();
  input("notes", "One edit only");
  const original = transport.callWS.bind(transport);
  let interrupt = true;
  vi.spyOn(transport, "callWS").mockImplementation(
    async <T>(message: ApiMessage) => {
      const result = await original<T>(message);
      if (interrupt && message.type.endsWith("/database/update")) {
        interrupt = false;
        throw new ApiError("connection_lost");
      }
      return result;
    },
  );
  root()
    .querySelector("form.editor")!
    .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  await waitFor("Retry same change");
  expect(root().querySelector("fieldset")!.disabled).toBe(true);
  button("Retry same change").click();
  await waitFor("Viewing saved.");
  const calls = transport.calls.filter((call) =>
    call.type.endsWith("/database/update"),
  );
  expect(calls).toHaveLength(2);
  expect(calls[0]).toEqual(calls[1]);
});
it("requires a distinct purge-all confirmation and retries lost responses with the exact UUID and payload", async () => {
  await mount("kaleidescape-advanced");
  const original = transport.callWS.bind(transport);
  let interrupt = true;
  vi.spyOn(transport, "callWS").mockImplementation(
    async <T>(message: ApiMessage) => {
      const result = await original<T>(message);
      if (interrupt && message.type.endsWith("/database/purge")) {
        interrupt = false;
        throw new ApiError("connection_lost");
      }
      return result;
    },
  );
  button("Purge entry").click();
  await flush();
  button("Purge all entries").click();
  await flush();
  await confirmPurge("PURGE");
  expect(transport.records).toHaveLength(3);
  await confirmPurge("PURGE ALL");
  await waitFor("Retry same purge");
  expect(transport.records).toHaveLength(0);
  expect(button("Refresh database").disabled).toBe(true);
  button("Retry same purge").click();
  await waitFor("Permanently purged 3 entries");
  const calls = transport.calls.filter((call) =>
    call.type.endsWith("/database/purge"),
  );
  expect(calls).toHaveLength(2);
  expect(calls[0]).toEqual(calls[1]);
});
it("preserves data on stale purge conflicts and allows a fresh inspection", async () => {
  await mount("kaleidescape-advanced");
  button("Purge entry").click();
  await flush();
  button("Purge all entries").click();
  await flush();
  transport.revision++;
  await confirmPurge("PURGE ALL");
  await waitFor("changed elsewhere");
  expect(transport.records).toHaveLength(3);
  expect(text()).not.toContain("Retry same purge");
  button("Cancel purge").click();
  await flush();
  button("Refresh database").click();
  await flush();
  expect(text()).toContain("Dataset revision 6");
});
it("clears raw details on denial and ignores inspection results after connection changes", async () => {
  await mount("kaleidescape-advanced");
  let resolve!: (page: DatabasePage) => void;
  vi.spyOn(transport, "callWS").mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  button("Refresh database").click();
  await flush();
  element.client = new FixtureTransport().client();
  await flush();
  resolve({
    table: "viewings",
    tables: { viewings: 1 },
    items: [{ title: "Stale private content" }],
    revision: 5,
    offset: 0,
    has_more: false,
    limit: 25,
    total: 1,
    columns: ["title"],
    sort: "title",
    query: "",
    descending: false,
  });
  await flush();
  expect(text()).not.toContain("Stale private content");
  const denied = new FixtureTransport();
  denied.failure = "unauthorized";
  element.client = denied.client();
  await waitFor("Access to this operation is denied");
  expect(text()).not.toContain("The Lantern Voyage");
});
