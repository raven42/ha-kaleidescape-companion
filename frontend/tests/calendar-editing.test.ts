/** Calendar editing delegates to the same revisioned Journal mutation flow. */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import "../src/ui/panel";
import type { KaleidescapePanel } from "../src/ui/panel";
import type { KaleidescapeReader } from "../src/ui/reader";
import type { JournalCalendar } from "../src/ui/journal-calendar";
import type { ApiMessage, Viewing } from "../src/core/api";
import { ApiError } from "../src/core/api";
import { FixtureTransport } from "./fixture";

let panel: KaleidescapePanel | KaleidescapeReader;
let transport: FixtureTransport;
let calendar: JournalCalendar;
const root = () => panel.shadowRoot!;
const calendarRoot = () => calendar.shadowRoot!;
const button = (root: ParentNode, label: string) =>
  [...root.querySelectorAll<HTMLButtonElement>("button")].find(
    (node) => node.textContent?.trim() === label,
  )!;
const editor = () =>
  root().querySelector<HTMLDialogElement>("#journal-editor")!;
const deletion = () =>
  root().querySelector<HTMLDialogElement>("#journal-delete")!;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 30, 12));
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.spyOn(HTMLFormElement.prototype, "reportValidity").mockReturnValue(true);
  window.confirm = vi.fn(() => true);
});
afterEach(() => {
  panel?.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function mount(tag = "kaleidescape-panel") {
  transport = new FixtureTransport();
  transport.journalPreferences.view = "calendar";
  panel = document.createElement(tag) as KaleidescapePanel | KaleidescapeReader;
  panel.client = transport.client();
  document.body.append(panel);
  await vi.waitFor(() =>
    expect(
      root().querySelector("kaleidescape-journal-calendar"),
    ).not.toBeNull(),
  );
  calendar = root().querySelector(
    "kaleidescape-journal-calendar",
  ) as JournalCalendar;
  await vi.waitFor(() =>
    expect(calendarRoot().querySelectorAll(".poster")).toHaveLength(3),
  );
  calendarRoot().querySelector<HTMLButtonElement>(".poster")!.click();
  await vi.waitFor(() =>
    expect(calendarRoot().querySelector("dialog")!.open).toBe(true),
  );
  await vi.waitFor(() =>
    expect(calendarRoot().querySelector("dialog")!.textContent).toContain(
      "No linked Library metadata",
    ),
  );
}
async function edit() {
  button(calendarRoot(), "Edit viewing").click();
  await vi.waitFor(() => expect(editor().open).toBe(true));
}
function input(name: string, value: string) {
  const field = editor().querySelector<HTMLInputElement>(`[name="${name}"]`)!;
  field.value = value;
  field.dispatchEvent(new Event("input"));
}
function save() {
  editor()
    .querySelector("form")!
    .dispatchEvent(new Event("submit", { cancelable: true }));
}

it("refetches the exact current viewing and saves only changed fields while retaining the calendar month", async () => {
  await mount();
  transport.records[0].revision = 7;
  await edit();
  expect(calendarRoot().querySelector("dialog")!.open).toBe(false);
  expect(
    editor().querySelector<HTMLInputElement>('[name="title"]')!.value,
  ).toBe("The Lantern Voyage");
  input("watched_seconds", "85.50");
  save();
  await vi.waitFor(() => expect(root().textContent).toContain("Entry saved."));
  expect(editor().open).toBe(false);
  const update = transport.calls.find((call) =>
    call.type.endsWith("journal/update"),
  )!;
  expect(update).toMatchObject({
    viewing_id: transport.records[0].id,
    expected_revision: 7,
    patch: { watched_seconds: 5130 },
  });
  expect(Object.keys(update.patch as object)).toEqual(["watched_seconds"]);
  expect(calendarRoot().textContent).toContain("October 2026");
  await vi.waitFor(() =>
    expect(calendarRoot().querySelectorAll(".poster")).toHaveLength(3),
  );
  calendarRoot().querySelector<HTMLButtonElement>(".poster")!.click();
  await vi.waitFor(() =>
    expect(calendarRoot().querySelector("dialog")!.textContent).toContain(
      "85.50",
    ),
  );
});

it("confirms a recoverable deletion from inside the shared editor and refreshes the month", async () => {
  await mount();
  const original = structuredClone(transport.records[0]);
  await edit();
  button(editor(), "Delete entry").click();
  await vi.waitFor(() => expect(deletion().open).toBe(true));
  expect(deletion().textContent?.replace(/\s+/g, " ")).toContain(
    "does not permanently erase",
  );
  expect(transport.records).toHaveLength(3);
  button(deletion(), "Keep entry").click();
  await vi.waitFor(() => expect(deletion().open).toBe(false));
  expect(editor().open).toBe(true);
  button(editor(), "Delete entry").click();
  await vi.waitFor(() => expect(deletion().open).toBe(true));
  button(deletion(), "Confirm deletion").click();
  await vi.waitFor(() =>
    expect(root().textContent).toContain("Entry removed from the journal"),
  );
  expect(transport.deletedRecords).toEqual([
    { ...original, deleted_at: expect.any(String) },
  ]);
  expect(transport.records).toHaveLength(2);
  await vi.waitFor(() =>
    expect(calendarRoot().querySelectorAll(".poster")).toHaveLength(2),
  );
  expect(editor().open).toBe(false);
  expect(deletion().open).toBe(false);
  expect(
    transport.calls.filter((call) => call.type.endsWith("journal/delete")),
  ).toHaveLength(1);
  expect(
    transport.calls.some((call) =>
      /database\/(purge|delete|mutate)/.test(call.type),
    ),
  ).toBe(false);
});

it("preserves a conflict draft and blocks dismissal of an uncertain deletion until retry", async () => {
  await mount();
  await edit();
  input("notes", "Keep the correction");
  transport.records[0].revision++;
  save();
  await vi.waitFor(() =>
    expect(editor().textContent).toContain("changed elsewhere"),
  );
  expect(editor().querySelector<HTMLTextAreaElement>("textarea")!.value).toBe(
    "Keep the correction",
  );
  button(editor(), "Reload entry").click();
  await vi.waitFor(() =>
    expect(editor().querySelector<HTMLTextAreaElement>("textarea")!.value).toBe(
      transport.records[0].notes,
    ),
  );
  const original = transport.callWS.bind(transport);
  let interrupt = true;
  vi.spyOn(transport, "callWS").mockImplementation(
    async <T>(message: ApiMessage) => {
      const result = await original<T>(message);
      if (interrupt && message.type.endsWith("journal/delete")) {
        interrupt = false;
        throw new ApiError("connection_lost");
      }
      return result;
    },
  );
  button(editor(), "Delete entry").click();
  await vi.waitFor(() => expect(deletion().open).toBe(true));
  button(deletion(), "Confirm deletion").click();
  await vi.waitFor(() =>
    expect(deletion().textContent).toContain("Retry same change"),
  );
  const cancel = new Event("cancel", { cancelable: true });
  deletion().dispatchEvent(cancel);
  expect(cancel.defaultPrevented).toBe(true);
  button(deletion(), "Retry same change").click();
  await vi.waitFor(() =>
    expect(root().textContent).toContain("Entry removed from the journal"),
  );
  const deletes = transport.calls.filter((call) =>
    call.type.endsWith("journal/delete"),
  );
  expect(deletes).toHaveLength(2);
  expect(deletes[0]).toEqual(deletes[1]);
  expect(transport.deletedRecords).toHaveLength(1);
});

it("clears a pending administrator edit read when the connection changes", async () => {
  await mount();
  const original = transport.callWS.bind(transport);
  let release!: (viewing: Viewing) => void;
  vi.spyOn(transport, "callWS").mockImplementation(
    <T>(message: ApiMessage): Promise<T> => {
      if (message.type.endsWith("journal/get"))
        return new Promise((resolve) => {
          release = resolve as (viewing: Viewing) => void;
        });
      return original<T>(message);
    },
  );
  button(calendarRoot(), "Edit viewing").click();
  await vi.waitFor(() => expect(release).toBeDefined());
  panel.client = new FixtureTransport().client();
  await panel.updateComplete;
  release({ ...transport.records[0], title: "Stale private record" });
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(root().textContent).not.toContain("Stale private record");
  expect(
    root().querySelector<HTMLDialogElement>("#journal-editor")?.open ?? false,
  ).toBe(false);
});

it("leaves the household calendar read-only with no editor fetches or delete controls", async () => {
  await mount("kaleidescape-reader");
  expect(button(calendarRoot(), "Edit viewing")).toBeUndefined();
  expect(root().querySelector("#journal-editor, #journal-delete")).toBeNull();
  expect(
    transport.calls.some((call) =>
      /journal\/(get|sessions|update|delete)$/.test(call.type),
    ),
  ).toBe(false);
});
