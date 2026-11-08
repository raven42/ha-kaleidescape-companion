/** Fictional dashboard lifecycle and permissions; browser layout review is separate. */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import "../src/cards/cards";
import type { CompanionCard } from "../src/cards/cards";
import { CARD_KINDS, cardConfig } from "../src/cards/config";
import type { Hass } from "../src/core/api";
import type { KaleidescapeLibrary } from "../src/library/library";
import type { DeviceControls } from "../src/playback/controls";
import { FixtureTransport, info, libraryTitle } from "./fixture";
let transport: FixtureTransport;
let cards: CompanionCard[];
function hass(admin = false): Hass {
  return {
    user: { id: "fictional-dashboard-user", is_admin: admin },
    connection: { connected: true },
    callWS: (message) => transport.callWS(message),
    fetchWithAuth: (path, init) => transport.fetchWithAuth(path, init),
  };
}
async function mount(
  kind: (typeof CARD_KINDS)[number],
  config: Record<string, unknown> = {},
  context = hass(),
) {
  const card = document.createElement(
    `kaleidescape-${kind}-card`,
  ) as CompanionCard;
  cards.push(card);
  card.setConfig({ type: `custom:kaleidescape-${kind}-card`, ...config });
  card.hass = context;
  document.body.append(card);
  await vi.waitFor(() =>
    expect(card.shadowRoot!.querySelector("ha-card")).not.toBeNull(),
  );
  return card;
}
beforeEach(() => {
  transport = new FixtureTransport();
  cards = [];
  transport.options.library_enabled = true;
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
});
afterEach(() => {
  cards.forEach((card) => card.remove());
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it.each(CARD_KINDS)(
  "registers the %s card and exposes an HA editor schema without sending mutations",
  async (kind) => {
    const tag = `kaleidescape-${kind}-card`;
    const type = customElements.get(tag) as typeof CompanionCard;
    expect(type.getConfigForm().schema.length).toBeGreaterThan(1);
    const card = await mount(kind);
    await vi.waitFor(() =>
      expect(transport.calls.some((call) => call.type.endsWith("/info"))).toBe(
        true,
      ),
    );
    expect(card.getGridOptions().min_columns).toBe(6);
    expect(
      transport.calls.some((call) =>
        /execute|create|discover|update/.test(call.type),
      ),
    ).toBe(false);
  },
);
it("connects search to matching Library cards and keeps card preferences separate from personal settings", async () => {
  transport.uiPreferences.query = "Old personal query";
  const library = await mount("library-covers", {
    channel: "cinema",
    columns: 3,
    page_size: 7,
  });
  const other = await mount("library-covers", { channel: "other" });
  const search = await mount("library-search", { channel: "cinema" });
  await vi.waitFor(() =>
    expect(
      library.shadowRoot!.querySelector("kaleidescape-library"),
    ).not.toBeNull(),
  );
  const component = library.shadowRoot!.querySelector<KaleidescapeLibrary>(
    "kaleidescape-library",
  )!;
  await vi.waitFor(() =>
    expect(component.shadowRoot!.querySelector(".cover-grid")).not.toBeNull(),
  );
  expect(
    component.shadowRoot!.querySelector(".cover-grid")?.getAttribute("style"),
  ).toContain("--cover-columns: 3");
  expect(
    component.shadowRoot!.querySelector<HTMLElement>(".library-toolbar")
      ?.hidden,
  ).toBe(true);
  const input = search.shadowRoot!.querySelector<HTMLInputElement>("input")!;
  input.value = "Europa";
  input.dispatchEvent(new Event("input"));
  search
    .shadowRoot!.querySelector("form")!
    .dispatchEvent(new Event("submit", { cancelable: true }));
  await vi.waitFor(() =>
    expect(component.openCriterion).toEqual({ key: "query", value: "Europa" }),
  );
  expect(
    other.shadowRoot!.querySelector<KaleidescapeLibrary>("kaleidescape-library")
      ?.openCriterion,
  ).toBeUndefined();
  expect(transport.uiPreferences.query).toBe("Old personal query");
  expect(
    transport.calls.some((call) => call.type.endsWith("ui/preferences/update")),
  ).toBe(false);
});
it("masks administrator-only tools on dashboard Library cards and honors display configuration", async () => {
  const card = await mount(
    "library",
    {
      search_position: "bottom",
      show_filters: false,
      show_sort: false,
      show_stats: false,
    },
    hass(true),
  );
  await vi.waitFor(() =>
    expect(
      card.shadowRoot!.querySelector("kaleidescape-library"),
    ).not.toBeNull(),
  );
  const library = card.shadowRoot!.querySelector<KaleidescapeLibrary>(
    "kaleidescape-library",
  )!;
  await vi.waitFor(() =>
    expect(
      library.shadowRoot!.querySelector(".library-toolbar"),
    ).not.toBeNull(),
  );
  expect(library.scope?.permissions.edit).toBe(false);
  expect(library.shadowRoot!.querySelector(".toolbar-bottom")).not.toBeNull();
  expect(
    library.shadowRoot!.querySelector<HTMLElement>(".footer-summary")!.hidden,
  ).toBe(true);
  expect(
    library.shadowRoot!.querySelector('[name="show_library_cost"]'),
  ).toBeNull();
});
it("drops data and child components on disconnect and ignores late account responses", async () => {
  let release!: (value: unknown) => void;
  const context = hass();
  context.callWS = () =>
    new Promise((resolve) => {
      release = resolve;
    }) as never;
  const card = await mount("library", {}, context);
  await vi.waitFor(() => expect(release).toBeTypeOf("function"));
  card.hass = { ...context, user: undefined, connection: { connected: false } };
  await card.updateComplete;
  release({ entries: [info] });
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(card.shadowRoot!.querySelector("kaleidescape-library")).toBeNull();
  expect(card.shadowRoot!.textContent).toContain("Sign in");
});
it("renders the shared remote directly in the remote card", async () => {
  transport.options.control_enabled = true;
  transport.options.control_player = "1A2B";
  const original = transport.callWS.bind(transport);
  vi.spyOn(transport, "callWS").mockImplementation(async (message) =>
    message.type.endsWith("control/status")
      ? ({
          ready: true,
          readiness: "ready",
          power_state: "on",
          state: { mode: 0 },
        } as never)
      : original(message),
  );
  const card = await mount("remote");
  await vi.waitFor(() =>
    expect(
      card.shadowRoot!.querySelector("kaleidescape-device-controls"),
    ).not.toBeNull(),
  );
  const remote = card.shadowRoot!.querySelector<DeviceControls>(
    "kaleidescape-device-controls",
  )!;
  await vi.waitFor(() =>
    expect(remote.shadowRoot!.querySelector(".remote-pad")).not.toBeNull(),
  );
  expect(remote.shadowRoot!.querySelector("dialog")!.open).toBe(false);
  expect(remote.inlineRemote).toBe(true);
  expect(
    transport.calls.some((call) => call.type.endsWith("control/execute")),
  ).toBe(false);
});
it("rejects invalid layout bounds and defers reconfiguration during a player command", async () => {
  expect(() =>
    cardConfig({ type: "custom:test", page_size: 1001 }, "library"),
  ).toThrow();
  expect(() =>
    cardConfig({ type: "custom:test", columns: 0 }, "library"),
  ).toThrow();
  const card = await mount("remote");
  card
    .shadowRoot!.querySelector("ha-card")!
    .dispatchEvent(
      new CustomEvent("control-lock", { detail: true, bubbles: true }),
    );
  expect(() =>
    card.setConfig({ type: "custom:kaleidescape-remote-card" }),
  ).toThrow("pending player command");
});

it("keeps legacy dashboard format settings and permits separate audio controls", async () => {
  const old = cardConfig(
    { type: "custom:test", show_format: false },
    "library",
  );
  expect(old.show_audio_format).toBe(false);
  expect(
    cardConfig(
      { type: "custom:test", show_format: false, show_audio_format: true },
      "library",
    ).show_audio_format,
  ).toBe(true);
  expect(() =>
    cardConfig({ type: "custom:test", show_audio_format: "yes" }, "library"),
  ).toThrow();
  transport.libraryTitles = [libraryTitle({ formats: ["4K Dolby Atmos"] })];
  const card = await mount("library", {
    show_format: false,
    show_audio_format: true,
  });
  await vi.waitFor(() => {
    const library = card.shadowRoot!.querySelector<KaleidescapeLibrary>(
      "kaleidescape-library",
    );
    expect(
      library?.shadowRoot?.querySelector(".cover-formats .format-atmos"),
    ).toBeTruthy();
    expect(
      library?.shadowRoot?.querySelector(".cover-formats .format-four-k"),
    ).toBeNull();
  });
});

it("renders card titles as text and clears the selected month URL behavior in dashboard calendars", async () => {
  const calendar = await mount("journal-calendar", {
    title: "<img src=x onerror=alert(1)>",
  });
  expect(calendar.shadowRoot!.querySelector("h2 img")).toBeNull();
  expect(calendar.shadowRoot!.querySelector("h2")?.textContent).toContain(
    "<img",
  );
  await vi.waitFor(() =>
    expect(
      calendar.shadowRoot!.querySelector("kaleidescape-journal-calendar"),
    ).not.toBeNull(),
  );
  expect(
    (
      calendar.shadowRoot!.querySelector(
        "kaleidescape-journal-calendar",
      ) as import("../src/ui/journal-calendar").JournalCalendar
    ).rememberUrl,
  ).toBe(false);
});

it("can explicitly reload the authenticated scope after a child access denial", async () => {
  const card = await mount("library");
  await vi.waitFor(() =>
    expect(
      card.shadowRoot!.querySelector("kaleidescape-library"),
    ).not.toBeNull(),
  );
  card
    .shadowRoot!.querySelector("ha-card")!
    .dispatchEvent(new CustomEvent("access-denied", { bubbles: true }));
  await card.updateComplete;
  expect(card.shadowRoot!.querySelector("kaleidescape-library")).toBeNull();
  [...card.shadowRoot!.querySelectorAll<HTMLButtonElement>("button")]
    .find((button) => button.textContent?.trim() === "Retry")!
    .click();
  await vi.waitFor(() =>
    expect(
      card.shadowRoot!.querySelector("kaleidescape-library"),
    ).not.toBeNull(),
  );
});
