/** Simulated DOM only: URL restoration, defaults, collections, and dismissal. */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import "../src/ui/panel";
import type { KaleidescapePanel } from "../src/ui/panel";
import type { KaleidescapeSettings } from "../src/ui/settings";
import type { KaleidescapeLibrary } from "../src/library/library";
import { FixtureTransport, info } from "./fixture";
import { landingPage, rememberPage } from "../src/ui/navigation";
import { dismissBackdrop } from "../src/ui/dialog";

let element: HTMLElement;
let transport: FixtureTransport;
async function flush() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}
function button(root: ShadowRoot, label: string) {
  return [...root.querySelectorAll<HTMLButtonElement>("button")].find(
    (item) => item.textContent?.trim() === label,
  )!;
}
beforeEach(() => {
  transport = new FixtureTransport();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  window.confirm = vi.fn(() => true);
});
afterEach(() => {
  element?.remove();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it("restores the selected tab after remount and preserves unrelated URL parameters", async () => {
  history.replaceState({ ha: true }, "", "/?example=1");
  transport.options.library_enabled = true;
  const mount = () => {
    const panel = document.createElement(
      "kaleidescape-panel",
    ) as KaleidescapePanel;
    panel.client = transport.client();
    document.body.append(panel);
    element = panel;
    return panel;
  };
  let panel = mount();
  await vi.waitFor(() =>
    expect(button(panel.shadowRoot!, "Library").disabled).toBe(false),
  );
  button(panel.shadowRoot!, "Library").click();
  await flush();
  expect(location.search).toContain("companion_page=library");
  expect(location.search).toContain("example=1");
  expect(history.state).toEqual({ ha: true });
  panel.remove();
  panel = mount();
  await vi.waitFor(() =>
    expect(
      panel.shadowRoot!.querySelector("kaleidescape-library"),
    ).toBeTruthy(),
  );
});

it("uses landing defaults only without an allowed URL tab and restricts reader/disabled tabs", () => {
  expect(landingPage("library", true, true)).toBe("library");
  rememberPage("settings");
  expect(landingPage("library", true, true)).toBe("settings");
  expect(landingPage("database", false, true)).toBe("journal");
  rememberPage("library");
  expect(landingPage("now-playing", false, false)).toBe("journal");
  history.replaceState(null, "", "/?companion_page=javascript:alert(1)");
  expect(landingPage("journal", true, true)).toBe("journal");
});

it("applies configured cover/count defaults on Library mount", async () => {
  const library = document.createElement(
    "kaleidescape-library",
  ) as KaleidescapeLibrary;
  library.client = transport.client();
  library.scope = {
    ...info,
    library_enabled: true,
  };
  transport.uiPreferences = {
    ...transport.uiPreferences,
    view: "covers",
    page_size: 1000,
  };
  element = library;
  document.body.append(library);
  await vi.waitFor(() =>
    expect(library.shadowRoot!.querySelector(".cover-grid")).toBeTruthy(),
  );
  expect(
    transport.calls.find((call) => call.type.endsWith("/library/list"))!
      .filters,
  ).toMatchObject({ limit: 1000 });
  expect(
    library.shadowRoot!.querySelector<HTMLInputElement>(
      '[name="library_page_size"]',
    )!.value,
  ).toBe("1000");
});

it("saves display defaults and hidden known/custom collections as a value list", async () => {
  transport.options.library_enabled = true;
  const settings = document.createElement(
    "kaleidescape-settings",
  ) as KaleidescapeSettings;
  settings.client = transport.client();
  settings.scope = { ...info, library_enabled: true };
  element = settings;
  document.body.append(settings);
  await vi.waitFor(() =>
    expect(settings.shadowRoot!.textContent).toContain("Science Fiction"),
  );
  const root = settings.shadowRoot!;
  expect(
    root.querySelector<HTMLSelectElement>('[name="default_landing_page"]')!
      .value,
  ).toBe("journal");
  const known = [
    ...root.querySelectorAll<HTMLInputElement>(
      '[name="library_excluded_collections"]',
    ),
  ].find((input) => input.value === "Science Fiction")!;
  known.checked = true;
  known.dispatchEvent(new Event("change"));
  await flush();
  const custom = root.querySelector<HTMLInputElement>(
    '[name="custom_collection"]',
  )!;
  custom.value = "Custom example";
  custom.dispatchEvent(new Event("input"));
  button(root, "Add hidden name").click();
  await flush();
  await flush();
  expect(
    transport.calls
      .filter((call) => call.type.endsWith("/ui/shared/update"))
      .at(-1)!.patch,
  ).toEqual({ hidden_collections: ["Science Fiction", "Custom example"] });
  expect(root.querySelector('[name="library_default_count"]')).toBeNull();
  expect(root.querySelector('[name="library_default_view"]')).toBeNull();
  expect(
    transport.calls.some((call) => call.type.endsWith("/settings/submit")),
  ).toBe(false);
});

it("keeps shared preference controls unavailable until their saved values load", async () => {
  const settings = document.createElement(
    "kaleidescape-settings",
  ) as KaleidescapeSettings;
  const client = transport.client();
  vi.spyOn(client, "uiPreferences").mockRejectedValueOnce(
    new Error("Interrupted test read"),
  );
  settings.client = client;
  settings.scope = { ...info, library_enabled: true };
  element = settings;
  document.body.append(settings);
  await vi.waitFor(() =>
    expect(settings.shadowRoot!.textContent).toContain(
      "Shared display settings could not be loaded",
    ),
  );
  expect(
    settings.shadowRoot!.querySelector('[name="custom_collection"]'),
  ).toBeNull();
  button(settings.shadowRoot!, "Reload settings").click();
  await vi.waitFor(() =>
    expect(
      settings.shadowRoot!.querySelector('[name="custom_collection"]'),
    ).toBeTruthy(),
  );
  expect(
    transport.calls.some((call) => call.type.endsWith("/ui/shared/update")),
  ).toBe(false);
});

it("dismisses a backdrop through the Escape guard, but keeps inside clicks and protected writes open", () => {
  const dialog = document.createElement("dialog");
  element = dialog;
  document.body.append(dialog);
  dialog.addEventListener("click", dismissBackdrop);
  vi.spyOn(dialog, "getBoundingClientRect").mockReturnValue({
    left: 10,
    right: 100,
    top: 10,
    bottom: 100,
  } as DOMRect);
  dialog.showModal();
  dialog.dispatchEvent(new MouseEvent("click", { clientX: 20, clientY: 20 }));
  expect(dialog.open).toBe(true);
  const guard = (event: Event) => event.preventDefault();
  dialog.addEventListener("cancel", guard);
  dialog.dispatchEvent(new MouseEvent("click", { clientX: 0, clientY: 0 }));
  expect(dialog.open).toBe(true);
  dialog.removeEventListener("cancel", guard);
  dialog.dispatchEvent(new MouseEvent("click", { clientX: 0, clientY: 0 }));
  expect(dialog.open).toBe(false);
});
