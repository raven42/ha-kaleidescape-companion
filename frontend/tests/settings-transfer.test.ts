import { afterEach, expect, it, vi } from "vitest";
import "../src/ui/settings-transfer";
import type { SettingsTransferPanel } from "../src/ui/settings-transfer";
import { FixtureTransport, info } from "./fixture";
let element: SettingsTransferPanel;
afterEach(() => element?.remove());
it("offers category checkboxes with private connection/template categories unchecked", async () => {
  const client = new FixtureTransport().client();
  element = document.createElement(
    "kaleidescape-settings-transfer",
  ) as SettingsTransferPanel;
  element.client = client;
  element.scope = info;
  document.body.append(element);
  await element.updateComplete;
  element.shadowRoot!.querySelector<HTMLButtonElement>("button")!.click();
  await element.updateComplete;
  const checks = [
    ...element.shadowRoot!.querySelectorAll<HTMLInputElement>(
      'input[type="checkbox"]',
    ),
  ];
  expect(checks.map((c) => c.checked)).toEqual([
    true,
    true,
    false,
    false,
    false,
    false,
  ]);
  expect(element.shadowRoot!.textContent).toContain(
    "Credentials are always excluded",
  );
  expect(element.shadowRoot!.querySelector("dialog")!.open).toBe(true);
  expect(element.shadowRoot!.querySelector(".dialog-close")).not.toBeNull();
});
it("does not issue settings requests before an administrator selects a transfer", async () => {
  const client = new FixtureTransport().client();
  const call = vi.spyOn(client, "settingsTransfer");
  element = document.createElement(
    "kaleidescape-settings-transfer",
  ) as SettingsTransferPanel;
  element.client = client;
  element.scope = info;
  document.body.append(element);
  await element.updateComplete;
  expect(call).not.toHaveBeenCalled();
});
