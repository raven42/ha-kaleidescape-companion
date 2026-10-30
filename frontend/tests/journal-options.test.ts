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
it("saves a personal Journal choice separately and restores it when reopened", async () => {
  const transport = new FixtureTransport();
  const root = await mount(transport);
  const changed = vi.fn();
  element.addEventListener("journal-options", changed);
  root.querySelector<HTMLButtonElement>("button")!.click();
  expect(root.querySelector("dialog")!.open).toBe(true);
  root.querySelector<HTMLInputElement>("input")!.click();
  await element.updateComplete;
  await vi.waitFor(() =>
    expect(transport.journalPreferences.fuzzy_search).toBe(false),
  );
  expect(transport.uiPreferences.fuzzy_search).toBe(true);
  expect(changed.mock.calls[0][0].detail).toEqual({ fuzzy_search: false });
  element.remove();
  const reopened = await mount(transport);
  expect(reopened.querySelector<HTMLInputElement>("input")!.checked).toBe(
    false,
  );
  expect(
    transport.calls.some(
      (call) =>
        call.type.endsWith("ui/preferences/update") && call.area === "journal",
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
