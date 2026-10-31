import { afterEach, beforeEach, expect, it, vi } from "vitest";
import "../src/ui/database";
import "../src/ui/settings";
import type { KaleidescapeDatabase } from "../src/ui/database";
import type { KaleidescapeSettings } from "../src/ui/settings";
import type { ApiMessage } from "../src/core/api";
import { FixtureTransport, info } from "./fixture";

let transport: FixtureTransport;
let element: KaleidescapeDatabase | KaleidescapeSettings;
const root = () => element.shadowRoot!;
const text = () => root().textContent!.replace(/\s+/g, " ");
function button(label: string) {
  const button = [...root().querySelectorAll("button")].find(
    (item) => item.textContent?.trim() === label,
  );
  expect(button, label).toBeTruthy();
  return button!;
}
async function waitFor(value: string) {
  await vi.waitFor(() => expect(text()).toContain(value));
}
async function flush() {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await element.updateComplete;
}
function input(name: string, value: string) {
  const input = root().querySelector<HTMLInputElement>(`[name="${name}"]`)!;
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
}
async function mount(
  tag: "kaleidescape-database" | "kaleidescape-settings",
  tracking = false,
) {
  transport.trackingEnabled = tracking;
  element = document.createElement(tag) as typeof element;
  element.client = transport.client();
  element.scope = { ...info, tracking_enabled: tracking };
  document.body.append(element);
  await waitFor(
    tag === "kaleidescape-database" ? "The Lantern Voyage" : "Save settings",
  );
}
beforeEach(() => {
  transport = new FixtureTransport();
  vi.spyOn(HTMLFormElement.prototype, "reportValidity").mockReturnValue(true);
  window.confirm = vi.fn(() => true);
});
afterEach(() => {
  element?.remove();
});

it("renders a settings page and saves the native integration options flow", async () => {
  await mount("kaleidescape-settings");
  expect(root().querySelector("dialog")).toBeNull();
  expect(
    root().querySelector<HTMLInputElement>('[name="minimum_runtime_minutes"]')!
      .value,
  ).toBe("10");
  const saved = vi.fn();
  element.addEventListener("settings-saved", saved);
  input("minimum_runtime_minutes", "20");
  button("Save settings").click();
  await flush();
  expect(
    transport.calls.find((call) => call.type.endsWith("/settings/submit")),
  ).toMatchObject({
    flow_id: "fixture-flow",
    data: { minimum_runtime_minutes: 20, tracking_enabled: false },
    entry_id: info.entry_id,
    dataset_id: info.dataset_id,
  });
  expect(saved).toHaveBeenCalledOnce();
});

it("keeps library sync opt-in and saves library controls through the native options flow", async () => {
  await mount("kaleidescape-settings");
  const enabled = root().querySelector<HTMLInputElement>(
    '[name="library_enabled"]',
  )!;
  expect(enabled.checked).toBe(false);
  expect(root().querySelector('[name="library_host"]')).toBeNull();
  enabled.checked = true;
  enabled.dispatchEvent(new Event("change", { bubbles: true }));
  await flush();
  input("library_host", "");
  input("library_interval_hours", "12");
  input("custom_collection", "Demo extras");
  button("Add hidden name").click();
  await flush();
  input("custom_collection", "Archived collection");
  button("Add hidden name").click();
  await flush();
  const artwork = root().querySelector<HTMLInputElement>(
    '[name="library_sync_artwork"]',
  )!;
  artwork.checked = true;
  artwork.dispatchEvent(new Event("change", { bubbles: true }));
  await flush();
  expect(text()).toContain("additional disk space");
  expect(text()).toContain("256 MiB limit");
  button("Save settings").click();
  await flush();
  expect(
    transport.calls.find((call) => call.type.endsWith("/settings/submit"))!
      .data,
  ).toMatchObject({
    library_enabled: true,
    library_host: "",
    library_interval_hours: 12,
    library_sync_collections: true,
    library_sync_details: true,
    library_sync_artwork: true,
    library_artwork_cache_mb: 512,
  });
});
it("cancels without saving and returns server validation errors on the settings page", async () => {
  await mount("kaleidescape-settings");
  const original = transport.callWS.bind(transport);
  vi.spyOn(transport, "callWS").mockImplementation(
    async <T>(message: ApiMessage) => {
      if (message.type.endsWith("/settings/submit"))
        return {
          type: "form",
          flow_id: "fixture-flow",
          errors: { base: "missing_entities" },
        } as T;
      return original<T>(message);
    },
  );
  button("Save settings").click();
  await waitFor("Select all three source entities");
  element.remove();
  await flush();
  expect(transport.calls.at(-1)?.type).toMatch(/settings\/cancel$/);
});
it("does not resubmit an unconfirmed options save and clears fields on denial", async () => {
  await mount("kaleidescape-settings");
  transport.failure = "connection_lost";
  button("Save settings").click();
  await waitFor("save result is unconfirmed");
  expect(root().querySelector("fieldset")!.disabled).toBe(true);
  element.remove();
  transport.failure = "unauthorized";
  element = document.createElement(
    "kaleidescape-settings",
  ) as KaleidescapeSettings;
  element.client = transport.client();
  element.scope = info;
  document.body.append(element);
  await waitFor("Access to this operation is denied");
  expect(root().querySelector("input")).toBeNull();
});
it("cancels inline settings changes through the original HA options flow", async () => {
  await mount("kaleidescape-settings");
  input("minimum_runtime_minutes", "10");
  expect((element as KaleidescapeSettings).confirmNavigation()).toBe(true);
  expect(window.confirm).not.toHaveBeenCalled();
  input("minimum_runtime_minutes", "20");
  button("Cancel changes").click();
  await flush();
  expect(
    transport.calls.some((call) => call.type.endsWith("/settings/cancel")),
  ).toBe(true);
  expect(
    transport.calls.some((call) => call.type.endsWith("/settings/submit")),
  ).toBe(false);
  expect(
    root().querySelector<HTMLInputElement>('[name="minimum_runtime_minutes"]')!
      .value,
  ).toBe("10");
});

it("requires a dedicated-calendar acknowledgement for Full Sync and bounds its age window", async () => {
  transport.options.calendar_enabled = true;
  transport.options.calendar_entity = "calendar.movies";
  await mount("kaleidescape-settings");
  const full = root().querySelector<HTMLInputElement>(
    '[name="calendar_full_sync"]',
  )!;
  full.click();
  await flush();
  expect(root().querySelector(".warning strong")?.textContent).toContain(
    "permanently deleted",
  );
  const acknowledgement = root().querySelector<HTMLInputElement>(
    '[name="calendar_full_sync_dedicated"]',
  )!;
  expect(acknowledgement.required).toBe(true);
  expect(acknowledgement.checked).toBe(false);
  const months = root().querySelector<HTMLInputElement>(
    '[name="calendar_full_sync_months"]',
  )!;
  expect([months.min, months.max, months.value]).toEqual(["1", "12", "3"]);
  acknowledgement.click();
  await flush();
  input("calendar_entity", "calendar.another");
  await flush();
  expect(acknowledgement.checked).toBe(false);
});
