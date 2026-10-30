/** Choose an exact fictional Library version through the real picker. */
import { expect, vi } from "vitest";
import type { ManualViewingFields } from "../src/ui/manual-viewing";
import { libraryTitle } from "./fixture";
import type { FixtureTransport } from "./fixture";

export function titlePicker(root: ParentNode) {
  return root.querySelector("kaleidescape-library-title-picker")!.shadowRoot!;
}

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
  const picker = titlePicker(fields.shadowRoot!);
  await (picker.host as unknown as { updateComplete: Promise<unknown> })
    .updateComplete;
  const input = picker.querySelector<HTMLInputElement>(
    '[name="library_movie"]',
  )!;
  input.value = title;
  input.dispatchEvent(new Event("input"));
  await vi.waitFor(() =>
    expect(picker.querySelector('[role="option"]')).toBeTruthy(),
  );
  picker.querySelector<HTMLButtonElement>('[role="option"]')!.click();
  await fields.updateComplete;
  await new Promise((resolve) => setTimeout(resolve, 0));
  return fields;
}
