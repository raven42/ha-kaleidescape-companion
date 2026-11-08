import { afterEach, expect, it, vi } from "vitest";
import "../src/ui/journal-options";
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
it("uses shared search configuration without offering a personal toggle", async () => {
  const transport = new FixtureTransport();
  const root = await mount(transport);
  const changed = vi.fn();
  element.addEventListener("journal-options", changed);
  element.scope = {
    ...info,
    ui_defaults: { default_landing_page: "journal", fuzzy_search: false },
  };
  await element.updateComplete;
  expect(changed.mock.calls.at(-1)?.[0].detail.fuzzy_search).toBe(false);
  expect(root.querySelector('[name="journal_fuzzy_search"]')).toBeNull();
  expect(transport.calls.some((call) => call.area === "search")).toBe(false);
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

it("keeps filtering and refresh actions out of view options", async () => {
  const root = await mount(new FixtureTransport());
  expect(root.querySelector("[name=filter_status]")).toBeNull();
  expect(root.textContent).not.toContain("Refresh Journal");
});
