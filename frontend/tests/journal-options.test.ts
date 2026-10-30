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
  expect(changed.mock.calls[0][0].detail).toEqual({ fuzzy_search: false });
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
  let release: (value: {
    values: Record<string, unknown>;
    revision: number;
  }) => void = () => {};
  vi.spyOn(client, "uiPreferences").mockImplementation(
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  );
  const changed = vi.fn();
  element.addEventListener("journal-options", changed);
  element.client = client;
  element.scope = info;
  document.body.append(element);
  await element.updateComplete;
  element.remove();
  release({ values: { fuzzy_search: false }, revision: 1 });
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(changed).not.toHaveBeenCalled();
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
