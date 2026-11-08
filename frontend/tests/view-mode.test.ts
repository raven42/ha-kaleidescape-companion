/** Basic mode reuses household rendering; account permissions remain authoritative. */
import { afterEach, expect, it, vi } from "vitest";
import "../src/ui/panel";
import type { KaleidescapePanel } from "../src/ui/panel";
import { FixtureTransport, info } from "./fixture";

let panel: KaleidescapePanel;
const root = () => panel.shadowRoot!;
const toggle = () =>
  root().querySelector<HTMLButtonElement>(
    '[role="switch"][aria-label="Advanced view"]',
  )!;
async function mount(transport: FixtureTransport, reader = false) {
  history.replaceState(null, "", "?companion_page=journal");
  panel = document.createElement("kaleidescape-panel") as KaleidescapePanel;
  const client = transport.client();
  if (reader)
    vi.spyOn(client, "info").mockResolvedValue({
      entries: [
        {
          ...info,
          library_enabled: true,
          permissions: { read: true, edit: false, export: false },
        },
      ],
    });
  panel.client = client;
  document.body.append(panel);
  await vi.waitFor(() =>
    expect(
      root().querySelector(reader ? "kaleidescape-reader" : '[role="switch"]'),
    ).toBeTruthy(),
  );
  if (!reader) await vi.waitFor(() => expect(toggle().disabled).toBe(false));
}
async function basicLibrary() {
  await vi.waitFor(() =>
    expect(root().querySelector("kaleidescape-reader")).toBeTruthy(),
  );
  const reader = root().querySelector("kaleidescape-reader")!;
  await vi.waitFor(() =>
    expect(
      reader.shadowRoot!.querySelector('[aria-selected="true"]')?.textContent,
    ).toBe("Library"),
  );
  return reader;
}
afterEach(() => {
  panel?.remove();
  vi.restoreAllMocks();
  history.replaceState(null, "", "/");
});

it("saves Basic mode, hides management views, and restores Advanced mode", async () => {
  const transport = new FixtureTransport();
  await mount(transport);
  expect(root().querySelector("#page-database")).toBeTruthy();
  expect(toggle().closest("header")).toBeTruthy();
  expect(toggle().querySelector(".mode-label")?.textContent).toBe("Advanced");
  expect(toggle().firstElementChild?.className).toBe("mode-label");
  toggle().click();
  await vi.waitFor(() =>
    expect(root().querySelector("kaleidescape-reader")).toBeTruthy(),
  );
  const reader = root().querySelector("kaleidescape-reader")!;
  expect(
    reader.shadowRoot!.querySelector('header slot[name="view-mode"]'),
  ).toBeTruthy();
  expect(toggle().querySelector(".mode-label")?.textContent).toBe("Basic");
  await vi.waitFor(() =>
    expect(reader.shadowRoot!.textContent).toContain("Viewing details"),
  );
  expect(reader.shadowRoot!.textContent).not.toContain("Add viewing");
  expect(reader.shadowRoot!.querySelectorAll('[role="tab"]')).toHaveLength(3);
  expect(
    root().querySelector("kaleidescape-settings,kaleidescape-database"),
  ).toBeNull();
  expect(transport.interfacePreferences.advanced_view).toBe(false);
  toggle().click();
  await vi.waitFor(() =>
    expect(root().querySelector("#page-database")).toBeTruthy(),
  );
  expect(transport.interfacePreferences.advanced_view).toBe(true);
  expect(toggle().querySelector(".mode-label")?.textContent).toBe("Advanced");
});

it.each([
  ["now-playing", "See what’s playing across your system."],
  ["library", "Browse movies and collections."],
  ["journal", "Explore your viewing history."],
])(
  "keeps the %s header consistent in Basic and Advanced modes",
  async (page, subtitle) => {
    const transport = new FixtureTransport();
    transport.options.library_enabled = true;
    await mount(transport);
    root().querySelector<HTMLButtonElement>(`#page-${page}`)!.click();
    await vi.waitFor(() =>
      expect(root().querySelector("header p")?.textContent?.trim()).toBe(
        subtitle,
      ),
    );
    expect(root().querySelector("header h1")?.textContent).toBe(
      "Kaleidescape Companion",
    );
    expect(root().querySelector("header .eyebrow")).toBeNull();
    await vi.waitFor(() => expect(toggle().disabled).toBe(false));
    toggle().click();
    await vi.waitFor(() =>
      expect(root().querySelector("kaleidescape-reader")).toBeTruthy(),
    );
    const reader = root().querySelector("kaleidescape-reader")!;
    await vi.waitFor(() =>
      expect(
        reader.shadowRoot!.querySelector("header p")?.textContent?.trim(),
      ).toBe(subtitle),
    );
    expect(reader.shadowRoot!.querySelector("header h1")?.textContent).toBe(
      "Kaleidescape Companion",
    );
    expect(reader.shadowRoot!.querySelector("header .eyebrow")).toBeNull();
  },
);

it.each(["database", "settings"])(
  "returns from %s to the configured landing page in Basic mode",
  async (page) => {
    const transport = new FixtureTransport();
    transport.options.library_enabled = true;
    transport.options.default_landing_page = "library";
    await mount(transport);
    root().querySelector<HTMLButtonElement>(`#page-${page}`)!.click();
    await vi.waitFor(() =>
      expect(root().querySelector(`kaleidescape-${page}`)).toBeTruthy(),
    );
    await vi.waitFor(() => expect(toggle().disabled).toBe(false));
    toggle().click();
    const reader = await basicLibrary();
    expect(
      reader.shadowRoot!.querySelector("kaleidescape-library"),
    ).toBeTruthy();
    expect(new URL(location.href).searchParams.get("companion_page")).toBe(
      "library",
    );
  },
);

it("restores a saved Basic preference and never offers a mode switch to a regular user", async () => {
  const transport = new FixtureTransport();
  transport.interfacePreferences.advanced_view = false;
  await mount(transport);
  expect(root().querySelector("kaleidescape-reader")).toBeTruthy();
  expect(toggle().getAttribute("aria-checked")).toBe("false");
  panel.remove();
  await mount(new FixtureTransport(), true);
  expect(root().querySelector('[role="switch"]')).toBeNull();
});

it("protects an unconfirmed control operation before leaving Advanced mode", async () => {
  await mount(new FixtureTransport());
  root()
    .querySelector("#companion-page")!
    .dispatchEvent(
      new CustomEvent("control-lock", { detail: true, bubbles: true }),
    );
  await panel.updateComplete;
  expect(toggle().disabled).toBe(true);
  toggle().click();
  expect(root().querySelector("kaleidescape-reader")).toBeNull();
});

it("guards a dirty admin dialog and returns to the landing page after discarding", async () => {
  const transport = new FixtureTransport();
  transport.options.library_enabled = true;
  transport.options.default_landing_page = "library";
  await mount(transport);
  const click = (label: string) =>
    [...root().querySelectorAll<HTMLButtonElement>("button")]
      .find((node) => node.textContent!.trim() === label)!
      .click();
  click("The Lantern Voyage");
  await vi.waitFor(() =>
    expect(
      [...root().querySelectorAll("button")].some(
        (node) => node.textContent!.trim() === "Edit viewing",
      ),
    ).toBe(true),
  );
  click("Edit viewing");
  await vi.waitFor(() =>
    expect(
      root().querySelector<HTMLDialogElement>("#journal-editor")!.open,
    ).toBe(true),
  );
  const notes = root().querySelector<HTMLTextAreaElement>('[name="notes"]')!;
  notes.value = "Fictional unsaved correction";
  notes.dispatchEvent(new Event("input", { bubbles: true }));
  window.confirm = vi.fn().mockReturnValueOnce(false).mockReturnValue(true);
  toggle().click();
  await panel.updateComplete;
  expect(root().querySelector("kaleidescape-reader")).toBeNull();
  expect(notes.value).toBe("Fictional unsaved correction");
  toggle().click();
  await basicLibrary();
  expect(root().querySelector("#journal-editor")).toBeNull();
});

it("uses normal-user Library controls in Basic mode", async () => {
  const transport = new FixtureTransport();
  transport.options.library_enabled = true;
  transport.options.default_landing_page = "library";
  transport.interfacePreferences.advanced_view = false;
  await mount(transport);
  const reader = root().querySelector("kaleidescape-reader")!;
  await vi.waitFor(() =>
    expect(reader.shadowRoot!.querySelector("#reader-library")).toBeTruthy(),
  );
  reader
    .shadowRoot!.querySelector<HTMLButtonElement>("#reader-library")!
    .click();
  const library = await vi.waitFor(() => {
    const value = reader.shadowRoot!.querySelector("kaleidescape-library")!;
    expect(value?.shadowRoot?.textContent).toContain("Voyage to Europa");
    return value;
  });
  expect(
    library.shadowRoot!.querySelector(".scraper-conflict-icon"),
  ).toBeNull();
  expect(library.shadowRoot!.textContent).not.toContain("Sync now");
  const title = [
    ...library.shadowRoot!.querySelectorAll<HTMLButtonElement>("button"),
  ].find((node) => node.textContent!.trim() === "Voyage to Europa")!;
  title.click();
  await vi.waitFor(() =>
    expect(
      library.shadowRoot!.querySelector<HTMLDialogElement>(".movie-dialog")
        ?.open,
    ).toBe(true),
  );
  expect(
    library.shadowRoot!.querySelector(
      "kaleidescape-title-edit,kaleidescape-title-scrape",
    ),
  ).toBeNull();
});

it("keeps a shared view when leaving a non-admin Library dialog", async () => {
  const transport = new FixtureTransport();
  transport.options.library_enabled = true;
  transport.options.default_landing_page = "journal";
  await mount(transport);
  root().querySelector<HTMLButtonElement>("#page-library")!.click();
  const library = await vi.waitFor(() => {
    const value = root().querySelector("kaleidescape-library")!;
    expect(value?.shadowRoot?.textContent).toContain("Voyage to Europa");
    return value;
  });
  [...library.shadowRoot!.querySelectorAll<HTMLButtonElement>("button")]
    .find((node) => node.textContent!.trim() === "Filters")!
    .click();
  await vi.waitFor(() =>
    expect(
      library.shadowRoot!.querySelector<HTMLDialogElement>("#filter-dialog")!
        .open,
    ).toBe(true),
  );
  toggle().click();
  await basicLibrary();
});
