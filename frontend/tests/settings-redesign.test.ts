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
  expect(root().querySelector("#settings-library")!.textContent).toContain(
    "Collection visibility",
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
  details.open = false;
  details.dispatchEvent(new Event("toggle"));
  transport.purchaseTotals.currencies[0].library_cost = "$19.00";
  details.open = true;
  details.dispatchEvent(new Event("toggle"));
  await vi.waitFor(() => expect(details.textContent).toContain("$19.00"));
});
