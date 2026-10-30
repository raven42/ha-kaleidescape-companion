/** Choose an exact fictional Library version through the real picker. */
import { expect, vi } from "vitest";
import type { ManualViewingFields } from "../src/ui/manual-viewing";
import { libraryTitle } from "./fixture";
import type { FixtureTransport } from "./fixture";

export async function selectManual(
  root: ShadowRoot,
  transport: FixtureTransport,
  title: string,
) {
  transport.libraryTitles = [libraryTitle({ title })];
  const fields = root.querySelector(
    "kaleidescape-manual-viewing",
  ) as ManualViewingFields;
  await fields.updateComplete;
  const input = fields.shadowRoot!.querySelector<HTMLInputElement>(
    '[name="library_movie"]',
  )!;
  input.value = title;
  input.dispatchEvent(new Event("input"));
  await vi.waitFor(() =>
    expect(fields.shadowRoot!.querySelector('[role="option"]')).toBeTruthy(),
  );
  fields
    .shadowRoot!.querySelector<HTMLButtonElement>('[role="option"]')!
    .click();
  await fields.updateComplete;
  await new Promise((resolve) => setTimeout(resolve, 0));
  return fields;
}
