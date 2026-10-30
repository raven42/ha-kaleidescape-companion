import { afterEach, beforeEach, expect, it, vi } from "vitest";
import "../src/ui/journal-calendar";
import "../src/ui/panel";
import type { JournalCalendar } from "../src/ui/journal-calendar";
import { dayKey, monthBounds } from "../src/ui/journal-calendar";
import type { JournalOptions } from "../src/ui/journal-options";
import type { KaleidescapePanel } from "../src/ui/panel";
import type { KaleidescapeReader } from "../src/ui/reader";
import { ApiError } from "../src/core/api";
import { calendarStyles } from "../src/ui/journal-calendar.styles";
import { FixtureTransport, info, record } from "./fixture";

let calendar: JournalCalendar;
let parent: KaleidescapePanel | KaleidescapeReader | undefined;
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
});
afterEach(() => {
  calendar?.remove();
  parent?.remove();
  parent = undefined;
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
const root = () => calendar.shadowRoot!;
const posters = () => [
  ...root().querySelectorAll<HTMLButtonElement>(".poster"),
];
const button = (label: string) =>
  root().querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)!;
async function mount(transport = new FixtureTransport(), enabled = true) {
  transport.options.library_enabled = enabled;
  calendar = document.createElement(
    "kaleidescape-journal-calendar",
  ) as JournalCalendar;
  calendar.client = transport.client();
  calendar.scope = { ...info, library_enabled: enabled };
  document.body.append(calendar);
  await vi.waitFor(() =>
    expect(root().querySelector(".month-grid")?.getAttribute("aria-busy")).toBe(
      "false",
    ),
  );
  return transport;
}

it("browses complete local months, applies filters, and stacks same-day viewings with accessible foreground rules", async () => {
  const transport = await mount();
  expect(posters()).toHaveLength(3);
  expect(root().querySelectorAll(".day")).toHaveLength(35);
  const stack = root().querySelector(".cover-stack")!;
  expect(stack.getAttribute("style")).toBe("--spread:1.3");
  expect(posters()[1].getAttribute("style")).toBe("--index:1;--layer:2");
  expect(calendarStyles.cssText).toContain("15%");
  expect(calendarStyles.cssText).toMatch(
    /\.poster:hover,\s*\.poster:focus-visible\s*\{\s*z-index: 1100/,
  );
  const monthCall = transport.calls.find((call) =>
    call.type.endsWith("journal/calendar"),
  )!;
  const bounds = monthBounds(new Date(2026, 9, 1));
  expect([monthCall.start, monthCall.end]).toEqual(bounds);
  button("Next month").click();
  await vi.waitFor(() => expect(root().textContent).toContain("November 2026"));
  await vi.waitFor(() => expect(posters()).toHaveLength(0));
  expect(root().textContent).toContain("No viewings match this month");
  button("Previous month").click();
  await vi.waitFor(() => expect(posters()).toHaveLength(3));
  calendar.status = "partial";
  calendar.query = "Quiet";
  calendar.fuzzy = false;
  await vi.waitFor(() => expect(posters()).toHaveLength(1));
  expect(posters()[0].getAttribute("aria-label")).toContain(
    "A Map of Quiet Places",
  );
  expect(transport.calls.at(-1)).toMatchObject({
    status: "partial",
    query: "Quiet",
    fuzzy: false,
  });
});

it("opens compact combined movie and viewing details for the chosen poster without purchase or detection data", async () => {
  const transport = new FixtureTransport();
  const movie = transport.libraryTitles[0];
  transport.viewingLinks.set(transport.records[0].id, movie.id);
  movie.formats = ["4K", "HDR10", "Dolby Vision"];
  movie.artwork_key = "d".repeat(64);
  await mount(transport);
  posters()[0].click();
  await vi.waitFor(() =>
    expect(root().querySelector("dialog")!.textContent).toContain(
      "Fictional Actor",
    ),
  );
  const dialog = root().querySelector("dialog")!;
  expect(dialog.open).toBe(true);
  for (const text of [
    "The Lantern Voyage",
    "Fictional Director",
    "Science Fiction",
    "2025",
    "PG",
    "HDR10",
    "120.00",
    "110.00",
    "Viewing date:",
  ])
    expect(dialog.textContent).toContain(text);
  expect(dialog.querySelector("kaleidescape-library-cover")).not.toBeNull();
  expect(dialog.textContent).not.toMatch(
    /Purchase|Detected|First detected|fictional viewing for interface testing|fictional-source/,
  );
  expect(dialog.querySelector("textarea, input, form")).toBeNull();
  dialog.querySelector<HTMLButtonElement>("button")!.click();
  await calendar.updateComplete;
  expect(dialog.open).toBe(false);
  expect(dialog.textContent).not.toContain("Fictional Actor");
  posters()[1].click();
  await vi.waitFor(() =>
    expect(dialog.textContent).toContain("A Map of Quiet Places"),
  );
  await vi.waitFor(() =>
    expect(dialog.textContent).toContain("No linked Library metadata"),
  );
  dialog.dispatchEvent(new MouseEvent("click", { clientX: -1, clientY: -1 }));
  expect(dialog.open).toBe(false);
});

it("shows a date range only for a viewing ending on another local day", async () => {
  const transport = new FixtureTransport();
  transport.records = [
    record({
      started_at: new Date(2026, 9, 24, 23).toISOString(),
      ended_at: new Date(2026, 9, 25, 1).toISOString(),
    }),
  ];
  await mount(transport, false);
  posters()[0].click();
  await vi.waitFor(() =>
    expect(root().querySelector("dialog")!.open).toBe(true),
  );
  const text = root().querySelector("dialog")!.textContent!;
  expect(text).toContain("Viewing dates:");
  expect(text).toContain(new Date(2026, 9, 24).toLocaleDateString());
  expect(text).toContain(new Date(2026, 9, 25).toLocaleDateString());
  expect(dayKey(new Date(2026, 9, 24, 23))).toBe("2026-10-24");
});

it("withholds late month/detail responses after navigation, dismissal and scope changes", async () => {
  const transport = await mount();
  const client = calendar.client!;
  let release!: (
    value: Awaited<ReturnType<typeof client.calendarDetails>>,
  ) => void;
  vi.spyOn(client, "calendarDetails").mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  );
  posters()[0].click();
  await vi.waitFor(() =>
    expect(root().querySelector("dialog")!.open).toBe(true),
  );
  root().querySelector<HTMLButtonElement>("dialog button")!.click();
  release({ viewing: record({ title: "Late detail" }), movie: null });
  await calendar.updateComplete;
  expect(root().textContent).not.toContain("Late detail");
  let releaseMonth!: (
    value: Awaited<ReturnType<typeof client.calendarMonth>>,
  ) => void;
  vi.spyOn(client, "calendarMonth").mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        releaseMonth = resolve;
      }),
  );
  button("Next month").click();
  await calendar.updateComplete;
  calendar.scope = { ...info, dataset_id: "different", library_enabled: false };
  await calendar.updateComplete;
  releaseMonth({
    items: [
      {
        ...record({ title: "Late private month" }),
        library_title_id: null,
        artwork_key: null,
      },
    ],
    revision: 5,
  });
  await new Promise((done) => setTimeout(done, 0));
  expect(root().textContent).not.toContain("Late private month");
  expect(
    transport.calls.some((call) => call.type.endsWith("calendar/sync")),
  ).toBe(false);
});

it("clears content and reports denied access", async () => {
  await mount();
  const denied = vi.fn();
  calendar.addEventListener("access-denied", denied);
  vi.spyOn(calendar.client!, "calendarMonth").mockRejectedValueOnce(
    new ApiError("unauthorized"),
  );
  button("Next month").click();
  await vi.waitFor(() => expect(denied).toHaveBeenCalled());
  expect(posters()).toHaveLength(0);
});

it.each(["kaleidescape-panel", "kaleidescape-reader"])(
  "restores Calendar view and switches back to the list through %s Options",
  async (tag) => {
    const transport = new FixtureTransport();
    transport.journalPreferences.view = "calendar";
    parent = document.createElement(tag) as
      KaleidescapePanel | KaleidescapeReader;
    parent.client = transport.client();
    document.body.append(parent);
    await vi.waitFor(() =>
      expect(
        parent!.shadowRoot!.querySelector("kaleidescape-journal-calendar"),
      ).not.toBeNull(),
    );
    expect(parent.shadowRoot!.querySelector(".entries-layout")).toBeNull();
    expect(
      parent.shadowRoot!.querySelector<HTMLElement>(
        ".journal-status .pagination",
      )!.hidden,
    ).toBe(true);
    const options = parent.shadowRoot!.querySelector(
      "kaleidescape-journal-options",
    ) as JournalOptions;
    options
      .shadowRoot!.querySelector<HTMLInputElement>(
        '[name="journal_calendar_view"]',
      )!
      .click();
    await vi.waitFor(() =>
      expect(
        parent!.shadowRoot!.querySelector(".entries-layout"),
      ).not.toBeNull(),
    );
    expect(transport.journalPreferences.view).toBe("list");
  },
);
