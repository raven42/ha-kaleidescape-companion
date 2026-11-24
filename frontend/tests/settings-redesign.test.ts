/** Settings workflows use fictional options and a simulated DOM, never devices. */
import { afterEach, expect, it, vi } from "vitest";
import "../src/ui/settings";
import type { KaleidescapeSettings } from "../src/ui/settings";
import { SETTINGS_INDEX } from "../src/ui/settings-catalog";
import { FixtureTransport, info } from "./fixture";

let element: KaleidescapeSettings;
afterEach(() => {
  element?.remove();
  vi.restoreAllMocks();
});
const root = () => element.shadowRoot!;
async function mount(
  options: Record<string, string | boolean> = {},
  credentialConfigured = false,
) {
  const transport = new FixtureTransport();
  transport.credentialConfigured = credentialConfigured;
  Object.assign(transport.options, options);
  transport.trackingEnabled = false;
  element = document.createElement(
    "kaleidescape-settings",
  ) as KaleidescapeSettings;
  element.client = transport.client();
  element.scope = {
    ...info,
    library_enabled: !!transport.options.library_enabled,
  };
  document.body.append(element);
  await vi.waitFor(() =>
    expect(root().querySelector("#companion-settings-form")).not.toBeNull(),
  );
  await vi.waitFor(() =>
    expect(
      root().querySelector<HTMLInputElement>('[name="fuzzy_search"]')?.disabled,
    ).toBe(false),
  );
  return transport;
}
async function flush() {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await element.updateComplete;
}
function save() {
  return [...root().querySelectorAll<HTMLButtonElement>("button")].find(
    (button) => button.textContent!.trim() === "Save settings",
  )!;
}
async function select(section: string) {
  root().querySelector<HTMLButtonElement>(`#settings-tab-${section}`)!.click();
  await flush();
}

it("categorizes every current option exactly once and has one automation inventory", async () => {
  const transport = await mount({
    library_enabled: true,
    calendar_enabled: true,
    calendar_entity: "calendar.movies",
    calendar_full_sync: true,
  });
  const inputs = [...root().querySelectorAll<HTMLElement>("[name]")];
  root()
    .querySelectorAll<HTMLElement>(
      "kaleidescape-enrichment-settings,kaleidescape-device-controls",
    )
    .forEach((component) =>
      inputs.push(
        ...component.shadowRoot!.querySelectorAll<HTMLElement>("[name]"),
      ),
    );
  for (const key of Object.keys(transport.options)) {
    expect(
      inputs.filter((input) => input.getAttribute("name") === key),
      key,
    ).toHaveLength(1);
    expect(
      SETTINGS_INDEX.filter((field) => field.key === key),
      key,
    ).toHaveLength(1);
    const control = inputs.find((input) => input.getAttribute("name") === key)!;
    const description = control.getAttribute("aria-describedby");
    expect(description, `${key} has contextual help`).toBeTruthy();
    expect(
      (control.getRootNode() as ShadowRoot)
        .getElementById(description!)
        ?.textContent?.trim(),
      key,
    ).toBeTruthy();
  }
  expect(
    root().querySelectorAll("kaleidescape-automation-blueprints"),
  ).toHaveLength(1);
  expect(
    root().querySelector(
      '[name="library_interval_hours"],[name="calendar_full_sync_time"]',
    ),
  ).toBeNull();
  expect(root().querySelector("#settings-journal")!.textContent).toContain(
    "Play-status sensor",
  );
  expect(root().querySelector("#settings-journal")!.textContent).toContain(
    "Resume window",
  );
  const resume = root().querySelector<HTMLInputElement>(
    '[name="resume_minutes"]',
  )!;
  expect([resume.value, resume.min, resume.max, resume.step]).toEqual([
    "60",
    "1",
    "60",
    "1",
  ]);
  expect(resume.parentElement!.textContent).toContain("minutes");
  const partial = root().querySelector<HTMLInputElement>(
    '[name="partial_minimum_minutes"]',
  )!;
  expect([partial.value, partial.min, partial.step]).toEqual(["10", "1", "1"]);
  for (const key of [
    "minimum_runtime_minutes",
    "minimum_seconds",
    "partial_minimum_minutes",
    "resume_minutes",
  ]) {
    expect(root().getElementById(`${key}-hint`)?.textContent).toMatch(
      /example/i,
    );
  }
  expect(root().querySelector("#settings-library")!.textContent).toContain(
    "Collection visibility",
  );
});

it("requests a targeted refresh for missing metadata or artwork", async () => {
  await mount({ library_enabled: true });
  await select("metadata");
  const child = root().querySelector("kaleidescape-enrichment-settings")!;
  const status = vi.spyOn(element.client!, "metadataStatus").mockResolvedValue({
    enabled: true,
    active: 0,
    queued: 0,
    failed: 0,
    running: false,
    processed: 0,
    updated: 0,
    skipped: 0,
    total: 0,
    error: null,
    last_finished: null,
  });
  const button = [...child.shadowRoot!.querySelectorAll("button")].find(
    (item) =>
      item.textContent?.trim() === "Refresh missing metadata or artwork",
  )!;
  expect(button.disabled).toBe(false);
  button.click();
  await vi.waitFor(() =>
    expect(status).toHaveBeenCalledWith(element.scope, true, true),
  );
});

it("stages TMDB removal with a button, supports Undo and only applies on Save", async () => {
  const transport = await mount({}, true);
  await select("metadata");
  const metadata = root().querySelector(
    "kaleidescape-enrichment-settings",
  )!.shadowRoot!;
  const remove = metadata.querySelector<HTMLButtonElement>(
    '[name="metadata_clear_tmdb_key"]',
  )!;
  const credential = metadata.querySelector<HTMLInputElement>(
    '[name="metadata_tmdb_credential"]',
  )!;
  expect(remove.tagName).toBe("BUTTON");
  expect(remove.textContent?.trim()).toBe("Remove");
  expect(remove.disabled).toBe(false);
  remove.click();
  await flush();
  expect(remove.textContent?.trim()).toBe("Undo");
  expect(credential.disabled).toBe(true);
  expect(metadata.textContent).toContain("Credential removal pending");
  expect(
    transport.calls.some((call) => call.type.endsWith("/settings/submit")),
  ).toBe(false);
  remove.click();
  await flush();
  expect(credential.disabled).toBe(false);
  expect(save().disabled).toBe(true);
  remove.click();
  await flush();
  save().click();
  await flush();
  expect(transport.options.metadata_clear_tmdb_key).toBe(true);
  expect(transport.credentialConfigured).toBe(false);
});

it("searches settings and focuses the corresponding provider field without submitting", async () => {
  const transport = await mount();
  const search = root().querySelector<HTMLInputElement>(
    'input[type="search"]',
  )!;
  search.value = "TMDB credential";
  search.dispatchEvent(new Event("input"));
  await flush();
  const result = [
    ...root().querySelectorAll<HTMLButtonElement>(".search-results li button"),
  ].find(
    (button) =>
      button.querySelector("strong")!.textContent === "TMDB credential",
  )!;
  result.click();
  await flush();
  expect(root().querySelector<HTMLElement>("#settings-metadata")!.hidden).toBe(
    false,
  );
  expect(
    root()
      .querySelector("kaleidescape-enrichment-settings")!
      .shadowRoot!.activeElement?.getAttribute("name"),
  ).toBe("metadata_tmdb_credential");
  expect(root().querySelector(".search-results")).toBeNull();
  expect(
    transport.calls.some((call) => call.type.endsWith("/settings/submit")),
  ).toBe(false);
  expect(save().disabled).toBe(true);
});

it("stages the shared search setting until Save settings", async () => {
  const transport = await mount();
  root().querySelector<HTMLInputElement>('[name="fuzzy_search"]')!.click();
  await flush();
  expect(save().disabled).toBe(false);
  expect(
    transport.calls.some((call) =>
      call.type.endsWith("/ui/preferences/update"),
    ),
  ).toBe(false);
  expect(root().querySelector(".save-status")!.textContent).toContain(
    "1 unsaved setting",
  );
  save().click();
  await vi.waitFor(() => expect(transport.options.fuzzy_search).toBe(false));
});

it("updates the landing page on input before change and saves the selected value", async () => {
  const transport = await mount();
  const select = root().querySelector<HTMLSelectElement>(
    '[name="default_landing_page"]',
  )!;
  select.value = "library";
  select.dispatchEvent(new Event("input", { bubbles: true }));
  await flush();
  select.dispatchEvent(new Event("change", { bubbles: true }));
  await flush();
  expect(select.value).toBe("library");
  save().click();
  await vi.waitFor(() =>
    expect(transport.options.default_landing_page).toBe("library"),
  );
});

it("reveals invalid metadata fields on submit, including an implicit form submit", async () => {
  const transport = await mount();
  const metadata = root().querySelector(
    "kaleidescape-enrichment-settings",
  )!.shadowRoot!;
  const rate = metadata.querySelector<HTMLInputElement>(
    '[name="metadata_requests_per_second"]',
  )!;
  rate.value = "0.05";
  rate.dispatchEvent(new Event("input", { bubbles: true }));
  await flush();
  root().querySelector<HTMLFormElement>("form")!.requestSubmit();
  await flush();
  expect(root().querySelector<HTMLElement>("#settings-metadata")!.hidden).toBe(
    false,
  );
  expect(metadata.activeElement).toBe(rate);
  expect(
    transport.calls.some((call) => call.type.endsWith("/settings/submit")),
  ).toBe(false);
  rate.value = "0.15";
  rate.dispatchEvent(new Event("input", { bubbles: true }));
  await flush();
  save().click();
  await flush();
  expect(transport.options.metadata_requests_per_second).toBe(0.15);
});

it("inserts a calendar field at the selection and preserves the draft across categories", async () => {
  await mount({ calendar_enabled: true, calendar_entity: "calendar.movies" });
  await select("calendar");
  const title = root().querySelector<HTMLInputElement>(
    '[name="calendar_title"]',
  )!;
  title.value = "Film: placeholder";
  title.dispatchEvent(new Event("input", { bubbles: true }));
  title.setSelectionRange(6, 17);
  root()
    .querySelector<HTMLButtonElement>(
      '[aria-label="Insert title in event title"]',
    )!
    .click();
  await flush();
  expect(title.value).toBe("Film: {title}");
  await select("general");
  await select("calendar");
  expect(
    root().querySelector<HTMLInputElement>('[name="calendar_title"]')!.value,
  ).toBe("Film: {title}");
});

it("clears drafts and provider credentials when administrator access is revoked", async () => {
  await mount();
  const credential = root()
    .querySelector("kaleidescape-enrichment-settings")!
    .shadowRoot!.querySelector<HTMLInputElement>(
      '[name="metadata_tmdb_credential"]',
    )!;
  credential.value = "PRIVATE-UNSAVED-CREDENTIAL";
  credential.dispatchEvent(new Event("input", { bubbles: true }));
  await flush();
  element.scope = {
    ...info,
    permissions: { ...info.permissions, edit: false },
  };
  await flush();
  expect(root().querySelector("form")).toBeNull();
  expect(root().textContent).not.toContain("PRIVATE-UNSAVED");
  expect(save().disabled).toBe(true);
});

it("shows library and purchase summaries in About and loads totals on demand", async () => {
  const transport = await mount({ library_enabled: true });
  transport.purchaseTotals = {
    ...transport.purchaseTotals,
    purchase_count: 1,
    unpaired_prices: 1,
    missing_price_entries: 1,
    currency_mismatch_entries: 0,
    missing_information_titles: 4,
    currencies: [
      {
        currency: "$",
        library_cost: "$12.34",
        retail_price: "$20.00",
        savings: "$7.66",
      },
    ],
  };
  await select("about");
  expect(root().querySelector("#settings-about")!.textContent).toContain(
    "Library details",
  );
  expect(
    transport.calls.some((call) =>
      call.type.endsWith("library/purchases/summary"),
    ),
  ).toBe(false);
  const details = root().querySelector<HTMLDetailsElement>(
    "#settings-about .purchase-details",
  )!;
  details.open = true;
  details.dispatchEvent(new Event("toggle"));
  await vi.waitFor(() => expect(details.textContent).toContain("$12.34"));
  expect(details.textContent).toContain(
    "Library titles missing purchase information",
  );
  expect(details.textContent!.replace(/\s+/g, " ")).toContain(
    "Titles without a purchase entry are excluded",
  );
  expect(details.textContent).toContain("purchase dates");
  expect(details.textContent).toContain(
    "excluded from savings because a paid or retail price is missing",
  );
  expect(details.textContent).not.toContain(
    "excluded from savings because the paid and retail prices use different currencies",
  );
  details.open = false;
  details.dispatchEvent(new Event("toggle"));
  transport.purchaseTotals.currencies[0].library_cost = "$19.00";
  transport.purchaseTotals.missing_price_entries = 0;
  transport.purchaseTotals.currency_mismatch_entries = 1;
  details.open = true;
  details.dispatchEvent(new Event("toggle"));
  await vi.waitFor(() => expect(details.textContent).toContain("$19.00"));
  expect(details.textContent?.replace(/\s+/g, " ")).toContain(
    "excluded from savings because the paid and retail prices use different currencies",
  );
});

it("shows current sensor states, attributes and reference information in About", async () => {
  await mount({ library_enabled: true, calendar_enabled: true });
  const fetchSensors = vi
    .spyOn(element.client!, "aboutSensors")
    .mockResolvedValue({
      movies_7_days: {
        entity_id: "sensor.renamed_history",
        state: "2",
        unit: null,
        attributes: { movies: ["A fictional movie"], truncated: false },
      },
    });
  await select("about");
  await vi.waitFor(() => expect(fetchSensors).toHaveBeenCalledOnce());
  const details = [...root().querySelectorAll("details")].find((item) =>
    item.textContent?.includes("Movies watched last 7 days"),
  )!;
  expect(details.textContent).toContain("sensor.renamed_history");
  expect(details.textContent).toContain("A fictional movie");
  expect(details.textContent).toContain("rolling seven-day window");
  expect(root().textContent).toContain("Integration status");
  expect(root().querySelectorAll(".sensor-detail")).toHaveLength(17);
});

it("restores the settings category after remount and supports browser Back", async () => {
  history.replaceState(
    null,
    "",
    "/kaleidescape-companion?companion_page=settings",
  );
  await mount();
  await select("library");
  expect(new URL(location.href).searchParams.get("companion_settings")).toBe(
    "library",
  );
  element.remove();
  await mount();
  expect(
    root()
      .querySelector("#settings-tab-library")
      ?.getAttribute("aria-selected"),
  ).toBe("true");
  history.replaceState(
    null,
    "",
    "/kaleidescape-companion?companion_page=settings&companion_settings=general",
  );
  window.dispatchEvent(new PopStateEvent("popstate"));
  await flush();
  expect(
    root()
      .querySelector("#settings-tab-general")
      ?.getAttribute("aria-selected"),
  ).toBe("true");
});

it("starts the sensor inventory collapsed", async () => {
  await mount();
  await select("about");
  const section = root().querySelector<HTMLDetailsElement>(".sensors-section")!;
  expect(section.open).toBe(false);
  expect(section.querySelector("summary")?.textContent?.trim()).toBe(
    "Sensor details",
  );
  expect(
    section.closest(".settings-card")?.querySelector("h3")?.textContent,
  ).toBe("Home Assistant sensors");
  expect(section.querySelectorAll(".sensor-detail")).toHaveLength(17);
});
