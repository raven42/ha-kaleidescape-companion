import { afterEach, expect, it, vi } from "vitest";
import "../src/ui/journal-options";
import "../src/library/library";
import type { KaleidescapeLibrary } from "../src/library/library";
import type { JournalOptions } from "../src/ui/journal-options";
import { FixtureTransport, info } from "./fixture";
let element: JournalOptions;
afterEach(() => element?.remove());
async function mount(transport: FixtureTransport) {
  element = document.createElement(
    "kaleidescape-journal-options",
  ) as JournalOptions;
  element.client = transport.client();
  element.scope = info;
  document.body.append(element);
  await vi.waitFor(() =>
    expect(
      element.shadowRoot!.querySelector<HTMLButtonElement>("button")?.disabled,
    ).toBe(false),
  );
  return element.shadowRoot!;
}
it("saves the global personal search choice and restores it when reopened", async () => {
  const transport = new FixtureTransport();
  const root = await mount(transport);
  const changed = vi.fn();
  element.addEventListener("journal-options", changed);
  root.querySelector<HTMLButtonElement>("button")!.click();
  expect(root.querySelector("dialog")!.open).toBe(true);
  root.querySelector<HTMLInputElement>("input")!.click();
  await element.updateComplete;
  await vi.waitFor(() =>
    expect(transport.searchPreferences.fuzzy_search).toBe(false),
  );
  expect(transport.uiPreferences).not.toHaveProperty("fuzzy_search");
  expect(changed.mock.calls[0][0].detail).toEqual({
    fuzzy_search: false,
    view: "list",
    calendar_size: 180,
    calendar_fit: false,
    movie_details: "full",
  });
  element.remove();
  const reopened = await mount(transport);
  expect(reopened.querySelector<HTMLInputElement>("input")!.checked).toBe(
    false,
  );
  expect(
    transport.calls.some(
      (call) =>
        call.type.endsWith("ui/preferences/update") && call.area === "search",
    ),
  ).toBe(true);
});
it("ignores late preference reads after unmount", async () => {
  const transport = new FixtureTransport();
  element = document.createElement(
    "kaleidescape-journal-options",
  ) as JournalOptions;
  const client = transport.client();
  const releases: ((value: {
    values: Record<string, unknown>;
    revision: number;
  }) => void)[] = [];
  vi.spyOn(client, "uiPreferences").mockImplementation(
    () =>
      new Promise((resolve) => {
        releases.push(resolve);
      }),
  );
  const changed = vi.fn();
  element.addEventListener("journal-options", changed);
  element.client = client;
  element.scope = info;
  document.body.append(element);
  await element.updateComplete;
  element.remove();
  for (const release of releases)
    release({ values: { fuzzy_search: false, view: "calendar" }, revision: 1 });
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(changed).not.toHaveBeenCalled();
});

it("persists Calendar view independently of the global search preference", async () => {
  const transport = new FixtureTransport();
  const root = await mount(transport);
  const changed = vi.fn();
  element.addEventListener("journal-options", changed);
  root
    .querySelector<HTMLInputElement>('[name="journal_calendar_view"]')!
    .click();
  await vi.waitFor(() =>
    expect(transport.journalPreferences.view).toBe("calendar"),
  );
  expect(changed.mock.calls.at(-1)![0].detail).toEqual({
    fuzzy_search: true,
    view: "calendar",
    calendar_size: 180,
    calendar_fit: false,
    movie_details: "full",
  });
  expect(transport.searchPreferences).toEqual({ fuzzy_search: true });
  element.remove();
  const reopened = await mount(transport);
  expect(
    reopened.querySelector<HTMLInputElement>('[name="journal_calendar_view"]')!
      .checked,
  ).toBe(true);
});

it("persists the Journal movie detail mode", async () => {
  const transport = new FixtureTransport();
  const root = await mount(transport);
  const select = root.querySelector<HTMLSelectElement>(
    '[name="journal_movie_details"]',
  )!;
  expect(select.value).toBe("full");
  select.value = "compact";
  select.dispatchEvent(new Event("change", { bubbles: true }));
  await vi.waitFor(() =>
    expect(transport.journalPreferences.movie_details).toBe("compact"),
  );
  element.remove();
  const reopened = await mount(transport);
  expect(
    reopened.querySelector<HTMLSelectElement>('[name="journal_movie_details"]')!
      .value,
  ).toBe("compact");
});

it("saves live calendar sizing and fit options independently for the current user", async () => {
  const transport = new FixtureTransport();
  transport.journalPreferences.view = "calendar";
  const root = await mount(transport);
  const changed = vi.fn();
  element.addEventListener("journal-options", changed);
  const size = root.querySelector<HTMLInputElement>(
    '[name="journal_calendar_size"]',
  )!;
  size.value = "95";
  size.dispatchEvent(new Event("input"));
  expect(changed.mock.calls.at(-1)![0].detail.calendar_size).toBe(95);
  expect(transport.journalPreferences.calendar_size).toBe(180);
  size.dispatchEvent(new Event("change"));
  await vi.waitFor(() =>
    expect(transport.journalPreferences.calendar_size).toBe(95),
  );
  root
    .querySelector<HTMLInputElement>('[name="journal_calendar_fit"]')!
    .click();
  await element.updateComplete;
  expect(size.disabled).toBe(true);
  await vi.waitFor(() =>
    expect(transport.journalPreferences.calendar_fit).toBe(true),
  );
  element.remove();
  const reopened = await mount(transport);
  expect(
    reopened.querySelector<HTMLInputElement>('[name="journal_calendar_size"]')!
      .value,
  ).toBe("95");
  expect(
    reopened.querySelector<HTMLInputElement>('[name="journal_calendar_fit"]')!
      .checked,
  ).toBe(true);
  expect(transport.searchPreferences).toEqual({ fuzzy_search: true });
});

it("shares the saved mode in both directions when moving between views", async () => {
  const transport = new FixtureTransport();
  const journal = await mount(transport);
  journal.querySelector<HTMLInputElement>("input")!.click();
  await vi.waitFor(() =>
    expect(transport.searchPreferences.fuzzy_search).toBe(false),
  );
  element.remove();
  const library = document.createElement(
    "kaleidescape-library",
  ) as KaleidescapeLibrary;
  library.client = transport.client();
  library.scope = { ...info, library_enabled: true };
  document.body.append(library);
  try {
    await vi.waitFor(() =>
      expect(
        library.shadowRoot!.querySelector<HTMLInputElement>(
          '[name="library_fuzzy_search"]',
        )?.checked,
      ).toBe(false),
    );
    library
      .shadowRoot!.querySelector<HTMLInputElement>(
        '[name="library_fuzzy_search"]',
      )!
      .click();
    await vi.waitFor(() =>
      expect(transport.searchPreferences.fuzzy_search).toBe(true),
    );
  } finally {
    library.remove();
  }
  const restored = await mount(transport);
  expect(restored.querySelector<HTMLInputElement>("input")!.checked).toBe(true);
  const updates = transport.calls.filter(
    (call) =>
      call.type.endsWith("ui/preferences/update") &&
      "fuzzy_search" in (call.patch as Record<string, unknown>),
  );
  expect(updates).toHaveLength(2);
  expect(updates.every((call) => call.area === "search")).toBe(true);
});

it("offers the status filter inside Options and notifies its host immediately", async () => {
  const root = await mount(new FixtureTransport());
  const change = vi.fn();
  element.addEventListener("journal-status", change);
  const field = root.querySelector<HTMLSelectElement>("[name=filter_status]")!;
  expect(field.closest("dialog")).not.toBeNull();
  field.value = "partial";
  field.dispatchEvent(new Event("change"));
  expect(change.mock.calls[0][0].detail).toBe("partial");
});
