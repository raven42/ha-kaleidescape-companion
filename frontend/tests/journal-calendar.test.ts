import { modalClose } from "./dialog-helpers";
import { setUnifiedMovieDialog } from "../src/ui/movie-dialog-mode";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import "../src/ui/journal-calendar";
import "../src/ui/panel";
import type { JournalCalendar } from "../src/ui/journal-calendar";
import {
  calendarMonth,
  dayKey,
  monthBounds,
  previewPosition,
} from "../src/ui/journal-calendar";
import type { JournalOptions } from "../src/ui/journal-options";
import type { KaleidescapeLibrary } from "../src/library/library";
import type { KaleidescapePanel } from "../src/ui/panel";
import type { KaleidescapeReader } from "../src/ui/reader";
import { ApiError } from "../src/core/api";
import type { JournalClient } from "../src/core/api";
import { calendarStyles } from "../src/ui/journal-calendar.styles";
import { FixtureTransport, info, record } from "./fixture";

let calendar: JournalCalendar;
let parent: KaleidescapePanel | KaleidescapeReader | undefined;

it("positions previews outside the cover at each viewport edge", () => {
  const box = { width: 320, height: 180 };
  const viewport = { left: 0, top: 0, width: 800, height: 600 };
  const right = previewPosition(
    { left: 100, right: 180, top: 100, bottom: 220 },
    box,
    viewport,
  )!;
  expect(right.side).toBe("right");
  expect(right.left).toBeGreaterThanOrEqual(188);
  const left = previewPosition(
    { left: 700, right: 780, top: 450, bottom: 570 },
    box,
    viewport,
  )!;
  expect(left.side).toBe("left");
  expect(left.left + box.width).toBeLessThanOrEqual(692);
  expect(left.top + box.height).toBeLessThanOrEqual(588);
  const narrow = { ...viewport, width: 400 };
  const below = previewPosition(
    { left: 150, right: 250, top: 20, bottom: 140 },
    box,
    narrow,
  )!;
  expect(below.side).toBe("below");
  expect(below.top).toBeGreaterThanOrEqual(148);
  const above = previewPosition(
    { left: 150, right: 250, top: 460, bottom: 580 },
    box,
    narrow,
  )!;
  expect(above.side).toBe("above");
  expect(above.top + box.height).toBeLessThanOrEqual(452);
  const constrained = previewPosition(
    { left: 140, right: 260, top: 70, bottom: 180 },
    box,
    { ...narrow, height: 250 },
  )!;
  expect(constrained.side).toMatch(/left|right/);
  expect(constrained.maxWidth).toBeLessThan(box.width);
});
beforeEach(() => {
  setUnifiedMovieDialog(false);
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

it("expands a multi-viewing day into selectable covers on touch-first screens", async () => {
  vi.spyOn(window, "matchMedia").mockReturnValue({
    matches: true,
  } as MediaQueryList);
  await mount();
  const first = posters()[0];
  first.click();
  await vi.waitFor(() =>
    expect(root().querySelector<HTMLDialogElement>(".day-picker")?.open).toBe(
      true,
    ),
  );
  const picker = root().querySelector<HTMLDialogElement>(".day-picker")!;
  const choices = [
    ...picker.querySelectorAll<HTMLButtonElement>(".day-picker-movie"),
  ];
  expect(choices).toHaveLength(3);
  expect(choices.map((choice) => choice.getAttribute("aria-label"))).toEqual([
    expect.stringContaining("The Lantern Voyage"),
    expect.stringContaining("A Map of Quiet Places"),
    expect.stringContaining("Midnight at the Observatory"),
  ]);
  expect(picker.textContent!.trim()).toBe("");
  expect(picker.querySelector("h2, p, small")).toBeNull();
  expect(
    picker.querySelectorAll(".day-picker-art kaleidescape-library-cover"),
  ).toHaveLength(3);
  expect(
    root().querySelector<HTMLDialogElement>(".calendar-dialog")!.open,
  ).toBe(false);
  choices[1].click();
  await vi.waitFor(() =>
    expect(
      root().querySelector<HTMLDialogElement>(".calendar-dialog")?.open,
    ).toBe(true),
  );
  expect(root().querySelector(".calendar-dialog h2")!.textContent).toContain(
    "A Map of Quiet Places",
  );
  expect(root().querySelector(".day-picker")).toBeNull();
});

it("opens the touch day grid from the empty part of a day and can dismiss it", async () => {
  vi.spyOn(window, "matchMedia").mockReturnValue({
    matches: true,
  } as MediaQueryList);
  await mount();
  const day = posters()[0].closest<HTMLElement>(".day")!;
  day.click();
  await vi.waitFor(() =>
    expect(root().querySelector<HTMLDialogElement>(".day-picker")?.open).toBe(
      true,
    ),
  );
  root().querySelector<HTMLElement>(".day-picker-grid")!.click();
  await vi.waitFor(() =>
    expect(root().querySelector(".day-picker")).toBeNull(),
  );
  expect(
    root().querySelector<HTMLDialogElement>(".calendar-dialog")!.open,
  ).toBe(false);
});

it("closes the cover overlay before opening the full movie dialog", async () => {
  vi.spyOn(window, "matchMedia").mockReturnValue({
    matches: true,
  } as MediaQueryList);
  setUnifiedMovieDialog(true);
  const transport = new FixtureTransport();
  transport.viewingLinks.set(
    transport.records[0].id,
    transport.libraryTitles[0].id,
  );
  await mount(transport);
  posters()[0].click();
  await vi.waitFor(() =>
    expect(root().querySelector<HTMLDialogElement>(".day-picker")?.open).toBe(
      true,
    ),
  );
  root().querySelector<HTMLButtonElement>(".day-picker-movie")!.click();
  await vi.waitFor(() =>
    expect(
      root()
        .querySelector("kaleidescape-library")
        ?.shadowRoot?.querySelector<HTMLDialogElement>("#title-dialog")?.open,
    ).toBe(true),
  );
  expect(root().querySelector(".day-picker")).toBeNull();
});

it("opens a single viewing directly on touch-first screens", async () => {
  vi.spyOn(window, "matchMedia").mockReturnValue({
    matches: true,
  } as MediaQueryList);
  const transport = new FixtureTransport();
  transport.records = [transport.records[0]];
  await mount(transport);
  posters()[0].click();
  await vi.waitFor(() =>
    expect(
      root().querySelector<HTMLDialogElement>(".calendar-dialog")?.open,
    ).toBe(true),
  );
  expect(root().querySelector(".day-picker")).toBeNull();
});

it("marks the current date for assistive technology as the visible month changes", async () => {
  await mount();
  const current = root().querySelector<HTMLTimeElement>(
    'time[aria-current="date"]',
  );
  expect(current?.getAttribute("datetime")).toBe("2026-10-30");
  expect(current?.closest(".day")?.classList.contains("today")).toBe(true);
  button("Next month").click();
  await vi.waitFor(() => expect(root().textContent).toContain("November 2026"));
  expect(root().querySelector('time[aria-current="date"]')).toBeNull();
  button("Go to current month").click();
  await vi.waitFor(() =>
    expect(
      root()
        .querySelector('time[aria-current="date"]')
        ?.getAttribute("datetime"),
    ).toBe("2026-10-30"),
  );
});

it("changes months on horizontal touch swipes without opening the swiped cover", async () => {
  await mount();
  const cover = posters()[0];
  const grid = root().querySelector<HTMLElement>(".month-grid")!;
  vi.spyOn(grid, "getBoundingClientRect").mockReturnValue(
    new DOMRect(0, 0, 700, 600),
  );
  const touch = (type: string, x: number, y: number, id = 1) =>
    new PointerEvent(type, {
      bubbles: true,
      pointerType: "touch",
      pointerId: id,
      clientX: x,
      clientY: y,
    });
  cover.dispatchEvent(touch("pointerdown", 200, 120));
  cover.dispatchEvent(touch("pointermove", 150, 122));
  expect(grid.style.transform).toBe("translateX(-50px)");
  cover.dispatchEvent(touch("pointerup", 100, 125));
  expect(grid.style.transform).toBe("translateX(-700px)");
  const click = new MouseEvent("click", {
    bubbles: true,
    cancelable: true,
    detail: 1,
  });
  cover.dispatchEvent(click);
  expect(click.defaultPrevented).toBe(true);
  await vi.waitFor(() => expect(root().textContent).toContain("November 2026"));
  expect(
    root().querySelector<HTMLDialogElement>(".calendar-dialog")!.open,
  ).toBe(false);
  await vi.waitFor(() => expect(grid.style.transition).toBe(""));
  grid.dispatchEvent(touch("pointerdown", 100, 120));
  grid.dispatchEvent(touch("pointerup", 200, 125));
  await vi.waitFor(() => expect(root().textContent).toContain("October 2026"));
  await vi.waitFor(() => expect(grid.style.transition).toBe(""));
  const tapped = posters()[0];
  tapped.dispatchEvent(touch("pointerdown", 100, 120));
  tapped.dispatchEvent(touch("pointerup", 105, 122));
  tapped.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }));
  await vi.waitFor(() =>
    expect(
      root().querySelector<HTMLDialogElement>(".calendar-dialog")!.open,
    ).toBe(true),
  );
});

it("honors reduced motion when changing months by swipe", async () => {
  vi.spyOn(window, "matchMedia").mockReturnValue({
    matches: true,
  } as MediaQueryList);
  await mount();
  const grid = root().querySelector<HTMLElement>(".month-grid")!;
  const event = (type: string, x: number) =>
    new PointerEvent(type, {
      bubbles: true,
      pointerType: "touch",
      pointerId: 1,
      clientX: x,
      clientY: 100,
    });
  grid.dispatchEvent(event("pointerdown", 200));
  grid.dispatchEvent(event("pointerup", 100));
  await calendar.updateComplete;
  expect(root().textContent).toContain("November 2026");
  expect(grid.style.transform).toBe("");
  expect(grid.style.transition).toBe("");
});

it("ignores vertical, short, cancelled, multi-touch and mouse gestures", async () => {
  await mount();
  const grid = root().querySelector(".month-grid")!;
  const pointer = (
    type: string,
    x: number,
    y: number,
    id = 1,
    pointerType = "touch",
  ) =>
    new PointerEvent(type, {
      bubbles: true,
      pointerType,
      pointerId: id,
      clientX: x,
      clientY: y,
    });
  const gesture = (
    endX: number,
    endY: number,
    end = "pointerup",
    kind = "touch",
  ) => {
    grid.dispatchEvent(pointer("pointerdown", 200, 100, 1, kind));
    grid.dispatchEvent(pointer(end, endX, endY, 1, kind));
  };
  gesture(180, 102);
  gesture(100, 240);
  gesture(100, 100, "pointercancel");
  gesture(100, 100, "pointerup", "mouse");
  grid.dispatchEvent(pointer("pointerdown", 200, 100, 1));
  grid.dispatchEvent(pointer("pointerdown", 210, 100, 2));
  grid.dispatchEvent(pointer("pointerup", 100, 100, 1));
  grid.dispatchEvent(pointer("pointerup", 110, 100, 2));
  await calendar.updateComplete;
  expect(root().textContent).toContain("October 2026");
});

it("does not swipe past the supported month range or while disabled", async () => {
  history.replaceState(null, "", "/?companion_month=9998-12");
  await mount();
  const grid = root().querySelector(".month-grid")!;
  const gesture = (start: number, end: number) => {
    grid.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        pointerType: "touch",
        pointerId: 1,
        clientX: start,
        clientY: 100,
      }),
    );
    grid.dispatchEvent(
      new PointerEvent("pointerup", {
        bubbles: true,
        pointerType: "touch",
        pointerId: 1,
        clientX: end,
        clientY: 100,
      }),
    );
  };
  gesture(200, 100);
  await calendar.updateComplete;
  expect(new URL(location.href).searchParams.get("companion_month")).toBe(
    "9998-12",
  );
  calendar.disabled = true;
  await calendar.updateComplete;
  gesture(100, 200);
  await calendar.updateComplete;
  expect(new URL(location.href).searchParams.get("companion_month")).toBe(
    "9998-12",
  );
});

it("shows an optional household-safe preview on hover and keyboard focus", async () => {
  const transport = new FixtureTransport();
  const movie = transport.libraryTitles[0];
  movie.actors = ["One", "Two", "Three", "Four", "Five", "Six"];
  movie.genres = ["Fictional genre"];
  movie.synopsis = "<img src=x> A fictional synopsis.";
  transport.viewingLinks.set(transport.records[0].id, movie.id);
  await mount(transport);
  const first = posters()[0];
  first.dispatchEvent(new Event("pointerenter"));
  await new Promise((resolve) => setTimeout(resolve, 220));
  expect(root().querySelector(".movie-preview")).toBeNull();
  expect(
    transport.calls.some((call) => call.type.endsWith("journal/calendar/get")),
  ).toBe(false);
  calendar.hoverPreview = true;
  await calendar.updateComplete;
  first.dispatchEvent(new Event("pointerenter"));
  await vi.waitFor(() =>
    expect(root().querySelector(".movie-preview")?.textContent).toContain(
      "A fictional synopsis.",
    ),
  );
  const preview = root().querySelector(".movie-preview")!;
  expect(preview.textContent).toContain("Fictional genre");
  expect(preview.textContent).toContain("One, Two, Three, Four, Five");
  expect(preview.textContent).not.toContain("Six");
  expect(preview.querySelector("img")).toBeNull();
  expect(first.getAttribute("aria-describedby")).toBe("calendar-movie-preview");
  first.dispatchEvent(new Event("pointerleave"));
  await vi.waitFor(() =>
    expect(root().querySelector(".movie-preview")).toBeNull(),
  );
  first.dispatchEvent(new Event("focus"));
  await vi.waitFor(() =>
    expect(root().querySelector(".movie-preview")?.textContent).toContain(
      "A fictional synopsis.",
    ),
  );
  window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
  await vi.waitFor(() =>
    expect(root().querySelector(".movie-preview")).toBeNull(),
  );
});

it("discards a pending preview when the option is turned off", async () => {
  await mount();
  let release!: (
    value: Awaited<ReturnType<JournalClient["calendarDetails"]>>,
  ) => void;
  const delayed = vi
    .spyOn(calendar.client!, "calendarDetails")
    .mockImplementation(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
  calendar.hoverPreview = true;
  await calendar.updateComplete;
  posters()[0].dispatchEvent(new Event("focus"));
  await vi.waitFor(() => expect(delayed).toHaveBeenCalledOnce());
  calendar.hoverPreview = false;
  await calendar.updateComplete;
  release({ viewing: record(), movie: null });
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(root().querySelector(".movie-preview")).toBeNull();
});

it.each(["full", "compact"])(
  "dismisses the preview around the %s movie dialog and restores normal hover",
  async (mode) => {
    setUnifiedMovieDialog(mode === "full");
    const transport = new FixtureTransport();
    transport.viewingLinks.set(
      transport.records[0].id,
      transport.libraryTitles[0].id,
    );
    await mount(transport);
    calendar.hoverPreview = true;
    await calendar.updateComplete;
    const first = posters()[0];
    first.dispatchEvent(new Event("pointerenter"));
    await vi.waitFor(() =>
      expect(root().querySelector(".movie-preview")).not.toBeNull(),
    );
    first.dispatchEvent(new Event("pointerdown"));
    first.dispatchEvent(new Event("focus"));
    first.click();
    if (mode === "full") {
      await vi.waitFor(() =>
        expect(
          root()
            .querySelector("kaleidescape-library")
            ?.shadowRoot?.querySelector<HTMLDialogElement>("#title-dialog")
            ?.open,
        ).toBe(true),
      );
    } else {
      await vi.waitFor(() =>
        expect(
          root().querySelector<HTMLDialogElement>(".calendar-dialog")?.open,
        ).toBe(true),
      );
    }
    expect(root().querySelector(".movie-preview")).toBeNull();
    first.dispatchEvent(new Event("focus"));
    first.dispatchEvent(new Event("pointerenter"));
    await calendar.updateComplete;
    expect(root().querySelector(".movie-preview")).toBeNull();
    if (mode === "full")
      modalClose(
        root().querySelector("kaleidescape-library")!.shadowRoot!,
      ).click();
    else modalClose(root()).click();
    await vi.waitFor(() =>
      expect(
        root().querySelector<HTMLDialogElement>(".calendar-dialog")?.open,
      ).toBe(false),
    );
    if (mode === "full")
      await vi.waitFor(() =>
        expect(root().querySelector("kaleidescape-library")).toBeNull(),
      );
    first.dispatchEvent(new Event("focus"));
    first.dispatchEvent(new Event("pointerleave"));
    await calendar.updateComplete;
    expect(root().querySelector(".movie-preview")).toBeNull();
    first.dispatchEvent(new Event("pointerenter"));
    await vi.waitFor(() =>
      expect(root().querySelector(".movie-preview")).not.toBeNull(),
    );
    first.dispatchEvent(new Event("pointerleave"));
    await vi.waitFor(() =>
      expect(root().querySelector(".movie-preview")).toBeNull(),
    );
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab" }));
    first.dispatchEvent(new Event("focus"));
    await vi.waitFor(() =>
      expect(root().querySelector(".movie-preview")).not.toBeNull(),
    );
    first.dispatchEvent(new Event("blur"));
    await vi.waitFor(() =>
      expect(root().querySelector(".movie-preview")).toBeNull(),
    );
  },
);

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
  "applies the saved hover preview option in %s",
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
    const month = parent.shadowRoot!.querySelector<JournalCalendar>(
      "kaleidescape-journal-calendar",
    )!;
    const options = parent.shadowRoot!.querySelector<JournalOptions>(
      "kaleidescape-journal-options",
    )!;
    await vi.waitFor(() =>
      expect(
        options.shadowRoot!.querySelector('[name="calendar_hover_preview"]'),
      ).not.toBeNull(),
    );
    expect(month.hoverPreview).toBe(false);
    options
      .shadowRoot!.querySelector<HTMLInputElement>(
        '[name="calendar_hover_preview"]',
      )!
      .click();
    await vi.waitFor(() => expect(month.hoverPreview).toBe(true));
  },
);

it.each(["kaleidescape-panel", "kaleidescape-reader"])(
  "changes %s list page size and resets pagination",
  async (tag) => {
    const transport = new FixtureTransport();
    transport.journalPreferences.view = "list";
    transport.records = Array.from({ length: 35 }, (_, i) =>
      record({ id: `entry-${i}`, title: `Fictional Film ${i}` }),
    );
    parent = document.createElement(tag) as
      KaleidescapePanel | KaleidescapeReader;
    parent.client = transport.client();
    document.body.append(parent);
    const root = parent.shadowRoot!;
    await vi.waitFor(() =>
      expect(root.querySelectorAll(".entry-list li")).toHaveLength(25),
    );
    const options = root.querySelector("kaleidescape-journal-options")!;
    const select = options.shadowRoot!.querySelector<HTMLSelectElement>(
      '[name="journal_page_size"]',
    )!;
    select.value = "10";
    select.dispatchEvent(new Event("change"));
    await vi.waitFor(() =>
      expect(root.querySelectorAll(".entry-list li")).toHaveLength(10),
    );
    const next = [
      ...root.querySelectorAll<HTMLButtonElement>("footer button"),
    ].find((button) => button.textContent?.trim() === "Next")!;
    await vi.waitFor(() => expect(next.disabled).toBe(false));
    next.click();
    await vi.waitFor(() =>
      expect(root.querySelector("footer")!.textContent).toContain("Page 2"),
    );
    select.value = "500";
    select.dispatchEvent(new Event("change"));
    await vi.waitFor(() =>
      expect(root.querySelectorAll(".entry-list li")).toHaveLength(35),
    );
    expect(root.querySelector("footer")!.textContent).toContain("Page 1");
    expect(transport.journalPreferences.page_size).toBe(500);
    select.value = "all";
    select.dispatchEvent(new Event("change"));
    await vi.waitFor(() =>
      expect(root.querySelector("footer")!.textContent).toContain(
        "All entries",
      ),
    );
    expect(root.querySelectorAll(".entry-list li")).toHaveLength(35);
  },
);

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
    expect(parent.shadowRoot!.querySelector("[name=filter_status]")).toBeNull();
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
        '[name="journal_view"][value="list"]',
      )!
      .click();
    await vi.waitFor(() =>
      expect(
        parent!.shadowRoot!.querySelector(".entries-layout"),
      ).not.toBeNull(),
    );
    expect(transport.journalPreferences.view).toBe("list");
    expect(
      parent.shadowRoot!.querySelector("[name=filter_status]"),
    ).not.toBeNull();
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
    expect(root.querySelector("[name=filter_status]")).toBeNull();
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
    const input = root.querySelector<HTMLInputElement>('input[name="search"]')!;
    input.value = "Lantern";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input
      .closest("form")!
      .dispatchEvent(new Event("submit", { cancelable: true }));
    await vi.waitFor(() =>
      expect(root.querySelector(".entries-layout")).not.toBeNull(),
    );
    const status = root.querySelector<HTMLSelectElement>(
      "[name=filter_status]",
    )!;
    status.value = "partial";
    status.dispatchEvent(new Event("change"));
    await vi.waitFor(() =>
      expect(
        transport.calls
          .filter((call) => call.type.endsWith("journal/list"))
          .at(-1),
      ).toMatchObject({ status: "partial" }),
    );
    await parent!.updateComplete;
    await vi.waitFor(() =>
      expect(
        root.querySelector<HTMLButtonElement>(".journal-search-chip")!.disabled,
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
    expect(root.querySelector("[name=filter_status]")).toBeNull();
    expect(
      root.querySelector<JournalCalendar>("kaleidescape-journal-calendar")!
        .status,
    ).toBe("");
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
        parent!.shadowRoot!.querySelector("kaleidescape-journal-calendar"),
      ).not.toBeNull(),
    );
    const root = parent.shadowRoot!;
    const month = root.querySelector("kaleidescape-journal-calendar")!;
    expect(month.querySelector('[slot="mobile-options"]')).not.toBeNull();
    expect(month.querySelector('[slot="mobile-add"]') !== null).toBe(
      tag === "kaleidescape-panel",
    );
    expect(root.querySelector("kaleidescape-journal-shortcuts")).toBeNull();
    expect(
      month.shadowRoot!.querySelector('[aria-label="Previous month"]'),
    ).not.toBeNull();
    expect(
      month.shadowRoot!.querySelector('[aria-label="Next month"]'),
    ).not.toBeNull();
    expect(month.shadowRoot!.querySelector(".month-compact")).not.toBeNull();
    const input = root.querySelector<HTMLInputElement>(
      ".journal-mobile-search input",
    )!;
    expect(input.closest("footer")).not.toBeNull();
    input.value = "Quiet";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input
      .closest("form")!
      .dispatchEvent(new Event("submit", { cancelable: true }));
    await vi.waitFor(() =>
      expect(root.querySelector(".entries-layout")).not.toBeNull(),
    );
    await vi.waitFor(() =>
      expect(
        root.querySelector<HTMLInputElement>(".journal-mobile-search input")!
          .value,
      ).toBe("Quiet"),
    );
    await vi.waitFor(() =>
      expect(
        root.querySelector<HTMLButtonElement>(
          '.journal-mobile-search [aria-label="Clear Journal search"]',
        )?.disabled,
      ).toBe(false),
    );
    root
      .querySelector<HTMLButtonElement>(
        '.journal-mobile-search [aria-label="Clear Journal search"]',
      )!
      .click();
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

it("opens the linked full Library detail from the movie title without leaving the calendar", async () => {
  const transport = new FixtureTransport();
  transport.viewingLinks.set(
    transport.records[0].id,
    transport.libraryTitles[0].id,
  );
  await mount(transport);
  posters()[0].click();
  await vi.waitFor(() =>
    expect(root().querySelector("h2 button")?.textContent).toContain(
      "The Lantern Voyage",
    ),
  );
  root().querySelector<HTMLButtonElement>("h2 button")!.click();
  await vi.waitFor(() =>
    expect(
      root()
        .querySelector("kaleidescape-library")
        ?.shadowRoot?.querySelector<HTMLDialogElement>("#title-dialog")?.open,
    ).toBe(true),
  );
  const library = root().querySelector("kaleidescape-library")!;
  expect(
    library.shadowRoot!.querySelector("kaleidescape-library-journal"),
  ).not.toBeNull();
  expect(root().querySelector(".month-grid")).not.toBeNull();
  expect(
    root().querySelector<HTMLDialogElement>(".calendar-dialog")!.open,
  ).toBe(true);
});

it.each([
  ["Fictional Actor", "query", "Fictional Actor"],
  ["Fictional Director", "query", "Fictional Director"],
  ["Science Fiction", "genre", "Science Fiction"],
  ["2025", "year", "2025"],
  ["PG", "rating", "PG"],
  ["4K", "format", "4K"],
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
  "opens Library with URL-backed criteria in %s",
  async (tag) => {
    history.replaceState(
      null,
      "",
      "/kaleidescape-companion?companion_page=journal",
    );
    const transport = new FixtureTransport();
    transport.options.library_enabled = true;
    transport.journalPreferences.view = "calendar";
    transport.journalPreferences.movie_details = "compact";
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
      expect(
        new URL(location.href).searchParams.getAll("library_genre"),
      ).toEqual(["Science Fiction"]),
    );
    expect(transport.uiPreferences.query).toBe("Old search");
    expect(transport.uiPreferences.rating).toEqual(["R"]);
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
    expect(location.search).toContain("Science");
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
        "October: 3",
      ),
    );
    const options = parent!.shadowRoot!.querySelector(
      "kaleidescape-journal-options",
    )!;
    options
      .shadowRoot!.querySelector<HTMLInputElement>(
        '[name="calendar_show_year"]',
      )!
      .click();
    await vi.waitFor(() => expect(footer().textContent).not.toContain("Year:"));
    button("Next month").click();
    await vi.waitFor(() =>
      expect(footer().textContent?.replace(/\s+/g, " ")).toContain(
        "November: 0",
      ),
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

it("does not open Library after the viewing dialog closes during link lookup", async () => {
  const transport = new FixtureTransport();
  transport.viewingLinks.set(
    transport.records[0].id,
    transport.libraryTitles[0].id,
  );
  await mount(transport);
  let resolve!: (
    value: Awaited<
      ReturnType<NonNullable<typeof calendar.client>["viewingLibrary"]>
    >,
  ) => void;
  vi.spyOn(calendar.client!, "viewingLibrary").mockReturnValue(
    new Promise((done) => (resolve = done)),
  );
  posters()[0].click();
  await vi.waitFor(() =>
    expect(root().querySelector("h2 button")).not.toBeNull(),
  );
  root().querySelector<HTMLButtonElement>("h2 button")!.click();
  modalClose(root()).click();
  resolve({
    library: {
      title_id: transport.libraryTitles[0].id,
      title: "Fictional",
      artwork_key: null,
    },
  });
  await calendar.updateComplete;
  await Promise.resolve();
  expect(root().querySelector("kaleidescape-library")).toBeNull();
});

it("reports an unavailable Library title in the original viewing dialog", async () => {
  const transport = new FixtureTransport();
  transport.viewingLinks.set(
    transport.records[0].id,
    transport.libraryTitles[0].id,
  );
  await mount(transport);
  vi.spyOn(calendar.client!, "libraryVersions").mockRejectedValue(
    new Error("Fictional Library failure"),
  );
  posters()[0].click();
  await vi.waitFor(() =>
    expect(root().querySelector("h2 button")).not.toBeNull(),
  );
  root().querySelector<HTMLButtonElement>("h2 button")!.click();
  await vi.waitFor(() =>
    expect(
      root().querySelector(".calendar-dialog [role=alert]"),
    ).not.toBeNull(),
  );
  expect(
    root().querySelector<HTMLDialogElement>(".calendar-dialog")!.open,
  ).toBe(true);
});

it("opens the consolidated movie dialog directly from a linked calendar entry", async () => {
  setUnifiedMovieDialog(true);
  const transport = new FixtureTransport();
  transport.viewingLinks.set(
    transport.records[0].id,
    transport.libraryTitles[0].id,
  );
  await mount(transport);
  posters()[0].click();
  await vi.waitFor(() =>
    expect(
      root()
        .querySelector("kaleidescape-library")
        ?.shadowRoot?.querySelector<HTMLDialogElement>("#title-dialog")?.open,
    ).toBe(true),
  );
  expect(
    root().querySelector<HTMLDialogElement>(".calendar-dialog")!.open,
  ).toBe(false);
  const library = root().querySelector("kaleidescape-library")!;
  await vi.waitFor(() =>
    expect(
      library
        .shadowRoot!.querySelector(".movie-aside .movie-journal")
        ?.shadowRoot?.querySelector("summary"),
    ).not.toBeNull(),
  );
  expect(library.shadowRoot!.textContent).not.toContain(
    "Use current movie details",
  );
});

it("switches an open current calendar dialog into the consolidated dialog", async () => {
  const transport = new FixtureTransport();
  transport.viewingLinks.set(
    transport.records[0].id,
    transport.libraryTitles[0].id,
  );
  await mount(transport);
  posters()[0].click();
  await vi.waitFor(() =>
    expect(root().querySelector(".calendar-dialog")?.textContent).toContain(
      "Fictional Actor",
    ),
  );
  setUnifiedMovieDialog(true);
  await vi.waitFor(() =>
    expect(
      root()
        .querySelector("kaleidescape-library")
        ?.shadowRoot?.querySelector<HTMLDialogElement>("#title-dialog")?.open,
    ).toBe(true),
  );
  expect(
    root().querySelector<HTMLDialogElement>(".calendar-dialog")!.open,
  ).toBe(false);
});

it("opens the current viewing details when the Library link is unavailable", async () => {
  setUnifiedMovieDialog(true);
  await mount();
  posters()[0].click();
  await vi.waitFor(() =>
    expect(
      root().querySelector<HTMLDialogElement>(".calendar-dialog")?.open,
    ).toBe(true),
  );
  expect(root().querySelector("kaleidescape-library")).toBeNull();
});

it("opens the Journal editor from the consolidated calendar movie dialog", async () => {
  setUnifiedMovieDialog(true);
  const transport = new FixtureTransport();
  transport.options.library_enabled = true;
  transport.journalPreferences.view = "calendar";
  transport.viewingLinks.set(
    transport.records[0].id,
    transport.libraryTitles[0].id,
  );
  parent = document.createElement("kaleidescape-panel") as KaleidescapePanel;
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
    expect(
      root()
        .querySelector("kaleidescape-library")
        ?.shadowRoot?.querySelector<HTMLDialogElement>("#title-dialog")?.open,
    ).toBe(true),
  );
  const library = root().querySelector("kaleidescape-library")!;
  await vi.waitFor(() =>
    expect(
      library.shadowRoot!.querySelector("kaleidescape-library-journal")
        ?.shadowRoot?.textContent,
    ).toContain("edit"),
  );
  const history = library.shadowRoot!.querySelector(
    "kaleidescape-library-journal",
  )!;
  history.shadowRoot!.querySelector<HTMLDetailsElement>("details")!.open = true;
  [...history.shadowRoot!.querySelectorAll<HTMLButtonElement>("button")]
    .find((button) => button.textContent?.trim() === "edit")!
    .click();
  await vi.waitFor(() =>
    expect(
      parent!.shadowRoot!.querySelector<HTMLDialogElement>("#journal-editor")
        ?.open,
    ).toBe(true),
  );
  expect(
    library.shadowRoot!.querySelector<HTMLDialogElement>("#title-dialog")!.open,
  ).toBe(true);
});

it("ignores a delayed consolidated-dialog lookup after switching back", async () => {
  const transport = new FixtureTransport();
  transport.viewingLinks.set(
    transport.records[0].id,
    transport.libraryTitles[0].id,
  );
  await mount(transport);
  posters()[0].click();
  await vi.waitFor(() =>
    expect(root().querySelector(".calendar-dialog")?.textContent).toContain(
      "Fictional Actor",
    ),
  );
  let resolve!: (
    value: Awaited<
      ReturnType<NonNullable<typeof calendar.client>["viewingLibrary"]>
    >,
  ) => void;
  vi.spyOn(calendar.client!, "viewingLibrary").mockReturnValue(
    new Promise((done) => (resolve = done)),
  );
  setUnifiedMovieDialog(true);
  setUnifiedMovieDialog(false);
  resolve({
    library: {
      title_id: transport.libraryTitles[0].id,
      title: "Fictional",
      artwork_key: null,
    },
  });
  await Promise.resolve();
  await calendar.updateComplete;
  expect(
    root().querySelector<HTMLDialogElement>(".calendar-dialog")!.open,
  ).toBe(true);
  expect(root().querySelector("kaleidescape-library")).toBeNull();
});
