import { afterEach, expect, it, vi } from "vitest";
import "../src/library/library-journal";
import type { LibraryJournal } from "../src/library/library-journal";
import type { JournalCalendar } from "../src/ui/journal-calendar";
import { FixtureTransport, info } from "./fixture";

let element: LibraryJournal;
const scope = { ...info, library_enabled: true };
function mount(transport: FixtureTransport) {
  element = document.createElement(
    "kaleidescape-library-journal",
  ) as LibraryJournal;
  element.client = transport.client();
  element.scope = scope;
  element.titleId = transport.libraryTitles[0].id;
  document.body.append(element);
}
afterEach(() => {
  element?.remove();
  vi.restoreAllMocks();
});

it("hides Journal when a movie has no viewing entries", async () => {
  const transport = new FixtureTransport();
  mount(transport);
  await vi.waitFor(() =>
    expect(
      transport.calls.some((call) => call.type.endsWith("library/viewings")),
    ).toBe(true),
  );
  await element.updateComplete;
  expect(element.shadowRoot!.querySelector("details")).toBeNull();
  expect(element.hasAttribute("hidden")).toBe(true);
});

it("shows each viewing and opens its existing detail popup without Library crosslinks", async () => {
  const transport = new FixtureTransport();
  transport.options.library_enabled = true;
  transport.libraryGroups.set(transport.libraryTitles[0].id, "group");
  transport.libraryGroups.set(transport.libraryTitles[1].id, "group");
  transport.viewingLinks.set(
    transport.records[0].id,
    transport.libraryTitles[0].id,
  );
  transport.viewingLinks.set(
    transport.records[1].id,
    transport.libraryTitles[1].id,
  );
  mount(transport);
  await vi.waitFor(() =>
    expect(element.shadowRoot!.querySelectorAll("li")).toHaveLength(2),
  );
  const details = element.shadowRoot!.querySelector("details")!;
  expect(element.hasAttribute("hidden")).toBe(false);
  expect(details.open).toBe(false);
  details.open = true;
  element.shadowRoot!.querySelector<HTMLButtonElement>("li button")!.click();
  await vi.waitFor(() => {
    const calendar = element.shadowRoot!.querySelector(
      "kaleidescape-journal-calendar",
    ) as JournalCalendar;
    expect(
      calendar?.shadowRoot?.querySelector<HTMLDialogElement>("dialog")?.open,
    ).toBe(true);
    expect(calendar.shadowRoot!.textContent).toContain("Fictional Actor");
  });
  const calendar = element.shadowRoot!.querySelector(
    "kaleidescape-journal-calendar",
  ) as JournalCalendar;
  expect(calendar.shadowRoot!.querySelector("h2 button")).toBeNull();
  expect(calendar.shadowRoot!.querySelector("kaleidescape-library")).toBeNull();
  expect(
    transport.calls.some((call) => call.type.endsWith("journal/calendar")),
  ).toBe(false);
});

it("loads all cursor pages on expansion", async () => {
  const transport = new FixtureTransport();
  mount(transport);
  const list = vi
    .spyOn(element.client!, "list")
    .mockResolvedValueOnce({
      items: [transport.records[0]],
      revision: 1,
      next_cursor: "next",
    })
    .mockResolvedValueOnce({
      items: [transport.records[1]],
      revision: 1,
      next_cursor: null,
    });
  await vi.waitFor(() =>
    expect(element.shadowRoot!.querySelectorAll("li")).toHaveLength(1),
  );
  const details = element.shadowRoot!.querySelector("details")!;
  details.open = true;
  details.dispatchEvent(new Event("toggle"));
  await vi.waitFor(() =>
    expect(element.shadowRoot!.querySelectorAll("li")).toHaveLength(2),
  );
  expect(list).toHaveBeenCalledTimes(2);
  expect(list.mock.calls[1][3]).toBe("next");
});

it("does not show a late response after the selected title changes", async () => {
  const transport = new FixtureTransport();
  mount(transport);
  let resolve!: (
    value: Awaited<ReturnType<NonNullable<typeof element.client>["list"]>>,
  ) => void;
  vi.spyOn(element.client!, "list")
    .mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    )
    .mockResolvedValueOnce({ items: [], revision: 2, next_cursor: null });
  await element.updateComplete;
  element.titleId = transport.libraryTitles[1].id;
  await element.updateComplete;
  resolve({ items: [transport.records[0]], revision: 1, next_cursor: null });
  await Promise.resolve();
  await element.updateComplete;
  expect(element.shadowRoot!.querySelector("details")).toBeNull();
});
