import { modalClose } from "./dialog-helpers";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import "../src/ui/journal-calendar";
import "../src/ui/panel";
import type { JournalCalendar } from "../src/ui/journal-calendar";
import { calendarMonth, dayKey, monthBounds } from "../src/ui/journal-calendar";
import type { JournalOptions } from "../src/ui/journal-options";
import type { KaleidescapeLibrary } from "../src/library/library";
import type { KaleidescapePanel } from "../src/ui/panel";
import type { KaleidescapeReader } from "../src/ui/reader";
import { ApiError } from "../src/core/api";
import { calendarStyles } from "../src/ui/journal-calendar.styles";
import { FixtureTransport, info, record } from "./fixture";

let calendar: JournalCalendar;
let parent: KaleidescapePanel | KaleidescapeReader | undefined;
beforeEach(() => {
  history.replaceState(null, "", "/");
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
  history.replaceState(null, "", "/");
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
  expect(root().textContent).not.toContain("No viewings match this month");
  button("Go to current month").click();
  await vi.waitFor(() => expect(posters()).toHaveLength(3));
  expect(root().textContent).toContain("October 2026");
  expect(new URLSearchParams(location.search).get("companion_month")).toBe(
    "2026-10",
  );
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
  modalClose(dialog).click();
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
    summary: { viewing_count: 1, watched_seconds: 3600 },
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

it.each(["kaleidescape-panel", "kaleidescape-reader"])(
  "temporarily shows the list for %s search and restores the preferred calendar",
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
    const root = parent.shadowRoot!;
    expect(root.querySelector(".journal-search-chip")).toBeNull();
    expect(root.querySelector(".journal-clear-search")).toBeNull();
    const month = root.querySelector("kaleidescape-journal-calendar")!;
    await vi.waitFor(() =>
      expect(
        month.shadowRoot!.querySelector<HTMLButtonElement>(
          '[aria-label="Next month"]',
        )?.disabled,
      ).toBe(false),
    );
    month
      .shadowRoot!.querySelector<HTMLButtonElement>(
        '[aria-label="Next month"]',
      )!
      .click();
    await vi.waitFor(() =>
      expect(month.shadowRoot!.textContent).toContain("November 2026"),
    );
    const options = root.querySelector("kaleidescape-journal-options")!;
    options.dispatchEvent(
      new CustomEvent("journal-status", { detail: "partial" }),
    );
    await vi.waitFor(() =>
      expect(
        root.querySelector<HTMLInputElement>('input[name="search"]')!.disabled,
      ).toBe(false),
    );
    const input = root.querySelector<HTMLInputElement>('input[name="search"]')!;
    input.value = "Lantern";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input
      .closest("form")!
      .dispatchEvent(new Event("submit", { cancelable: true }));
    await vi.waitFor(() =>
      expect(root.querySelector(".entries-layout")).not.toBeNull(),
    );
    await vi.waitFor(() =>
      expect(
        root.querySelector<HTMLButtonElement>(".journal-clear-search")!
          .disabled,
      ).toBe(false),
    );
    expect(root.querySelector("kaleidescape-journal-calendar")).toBeNull();
    expect(root.querySelector(".journal-search-chip")!.textContent).toContain(
      "Lantern",
    );
    expect(transport.journalPreferences.view).toBe("calendar");
    root.querySelector<HTMLButtonElement>(".journal-search-chip")!.click();
    await vi.waitFor(() =>
      expect(
        root.querySelector("kaleidescape-journal-calendar"),
      ).not.toBeNull(),
    );
    expect(
      root.querySelector("kaleidescape-journal-calendar")!.shadowRoot!
        .textContent,
    ).toContain("November 2026");
    expect(root.querySelector(".journal-search-chip")).toBeNull();
    expect(root.querySelector(".journal-clear-search")).toBeNull();
    expect(transport.journalPreferences.view).toBe("calendar");
    expect(
      transport.calls
        .filter((call) => call.type.endsWith("journal/list"))
        .at(-1),
    ).toMatchObject({ query: "", status: "partial" });
  },
);

it.each(["kaleidescape-panel", "kaleidescape-reader"])(
  "keeps the selected list view when clearing a %s search",
  async (tag) => {
    const transport = new FixtureTransport();
    transport.journalPreferences.view = "list";
    parent = document.createElement(tag) as
      KaleidescapePanel | KaleidescapeReader;
    parent.client = transport.client();
    document.body.append(parent);
    await vi.waitFor(() =>
      expect(
        parent!.shadowRoot!.querySelector(".entries-layout"),
      ).not.toBeNull(),
    );
    const root = parent.shadowRoot!;
    const input = root.querySelector<HTMLInputElement>('input[name="search"]')!;
    input.value = "Lantern";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input
      .closest("form")!
      .dispatchEvent(new Event("submit", { cancelable: true }));
    await vi.waitFor(() =>
      expect(
        root.querySelector<HTMLButtonElement>(".journal-clear-search")
          ?.disabled,
      ).toBe(false),
    );
    root.querySelector<HTMLButtonElement>(".journal-clear-search")!.click();
    await vi.waitFor(() =>
      expect(root.querySelector(".journal-clear-search")).toBeNull(),
    );
    expect(root.querySelector(".entries-layout")).not.toBeNull();
    expect(root.querySelector("kaleidescape-journal-calendar")).toBeNull();
    expect(transport.journalPreferences.view).toBe("list");
  },
);

it.each(["kaleidescape-panel", "kaleidescape-reader"])(
  "switches %s to list results after a mobile calendar search",
  async (tag) => {
    const transport = new FixtureTransport();
    transport.journalPreferences.view = "calendar";
    parent = document.createElement(tag) as
      KaleidescapePanel | KaleidescapeReader;
    parent.client = transport.client();
    document.body.append(parent);
    await vi.waitFor(() =>
      expect(
        parent!.shadowRoot!.querySelector("kaleidescape-journal-shortcuts"),
      ).not.toBeNull(),
    );
    const root = parent.shadowRoot!;
    const shortcuts = root.querySelector("kaleidescape-journal-shortcuts")!;
    shortcuts
      .shadowRoot!.querySelector<HTMLButtonElement>(
        '[aria-label="Search Journal"]',
      )!
      .click();
    await vi.waitFor(() =>
      expect(shortcuts.shadowRoot!.querySelector("dialog")!.open).toBe(true),
    );
    const input = shortcuts.shadowRoot!.querySelector<HTMLInputElement>(
      '[name="journal_mobile_search"]',
    )!;
    input.value = "Quiet";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input
      .closest("form")!
      .dispatchEvent(new Event("submit", { cancelable: true }));
    await vi.waitFor(() =>
      expect(root.querySelector(".journal-search-chip")?.textContent).toContain(
        "Quiet",
      ),
    );
    expect(root.querySelector(".entries-layout")).not.toBeNull();
    await vi.waitFor(() =>
      expect(
        root.querySelector<HTMLButtonElement>(".journal-search-chip")!.disabled,
      ).toBe(false),
    );
    root.querySelector<HTMLButtonElement>(".journal-search-chip")!.click();
    await vi.waitFor(() =>
      expect(
        root.querySelector("kaleidescape-journal-calendar"),
      ).not.toBeNull(),
    );
  },
);

it("resizes day rows without reloading month data and fits different week counts to the available height", async () => {
  const transport = await mount();
  const grid = root().querySelector<HTMLElement>(".month-grid")!;
  const reads = () =>
    transport.calls.filter((call) => call.type.endsWith("journal/calendar"))
      .length;
  calendar.daySize = 90;
  await calendar.updateComplete;
  expect(grid.style.getPropertyValue("--calendar-day-size")).toBe("90px");
  expect(reads()).toBe(1);
  vi.spyOn(calendar, "getBoundingClientRect").mockReturnValue({
    top: 200,
  } as DOMRect);
  vi.spyOn(window, "innerHeight", "get").mockReturnValue(1000);
  calendar.fitScreen = true;
  await vi.waitFor(() =>
    expect(grid.style.getPropertyValue("--calendar-day-size")).toBe("156px"),
  );
  // August 2026 takes six weeks, compared with five for October.
  button("Previous month").click();
  await vi.waitFor(() =>
    expect(root().textContent).toContain("September 2026"),
  );
  button("Previous month").click();
  await vi.waitFor(() =>
    expect(root().querySelectorAll(".day")).toHaveLength(42),
  );
  await vi.waitFor(() =>
    expect(grid.style.getPropertyValue("--calendar-day-size")).toBe("130px"),
  );
  calendar.fitScreen = false;
  await calendar.updateComplete;
  expect(grid.style.getPropertyValue("--calendar-day-size")).toBe("90px");
});

it.each([
  ["Fictional Actor", "query", "Fictional Actor"],
  ["Fictional Director", "query", "Fictional Director"],
  ["Science Fiction", "genre", "Science Fiction"],
  ["2025", "year", "2025"],
  ["PG", "rating", "PG"],
  ["4K", "format", "4K"],
  ["The Lantern Voyage", "query", "The Lantern Voyage"],
])(
  "routes a compact-detail %s link to fresh Library criteria",
  async (label, key, value) => {
    const transport = new FixtureTransport();
    transport.viewingLinks.set(
      transport.records[0].id,
      transport.libraryTitles[0].id,
    );
    await mount(transport);
    const navigate = vi.fn();
    calendar.addEventListener("browse-library", navigate);
    posters()[0].click();
    await vi.waitFor(() =>
      expect(root().querySelector("dialog")!.textContent).toContain(
        "Fictional Actor",
      ),
    );
    const link = [
      ...root().querySelectorAll<HTMLButtonElement>("dialog button"),
    ].find((node) => node.textContent?.trim() === label)!;
    link.click();
    expect(navigate.mock.calls[0][0].detail).toEqual({
      key,
      value: key === "query" ? JSON.stringify(value) : value,
    });
    expect(root().querySelector("dialog")!.open).toBe(false);
  },
);

it.each(["kaleidescape-panel", "kaleidescape-reader"])(
  "opens Library with replaced and saved criteria in %s",
  async (tag) => {
    const transport = new FixtureTransport();
    transport.options.library_enabled = true;
    transport.journalPreferences.view = "calendar";
    transport.uiPreferences.query = "Old search";
    transport.uiPreferences.genre = ["Old genre"];
    transport.uiPreferences.rating = ["R"];
    transport.viewingLinks.set(
      transport.records[0].id,
      transport.libraryTitles[0].id,
    );
    parent = document.createElement(tag) as
      KaleidescapePanel | KaleidescapeReader;
    parent.client = transport.client();
    document.body.append(parent);
    await vi.waitFor(() =>
      expect(
        parent!.shadowRoot!.querySelector("kaleidescape-journal-calendar"),
      ).not.toBeNull(),
    );
    calendar = parent.shadowRoot!.querySelector(
      "kaleidescape-journal-calendar",
    ) as JournalCalendar;
    await vi.waitFor(() => expect(posters()).toHaveLength(3));
    posters()[0].click();
    await vi.waitFor(() =>
      expect(root().querySelector("dialog")!.textContent).toContain(
        "Science Fiction",
      ),
    );
    [...root().querySelectorAll<HTMLButtonElement>("dialog button")]
      .find((node) => node.textContent?.trim() === "Science Fiction")!
      .click();
    await vi.waitFor(() =>
      expect(
        parent!.shadowRoot!.querySelector("kaleidescape-library"),
      ).not.toBeNull(),
    );
    const library = parent.shadowRoot!.querySelector(
      "kaleidescape-library",
    ) as KaleidescapeLibrary;
    await vi.waitFor(() =>
      expect(transport.uiPreferences.genre).toEqual(["Science Fiction"]),
    );
    expect(transport.uiPreferences.query).toBe("");
    expect(transport.uiPreferences.rating).toEqual([]);
    expect(
      library.shadowRoot!.querySelector<HTMLInputElement>(
        '[name="library_query"]',
      )!.value,
    ).toBe("");
    expect(
      transport.calls
        .filter((call) => call.type.endsWith("library/list"))
        .at(-1)!.filters,
    ).toMatchObject({ query: "", genre: ["Science Fiction"], offset: 0 });
    expect(location.search).not.toContain("Science");
    expect(
      transport.calls.some((call) =>
        /library\/sync$|journal\/create$/.test(call.type),
      ),
    ).toBe(false);
  },
);

it("restores a valid month from the URL, preserves other parameters and rejects invalid months", async () => {
  expect(
    calendarMonth("?companion_month=2026-00", new Date(2026, 9, 1)).getMonth(),
  ).toBe(9);
  expect(
    calendarMonth(
      "?companion_month=0001-01",
      new Date(2026, 9, 1),
    ).getFullYear(),
  ).toBe(2026);
  history.replaceState(
    null,
    "",
    "/?companion_page=journal&companion_month=2026-08",
  );
  await mount();
  expect(root().textContent).toContain("August 2026");
  button("Next month").click();
  await calendar.updateComplete;
  expect(new URL(location.href).searchParams.get("companion_month")).toBe(
    "2026-09",
  );
  expect(new URL(location.href).searchParams.get("companion_page")).toBe(
    "journal",
  );
  calendar.remove();
  await mount();
  expect(root().textContent).toContain("September 2026");
});

it.each(["kaleidescape-panel", "kaleidescape-reader"])(
  "keeps selected-month totals and every calendar status message in the sticky footer in %s",
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
    calendar = parent.shadowRoot!.querySelector(
      "kaleidescape-journal-calendar",
    ) as JournalCalendar;
    const footer = () => parent!.shadowRoot!.querySelector("footer")!;
    await vi.waitFor(() =>
      expect(footer().textContent?.replace(/\s+/g, " ")).toContain(
        "October 2026 3",
      ),
    );
    expect(footer().textContent?.replace(/\s+/g, " ")).toContain(
      "Selected Month 3h 48m",
    );
    button("Next month").click();
    await vi.waitFor(() =>
      expect(footer().textContent?.replace(/\s+/g, " ")).toContain(
        "November 2026 0",
      ),
    );
    expect(footer().textContent?.replace(/\s+/g, " ")).toContain(
      "Selected Month 0h 0m",
    );
    expect(footer().textContent).toContain("No viewings match this month");
    expect(
      root().querySelector(
        ".month-status, p.error, [role=status], [role=alert]",
      ),
    ).toBeNull();
    const client = calendar.client!;
    vi.spyOn(client, "calendarMonth").mockRejectedValueOnce(
      new ApiError("not_ready"),
    );
    button("Next month").click();
    await vi.waitFor(() =>
      expect(footer().querySelector("[role=alert]")).not.toBeNull(),
    );
    expect(
      root().querySelector("p.error, [role=alert], [role=status]"),
    ).toBeNull();
    [...footer().querySelectorAll<HTMLButtonElement>("button")]
      .find((node) => node.textContent?.trim() === "Retry month")!
      .click();
    await vi.waitFor(() =>
      expect(footer().querySelector("[role=alert]")).toBeNull(),
    );
  },
);

it("marks an open completed viewing at its completion date", async () => {
  const { calendarDays } = await import("../src/ui/journal-calendar");
  const start = new Date(2026, 9, 31, 23, 59).toISOString();
  const completion = new Date(2026, 10, 1, 0, 1).toISOString();
  expect(
    calendarDays({
      started_at: start,
      ended_at: null,
      completed_at: completion,
      status: "completed",
    }),
  ).toEqual([
    { day: "2026-10-31", phase: "start" },
    { day: "2026-11-01", phase: "completion" },
  ]);
});
