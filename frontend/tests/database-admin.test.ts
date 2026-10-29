import { afterEach, beforeEach, expect, it, vi } from "vitest";
import "../src/ui/database";
import type { KaleidescapeDatabase } from "../src/ui/database";
import type { DatabaseSearch } from "../src/ui/database-query";
import { ApiError } from "../src/core/api";
import { FixtureTransport, info, record } from "./fixture";
let element: KaleidescapeDatabase;
let transport: FixtureTransport;
const root = () => element.shadowRoot!;
const button = (label: string) =>
  [...root().querySelectorAll<HTMLButtonElement>("button")].find(
    (node) => node.textContent?.trim() === label,
  )!;
async function flush() {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await element?.updateComplete;
}
function input(name: string, value: string) {
  const field = root().querySelector<HTMLInputElement | HTMLTextAreaElement>(
    `[name="${name}"]`,
  )!;
  field.value = value;
  field.dispatchEvent(new Event("input", { bubbles: true }));
}
async function mount() {
  element = document.createElement(
    "kaleidescape-database",
  ) as KaleidescapeDatabase;
  element.client = transport.client();
  element.scope = { ...info, tracking_enabled: true };
  document.body.append(element);
  await vi.waitFor(() =>
    expect(root().textContent).toContain("The Lantern Voyage"),
  );
}
async function choose() {
  [...root().querySelectorAll<HTMLButtonElement>(".entry-name")]
    .find((node) => node.textContent?.trim() === record().title)!
    .click();
  await flush();
}
async function edit() {
  await choose();
  button("Edit entry").click();
  await flush();
}
async function confirm() {
  root().querySelector<HTMLInputElement>('[name="confirm_edit"]')!.click();
  await flush();
  button("Save changes").click();
  await flush();
}
beforeEach(() => {
  transport = new FixtureTransport();
  window.confirm = vi.fn(() => true);
});
afterEach(() => {
  element?.remove();
  vi.restoreAllMocks();
});

it("shows raw details first and edits only supported fields after explicit confirmation", async () => {
  await mount();
  await choose();
  expect(root().querySelector<HTMLDialogElement>("#database-edit")!.open).toBe(
    false,
  );
  expect(
    root().querySelector('[aria-label="Selected database entry"] pre')!
      .textContent,
  ).toContain(record().id);
  button("Edit entry").click();
  await flush();
  expect(root().querySelector<HTMLDialogElement>("#database-edit")!.open).toBe(
    true,
  );
  expect(root().querySelector('#database-edit [name="id"]')).toBeNull();
  input("notes", "Administrator correction");
  await confirm();
  await vi.waitFor(() =>
    expect(transport.records[0].notes).toBe("Administrator correction"),
  );
  const call = transport.calls.find((call) =>
    call.type.endsWith("/database/mutate"),
  )!;
  expect(call.data).toMatchObject({
    table: "viewings",
    operation: "edit",
    patch: { notes: "Administrator correction" },
    confirmation: "SAVE",
  });
  expect(root().querySelector<HTMLDialogElement>("#database-edit")!.open).toBe(
    false,
  );
});
it("permanently deletes a selected record with typed confirmation while recording remains enabled", async () => {
  await mount();
  await choose();
  button("Delete entry").click();
  await flush();
  expect(button("Confirm delete").disabled).toBe(true);
  input("delete_confirmation", "DELETE");
  await flush();
  button("Confirm delete").click();
  await flush();
  expect(transport.records.some((row) => row.id === record().id)).toBe(false);
  expect(
    transport.calls.find((call) => call.type.endsWith("/database/mutate"))!
      .data,
  ).toMatchObject({ operation: "delete", confirmation: "DELETE" });
  expect(root().querySelector("#purge-entry")).toBeNull();
});
it("locks an uncertain delete and retries its exact UUID and payload without another deletion", async () => {
  await mount();
  const original = transport.callWS.bind(transport);
  let lost = true;
  vi.spyOn(transport, "callWS").mockImplementation(async (message) => {
    const result = await original(message);
    if (lost && message.type.endsWith("/database/mutate")) {
      lost = false;
      throw new ApiError("connection_lost");
    }
    return result;
  });
  await choose();
  button("Delete entry").click();
  await flush();
  input("delete_confirmation", "DELETE");
  await flush();
  button("Confirm delete").click();
  await flush();
  expect(element.confirmNavigation()).toBe(false);
  root().querySelector<HTMLButtonElement>("#database-delete button")!;
  button("Retry same change").click();
  await flush();
  const calls = transport.calls.filter((call) =>
    call.type.endsWith("/database/mutate"),
  );
  expect(calls).toHaveLength(2);
  expect(calls[1]).toEqual(calls[0]);
  expect(transport.records).toHaveLength(2);
});
it("retains an edited draft on conflicts and blocks implicit dirty-modal dismissal", async () => {
  await mount();
  await edit();
  input("notes", "Keep this correction");
  window.confirm = vi.fn(() => false);
  button("Cancel edit").click();
  await flush();
  expect(root().querySelector<HTMLDialogElement>("#database-edit")!.open).toBe(
    true,
  );
  transport.revision++;
  await confirm();
  expect(root().textContent).toContain("changed elsewhere");
  expect(
    root().querySelector<HTMLTextAreaElement>('[name="notes"]')!.value,
  ).toBe("Keep this correction");
  expect(transport.records[0].notes).not.toBe("Keep this correction");
});
it("stores database row counts, per-table sorts and system visibility separately from Library preferences", async () => {
  await mount();
  expect(root().querySelectorAll('[role="tab"]')).toHaveLength(6);
  button("Options").click();
  await flush();
  const limit = root().querySelector<HTMLSelectElement>(
    '[name="database_limit"]',
  )!;
  limit.value = "100";
  limit.dispatchEvent(new Event("change"));
  await flush();
  const sort = root().querySelector<HTMLSelectElement>(
    '[name="database_sort"]',
  )!;
  sort.value = "title";
  sort.dispatchEvent(new Event("change"));
  await flush();
  button("Ascending ↑").click();
  await flush();
  root().querySelector<HTMLInputElement>('[name="show_system"]')!.click();
  await flush();
  expect(root().querySelectorAll('[role="tab"]')).toHaveLength(15);
  expect(transport.databasePreferences).toMatchObject({
    limit: 100,
    show_system: true,
    sorts: { viewings: { sort: "title", descending: true } },
  });
  expect(transport.uiPreferences.page_size).toBe(100);
  element.remove();
  await mount();
  expect(
    root().querySelector<HTMLSelectElement>('[name="database_limit"]')!.value,
  ).toBe("100");
  expect(root().querySelectorAll('[role="tab"]')).toHaveLength(15);
  root().querySelector<HTMLButtonElement>("#table-requests")!.click();
  await flush();
  expect(button("New Entry").disabled).toBe(true);
  expect(button("Delete entry").disabled).toBe(true);
});
it("uses scoped schema completion, validation feedback and literal/structured search submission", async () => {
  await mount();
  const search = root().querySelector(
    "kaleidescape-database-search",
  ) as DatabaseSearch;
  await search.updateComplete;
  const field = search.shadowRoot!.querySelector<HTMLInputElement>("input")!;
  field.value = "tit";
  field.setSelectionRange(3, 3);
  field.dispatchEvent(new Event("input"));
  await search.updateComplete;
  expect(search.shadowRoot!.textContent).toContain("title");
  field.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "Tab",
      bubbles: true,
      cancelable: true,
    }),
  );
  await search.updateComplete;
  expect(field.value).toBe("title ");
  field.value = "title = 'Voyage'";
  field.setSelectionRange(field.value.length, field.value.length);
  field.dispatchEvent(new Event("input"));
  field.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "Enter",
      bubbles: true,
      cancelable: true,
    }),
  );
  await flush();
  expect(
    transport.calls
      .filter((call) => call.type.endsWith("/database/inspect"))
      .at(-1),
  ).toMatchObject({ query: "title = 'Voyage'" });
  vi.spyOn(element.client!, "validateDatabaseQuery").mockRejectedValueOnce({
    code: "query_syntax",
    message: "Expected quoted text (position 9)",
  });
  field.value = "title =";
  field.dispatchEvent(new Event("input"));
  await vi.waitFor(() =>
    expect(search.shadowRoot!.textContent).toContain("Expected quoted text"),
  );
});
it("clears inspection results after denial and ignores late responses after account changes", async () => {
  await mount();
  await choose();
  transport.failure = "unauthorized";
  button("Refresh database").click();
  await flush();
  expect(root().textContent).not.toContain(record().notes);
  expect(root().querySelector("pre")).toBeNull();
});
it("creates manual viewings through the existing journal API with confirmed fields", async () => {
  await mount();
  button("New Entry").click();
  await flush();
  input("title", "A new fictional entry");
  input("started_at", "2026-10-29T12:00:00");
  await confirm();
  await vi.waitFor(() =>
    expect(
      transport.records.some((row) => row.title === "A new fictional entry"),
    ).toBe(true),
  );
  expect(
    transport.calls.some((call) => call.type.endsWith("/journal/create")),
  ).toBe(true);
});
