/** Administrator settings page backed by Companion's native HA options flow. */
import { LitElement, css, html, nothing } from "lit";
import type { PropertyValues } from "lit";
import { ApiError, errorCode, errorMessage } from "../core/api";
import type {
  JournalClient,
  JournalInfo,
  LibraryInfo,
  LibraryPurchaseTotals,
  OptionsForm,
  Scope,
} from "../core/api";
import { styles } from "./styles";
import { settingsStyles } from "./settings-styles";
import { settingLabel, settingHint } from "./settings-hint";
import {
  SETTINGS_SECTIONS,
  SETTINGS_INDEX,
  JOURNAL_FIELDS,
  LIBRARY_FIELDS,
  TOGGLES,
  BOOLEAN_FIELDS,
  changedSettings,
  searchSettings,
} from "./settings-catalog";
import type {
  SettingsSection,
  SettingsDraft,
  SettingField,
} from "./settings-catalog";
import { collectionLabel } from "../library/badges";
import { counted } from "../core/text";
import { fullSyncSettings } from "./calendar-settings";
import "./calendar-export";
import "./automation-blueprints";
import "./settings-transfer";
import "./test-dashboard";
import type { TestDashboard } from "./test-dashboard";
import { CalendarExport } from "./calendar-export";
import "./metadata-repair";
import "./database-cleanup";
import type { MetadataRepair } from "./metadata-repair";
import { PreferenceStore } from "./preference-store";
import "../playback/controls";
import "../enrichment/settings";

const validation: Record<string, string> = {
  invalid_calendar_full_sync: "Use an age window of 1–12 whole months.",
  calendar_dedicated_required:
    "Acknowledge that Full Sync uses a separate calendar and deletes unmatched events.",
  calendar_full_sync_unsupported:
    "Full Sync requires a calendar with event creation and deletion support.",
  invalid_calendar:
    "Choose an existing calendar that supports creating events.",
  invalid_calendar_template:
    "Use only the listed brace fields, without attributes or format specifiers.",
  invalid_display_options: "Choose a valid default landing page.",
  missing_entities: "Select all three source entities to enable tracking.",
  invalid_entities: "Choose existing media_player and sensor entity IDs.",
  duplicate_entities:
    "Choose different sensors for play status and media location.",
  invalid_rules: "Check the runtime, completion, and partial-resume values.",
  invalid_metadata_options:
    "Use a valid provider credential and a request rate from 0.1 to 10 per second.",
  invalid_control_options:
    "Use a private LAN control hostname/IP and a valid player serial number.",
  invalid_library_host:
    "Enter a hostname or private LAN HTTP(S) origin without a path, credentials, or query.",
  invalid_library_options:
    "Choose a purchase window of 0–520 weeks and an artwork cache limit of 32–4096 MiB.",
};

export class KaleidescapeSettings extends LitElement {
  static properties = {
    client: { attribute: false },
    scope: { attribute: false },
  };
  static styles = [
    styles,
    settingsStyles,
    css`
      [hidden] {
        display: none !important;
      }
      .settings-page {
        max-width: 1240px;
        padding: 0;
        margin: 22px auto 0;
      }
      .settings-top {
        position: sticky;
        top: var(--companion-sticky-top, 0px);
        z-index: 15;
        background: var(--primary-background-color, #f5f7f6);
        border-bottom: 1px solid var(--line);
        display: flex;
        justify-content: space-between;
        gap: 20px;
        align-items: center;
        padding: 16px 0;
        margin-bottom: 26px;
      }
      .settings-top h2 {
        font-size: 30px;
        margin: 4px 0 5px;
        letter-spacing: -0.04em;
      }
      .save-status {
        color: var(--muted);
        font-size: 12px;
        margin: 0;
      }
      .settings-layout {
        display: grid;
        grid-template-columns: 205px minmax(0, 1fr);
        gap: 32px;
        align-items: start;
      }
      .settings-sidebar {
        position: sticky;
        top: calc(var(--companion-sticky-top, 0px) + 132px);
        min-width: 0;
      }
      .settings-search {
        margin-bottom: 20px;
        font-size: 12px;
      }
      .settings-tabs {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .settings-tabs button {
        text-align: left;
        background: transparent;
        border-color: transparent;
        padding: 11px 14px;
        position: relative;
      }
      .settings-tabs button[aria-selected="true"] {
        color: var(--accent);
        background: var(--surface);
        border-color: var(--line);
        font-weight: 700;
        box-shadow: inset 3px 0 var(--accent);
      }
      .settings-tabs button.has-changes::after {
        content: "";
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: var(--accent);
        position: absolute;
        right: 12px;
        top: 19px;
      }
      .settings-legend {
        font-size: 12px;
        color: var(--muted);
        margin: 22px 10px 0;
      }
      .mobile-category {
        display: none;
      }
      .settings-content {
        min-width: 0;
      }
      .settings-fieldset {
        border: 0;
        padding: 0;
        margin: 0;
        min-width: 0;
      }
      .category-heading {
        margin: 0 0 24px;
      }
      .category-heading h2 {
        font-size: 25px;
        font-weight: 650;
        letter-spacing: -0.03em;
        margin: 0 0 8px;
      }
      .category-heading p {
        color: var(--muted);
        margin: 0;
        font-size: 14px;
      }
      .spaced {
        margin-top: 22px;
      }
      .setup-guide ol,
      .setup-steps {
        padding-left: 22px;
        color: var(--muted);
        line-height: 1.7;
      }
      .setup-guide li {
        padding: 6px 0;
      }
      .setup-guide small {
        display: block;
      }
      .template-tokens {
        display: flex;
        gap: 7px;
        flex-wrap: wrap;
      }
      .template-tokens button {
        padding: 5px 9px;
        font-size: 12px;
        min-height: 36px;
      }
      .version-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 20px;
      }
      .purchase-summary {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px 16px;
      }
      .purchase-summary dd {
        margin: 0;
        text-align: end;
      }
      .version-grid dt {
        color: var(--muted);
        font-size: 12px;
      }
      .version-grid dd {
        margin: 5px 0 0;
        font-size: 18px;
        font-weight: 650;
        overflow-wrap: anywhere;
      }
      .reference-links {
        display: flex;
        gap: 18px;
        flex-wrap: wrap;
        font-size: 14px;
      }
      .search-results ul {
        list-style: none;
        padding: 0;
      }
      .search-results li + li {
        border-top: 1px solid var(--line);
      }
      .search-results li button {
        display: flex;
        gap: 16px;
        align-items: center;
        justify-content: space-between;
        text-align: left;
        width: 100%;
        border: 0;
        background: transparent;
        padding: 14px 0;
      }
      .search-results small {
        display: block;
        margin-top: 5px;
      }
      @media (max-width: 800px) {
        .settings-layout {
          grid-template-columns: minmax(0, 1fr);
          gap: 22px;
        }
        .settings-sidebar {
          position: static;
        }
        .settings-tabs,
        .settings-legend {
          display: none;
        }
        .mobile-category {
          display: flex;
        }
        .settings-search {
          margin-bottom: 14px;
        }
        .settings-top {
          margin-bottom: 20px;
        }
      }
      @media (max-width: 480px) {
        .settings-top {
          align-items: flex-start;
          flex-direction: column;
          gap: 12px;
        }
        .settings-top .actions {
          width: 100%;
        }
        .settings-top .actions button {
          flex: 1;
          padding-inline: 10px;
        }
        .settings-top h2 {
          font-size: 26px;
        }
        .version-grid {
          grid-template-columns: minmax(0, 1fr);
        }
        .search-results li button {
          align-items: flex-start;
          flex-direction: column;
          gap: 8px;
        }
      }
    `,
  ];
  client?: JournalClient;
  scope?: JournalInfo;
  private tab: SettingsSection = "general";
  private search = "";
  private automationBusy = false;
  private generation = 0;
  private flow?: OptionsForm;
  private draft: Record<string, string | number | boolean | string[]> = {};
  private initial: Record<string, string | number | boolean | string[]> = {};
  private collectionChoices: string[] = [];
  private hiddenCollections: string[] = [];
  private savedHiddenCollections: string[] = [];
  private savingCollections = false;
  private libraryInfo?: LibraryInfo;
  private purchaseTotals?: LibraryPurchaseTotals;
  private purchaseLoading = false;
  private purchaseError = "";
  private sharedPreferences?: PreferenceStore;
  private sharedReady = false;
  private sharedError = "";
  private customCollection = "";
  private loading = false;
  private saving = false;
  private uncertain = false;
  private dashboardBusy = false;
  private error = "";
  private bound = "";
  private boundClient?: JournalClient;
  private boundScope?: Scope;

  protected willUpdate(changed: PropertyValues) {
    if (!changed.has("client") && !changed.has("scope")) return;
    const key = `${this.scope?.entry_id}:${this.scope?.dataset_id}:${!!this.scope?.permissions.edit}`;
    if (key === this.bound && this.client === this.boundClient) return;
    this.cancelFlow();
    this.bound = key;
    this.boundClient = this.client;
    this.boundScope = this.scope;
    this.flow = undefined;
    this.draft = {};
    this.initial = {};
    this.collectionChoices = [];
    this.customCollection = "";
    this.uncertain = this.saving = false;
    if (this.client && this.scope?.permissions.edit) void this.start();
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    this.cancelFlow();
    this.flow = undefined;
    this.draft = {};
    this.initial = {};
    this.collectionChoices = [];
    this.customCollection = "";
    this.bound = "";
    this.boundClient = undefined;
  }
  connectedCallback() {
    super.connectedCallback();
    this.requestUpdate("client");
    this.requestUpdate("scope");
  }
  protected updated() {
    const landing = this.renderRoot.querySelector<HTMLSelectElement>(
      '[name="default_landing_page"]',
    );
    const value = String(this.draft.default_landing_page ?? "journal");
    if (landing && landing.value !== value) landing.value = value;
  }
  private cancelFlow() {
    this.search = "";
    this.sharedPreferences?.dispose();
    this.sharedPreferences = undefined;
    this.hiddenCollections = [];
    this.savedHiddenCollections = [];
    this.savingCollections = false;
    this.libraryInfo = undefined;
    this.purchaseTotals = undefined;
    this.purchaseLoading = false;
    this.purchaseError = "";
    this.sharedReady = false;
    this.sharedError = "";
    this.generation++;
    if (this.flow?.flow_id && this.boundClient && this.boundScope)
      void this.boundClient
        .settings(this.boundScope, "cancel", { flow_id: this.flow.flow_id })
        .catch(() => {});
  }
  private fail(error: unknown) {
    this.error = errorMessage(error);
    if (errorCode(error) === "unauthorized") {
      this.sharedPreferences?.dispose();
      this.sharedPreferences = undefined;
      this.sharedReady = false;
      this.hiddenCollections = [];
      this.savedHiddenCollections = [];
      this.libraryInfo = undefined;
      this.purchaseTotals = undefined;
      this.flow = undefined;
      this.draft = {};
      this.initial = {};
      this.dispatchEvent(
        new CustomEvent("access-denied", { bubbles: true, composed: true }),
      );
    }
    this.requestUpdate();
  }
  private async start() {
    const client = this.client!,
      scope = this.scope!,
      generation = ++this.generation;
    this.loading = true;
    this.error = "";
    this.requestUpdate();
    try {
      const flow = await client.settings(scope, "start");
      if (generation !== this.generation) {
        if (flow.flow_id)
          void client
            .settings(scope, "cancel", { flow_id: flow.flow_id })
            .catch(() => {});
        return;
      }
      this.flow = flow;
      this.draft = Object.fromEntries(
        (flow.fields ?? []).map((field) => [
          field.name,
          BOOLEAN_FIELDS.has(field.name)
            ? !!field.default
            : String(field.default ?? ""),
        ]),
      );
      this.initial = { ...this.draft };
      this.sharedPreferences = new PreferenceStore(
        client,
        scope,
        true,
        (error) => {
          if (generation !== this.generation) return;
          if (error && errorCode(error) === "unauthorized") this.fail(error);
          else {
            this.sharedError = error ? errorMessage(error) : "";
            this.requestUpdate();
          }
        },
      );
      const shared = await this.sharedPreferences.load();
      if (generation !== this.generation) return;
      this.hiddenCollections = [...(shared.hidden_collections as string[])];
      this.savedHiddenCollections = [...this.hiddenCollections];
      this.sharedReady = true;
      if (scope.library_enabled) {
        const library = await client.libraryInfo(scope);
        if (generation === this.generation) {
          this.libraryInfo = library;
          this.collectionChoices = library.collection_names ?? [];
        }
      }
    } catch (error) {
      if (generation === this.generation) this.fail(error);
    } finally {
      if (generation === this.generation) {
        this.loading = false;
        if (this.tab === "general") void this.selectTab("general");
        this.requestUpdate();
      }
    }
  }
  confirmNavigation() {
    const exporting = this.renderRoot.querySelector<CalendarExport>(
      "kaleidescape-calendar-export",
    );
    const dashboard = this.renderRoot.querySelector<TestDashboard>(
      "kaleidescape-test-dashboard",
    );
    const repairing = this.renderRoot.querySelector<MetadataRepair>(
      "kaleidescape-metadata-repair",
    );
    if (
      this.saving ||
      this.savingCollections ||
      this.automationBusy ||
      (dashboard && !dashboard.confirmNavigation()) ||
      (exporting && !exporting.confirmNavigation()) ||
      (repairing && !repairing.confirmNavigation())
    )
      return false;
    if (this.uncertain)
      return window.confirm(
        "The settings save may already have committed. Leave this view and inspect saved values before making another change?",
      );
    return (
      (!changedSettings(this.draft, this.initial).length &&
        !this.collectionsDirty) ||
      window.confirm("Discard your unsaved settings changes?")
    );
  }
  private busy() {
    this.dispatchEvent(
      new CustomEvent("settings-busy", {
        detail:
          this.saving ||
          this.savingCollections ||
          this.dashboardBusy ||
          this.automationBusy,
        bubbles: true,
        composed: true,
      }),
    );
  }
  private reload() {
    if (!this.confirmNavigation()) return;
    this.cancelFlow();
    this.flow = undefined;
    this.draft = this.initial = {};
    this.uncertain = false;
    void this.start();
  }
  private async save(event: Event) {
    event.preventDefault();
    if (
      !this.client ||
      !this.scope ||
      !this.flow?.flow_id ||
      this.saving ||
      this.savingCollections ||
      this.collectionsDirty ||
      this.uncertain ||
      this.dashboardBusy ||
      this.automationBusy ||
      !this.dirtyKeys.length
    )
      return;
    const generation = this.generation;
    if (
      !(await this.validateForm(event.target as HTMLFormElement)) ||
      this.saving ||
      generation !== this.generation ||
      !this.scope?.permissions.edit
    )
      return;
    this.saving = true;
    this.busy();
    this.error = "";
    this.requestUpdate();
    const data = { ...this.draft };
    for (const { key, type } of JOURNAL_FIELDS) {
      if (type === "number") data[key] = Number(data[key]);
      else if (!data[key]) delete data[key];
    }
    for (const { key, type } of LIBRARY_FIELDS) {
      if (type === "number") data[key] = Number(data[key]);
    }
    data.library_host = String(data.library_host ?? "");
    if (data.metadata_requests_per_second !== undefined)
      data.metadata_requests_per_second = Number(
        data.metadata_requests_per_second,
      );
    if (data.calendar_full_sync_months !== undefined)
      data.calendar_full_sync_months = Number(data.calendar_full_sync_months);
    if (!data.calendar_entity) delete data.calendar_entity;
    try {
      const result = await this.client.settings(this.scope, "submit", {
        flow_id: this.flow.flow_id,
        data,
      });
      if (generation !== this.generation) return;
      this.flow = result;
      if (result.type === "create_entry") {
        this.initial = { ...this.draft };
        this.saving = false;
        this.busy();
        this.dispatchEvent(
          new CustomEvent("settings-saved", { bubbles: true, composed: true }),
        );
      } else if (result.type === "form") {
        const code = Object.values(result.errors ?? {})[0] ?? "";
        const section: SettingsSection | undefined = code.includes("calendar")
          ? "calendar"
          : code.includes("metadata")
            ? "metadata"
            : code.includes("library")
              ? "library"
              : code.includes("control")
                ? "playback"
                : code.includes("display")
                  ? "general"
                  : [
                        "missing_entities",
                        "invalid_entities",
                        "duplicate_entities",
                        "invalid_rules",
                      ].includes(code)
                    ? "journal"
                    : undefined;
        if (section) void this.selectTab(section);
        this.error = Object.values(result.errors ?? {})
          .map(
            (code) => validation[code] ?? "Check the settings and try again.",
          )
          .join(" ");
      } else
        this.error = "The settings flow ended. Reload settings to continue.";
    } catch (error) {
      if (generation === this.generation) {
        this.fail(error);
        this.uncertain = ![
          "unauthorized",
          "invalid_request",
          "conflict",
        ].includes(errorCode(error));
      }
    } finally {
      if (generation === this.generation) {
        this.saving = false;
        this.busy();
        this.requestUpdate();
      }
    }
  }
  private selectTab(tab: string) {
    if (!SETTINGS_SECTIONS.some(([key]) => key === tab)) return;
    this.tab = tab as SettingsSection;
    this.requestUpdate();
  }
  private tabKey(event: KeyboardEvent, current: string) {
    const keys: string[] = SETTINGS_SECTIONS.map(([key]) => key);
    const index = keys.indexOf(current);
    const next =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? keys[(index + 1) % keys.length]
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? keys[(index + keys.length - 1) % keys.length]
          : event.key === "Home"
            ? keys[0]
            : event.key === "End"
              ? keys.at(-1)
              : undefined;
    if (!next) return;
    event.preventDefault();
    void this.selectTab(next);
    this.renderRoot
      .querySelector<HTMLButtonElement>(`#settings-tab-${next}`)
      ?.focus();
  }
  private submitForm() {
    this.renderRoot
      .querySelector<HTMLFormElement>("#companion-settings-form")
      ?.requestSubmit();
  }
  private async validateForm(form: HTMLFormElement): Promise<boolean> {
    const metadata = form.querySelector(
      "kaleidescape-enrichment-settings",
    )?.shadowRoot;
    const invalid = [
      ...(metadata?.querySelectorAll<HTMLInputElement | HTMLSelectElement>(
        "input, select",
      ) ?? []),
      ...form.querySelectorAll<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >("input, select, textarea"),
    ].find((field) => field.willValidate && !field.validity.valid);
    this.search = "";
    this.requestUpdate();
    const owner =
      invalid?.getRootNode() === metadata
        ? form.querySelector("kaleidescape-enrichment-settings")
        : invalid;
    const tab = owner?.closest<HTMLElement>("[data-settings-tab]")?.dataset
      .settingsTab;
    if (tab && tab !== this.tab) {
      await this.selectTab(tab);
    }
    await this.updateComplete;
    if (invalid) {
      for (
        let parent = invalid.parentElement;
        parent;
        parent = parent.parentElement
      ) {
        if (parent instanceof HTMLDetailsElement) parent.open = true;
      }
      invalid.focus();
      invalid.reportValidity();
      return false;
    }
    return form.reportValidity();
  }
  private get dirtyKeys() {
    return changedSettings(this.draft, this.initial);
  }
  private get blocked() {
    return this.saving || this.uncertain;
  }
  private change(key: string, value: string | number | boolean) {
    if (this.blocked) return;
    this.draft = { ...this.draft, [key]: value };
    this.requestUpdate();
  }
  private heading(
    title: string,
    description: string,
    scope = "Shared · Save settings",
  ) {
    return html`<div class="section-heading">
      <div>
        <h3>${title}</h3>
        <p>${description}</p>
      </div>
      <span
        class=${scope.includes("immediately") ? "scope-tag immediate" : "scope-tag"}
        >${scope}</span
      >
    </div>`;
  }
  private toggle(key: string) {
    const item = TOGGLES.find(([name]) => name === key)!;
    return html`<div class="switch-row">
      ${settingLabel(key, item[1], item[2])}<input
        type="checkbox"
        role="switch"
        name=${key}
        id=${key}
        aria-describedby=${`${key}-hint`}
        .checked=${!!this.draft[key]}
        @change=${(event: Event) => this.change(key, (event.target as HTMLInputElement).checked)}
      />
    </div>`;
  }
  private field(
    field: SettingField,
    choices?: { value: string; label: string }[],
  ) {
    const { key, label, hint, type, min, max, unit, placeholder } = field;
    return html`<div
      class=${type === "text" ? "setting-field full" : "setting-field"}
    >
      ${settingLabel(key, label, hint)}<span class="field-input"
        ><input
          name=${key}
          id=${key}
          type=${type ?? "text"}
          min=${min ?? nothing}
          max=${max ?? nothing}
          step=${type === "number" ? "1" : nothing}
          maxlength=${type === "text" ? "255" : nothing}
          placeholder=${placeholder ?? nothing}
          list=${choices ? `${key}-choices` : nothing}
          aria-describedby=${`${key}-hint`}
          ?required=${type === "number" || (!!choices && !!this.draft.tracking_enabled)}
          .value=${String(this.draft[key] ?? "")}
          @input=${(event: Event) => this.change(key, (event.target as HTMLInputElement).value)}
        />
        ${unit ? html`<span class="unit">${unit}</span>` : nothing}</span
      >
      ${choices ? html`<datalist id=${`${key}-choices`}>${choices.map((choice) => html`<option value=${choice.value}>${choice.label}</option>`)}</datalist>` : nothing}
    </div>`;
  }
  private shortcut(section: SettingsSection, label: string) {
    return html`<button
      type="button"
      class="link"
      @click=${() => this.selectTab(section)}
    >
      ${label} →
    </button>`;
  }
  private async findSetting(field: SettingField) {
    this.search = "";
    await this.selectTab(field.section);
    await this.updateComplete;
    let target = this.renderRoot.querySelector<HTMLElement>(
      `[name="${field.key}"]`,
    );
    if (!target)
      target =
        this.renderRoot
          .querySelector("kaleidescape-enrichment-settings")
          ?.shadowRoot?.querySelector<HTMLElement>(`[name="${field.key}"]`) ??
        null;
    if (!target)
      target = this.renderRoot.querySelector<HTMLElement>(
        `#settings-${field.section} h2`,
      );
    let ancestor: HTMLElement | null = target;
    while (ancestor) {
      if (ancestor instanceof HTMLDetailsElement) ancestor.open = true;
      ancestor = ancestor.parentElement;
    }
    target?.focus();
    target?.scrollIntoView?.({ block: "nearest" });
  }
  private renderGeneral() {
    return html` <div class="settings-card">
        ${this.heading("Start where you want", "Choose the first page for everyone who opens Companion without a page in the URL.")}
        <div class="setting-field">
          ${settingLabel("default_landing_page", "Default landing page", "The shared starting page when a link does not specify one. Unavailable or administrator-only pages fall back to an accessible page for each user.")}<select
            name="default_landing_page"
            id="default_landing_page"
            aria-describedby="default_landing_page-hint"
            .value=${String(this.draft.default_landing_page ?? "journal")}
            @input=${(event: Event) => this.change("default_landing_page", (event.target as HTMLSelectElement).value)}
            @change=${(event: Event) => this.change("default_landing_page", (event.target as HTMLSelectElement).value)}
          >
            ${[
              ["now-playing", "Now Playing"],
              ["library", "Library"],
              ["journal", "Journal"],
              ["database", "Database"],
              ["settings", "Settings"],
            ].map(
              ([value, label]) =>
                html`<option
                  value=${value}
                  ?selected=${value === this.draft.default_landing_page}
                >
                  ${label}
                </option>`,
            )}
          </select>
        </div>
      </div>
      <div class="settings-card">
        ${this.heading("Search & display", "Choose how searches work for everyone.")}
        <div class="switch-row">
          ${settingLabel("fuzzy_search", "Fuzzy search across all views", "Allow close spelling matches when searching. Turn off for case-insensitive partial matching. This setting applies to everyone and is saved with the other shared settings.")}<input
            type="checkbox"
            role="switch"
            name="fuzzy_search"
            id="fuzzy_search"
            aria-describedby="fuzzy_search-hint"
            .checked=${this.draft.fuzzy_search !== false}
            @change=${(event: Event) => this.change("fuzzy_search", (event.target as HTMLInputElement).checked)}
          />
        </div>
        <details class="setting-help">
          <summary>Where do I change layouts and badges?</summary>
          <p>
            Open <strong>Options</strong> in Library, Journal or Database for
            view layouts, page sizes, badges and display choices. They save for
            your account and screen-size profile as you browse. Library sort is
            personal; search and filters stay in the current URL.
          </p>
        </details>
      </div>
      <div class="settings-card setup-guide">
        ${this.heading("Set up your household", "Start with the features you need. Each optional feature can be enabled independently.", "Quick guide")}
        <ol>
          <li>
            ${this.shortcut("journal", "Connect Journal sources")}<small
              >Choose the built-in integration's player and sensors.</small
            >
          </li>
          <li>
            ${this.shortcut("library", "Connect your Library")}<small
              >Bring in movies, collections and artwork.</small
            >
          </li>
          <li>
            ${this.shortcut("automations", "Choose optional automations")}<small
              >Schedule syncs or import purchase receipts.</small
            >
          </li>
        </ol>
      </div>`;
  }
  private renderJournal() {
    return html`<div class="settings-card">
        ${this.heading("Automatic recording", "Observe one player and keep the Journal up to date.")}${this.toggle("tracking_enabled")}
        <div class="settings-grid spaced">
          ${JOURNAL_FIELDS.filter((field) => field.type === "text").map((field) => this.field(field, this.flow?.entity_choices?.[field.key === "media_player" ? "media_player" : "sensor"] ?? []))}
        </div>
        <details class="setting-help">
          <summary>How do I choose the right entities?</summary>
          <p>
            Select the player and the two sensors exposed by Home Assistant's
            built-in Kaleidescape integration. Play status identifies playback
            and credits; media location distinguishes main content. Use a
            different sensor for each role. Suggestions show currently loaded
            entities; you can also enter an existing registered entity ID
            manually.
          </p>
          <a href="/config/entities">Open Home Assistant entities</a>
        </details>
      </div>
      <div class="settings-card">
        ${this.heading("Viewing rules", "Fine-tune when a movie is recorded, completed or resumed.")}
        <div class="settings-grid">
          ${JOURNAL_FIELDS.filter((field) => field.type === "number").map((field) => this.field(field))}
        </div>
      </div>`;
  }
  private renderLibrary() {
    return html`<div class="settings-card">
        ${this.heading("Local Library connection", "Read the movie catalog from your Kaleidescape system.")}${this.toggle("library_enabled")}
        ${
          this.draft.library_enabled
            ? html`<div class="settings-grid spaced">
                  ${this.field(LIBRARY_FIELDS[0])}
                </div>
                <p class="settings-note">
                  A scan runs after setup. For recurring scans, configure the
                  Library sync automation after saving.
                </p>
                ${this.shortcut("automations", "Set up a Library schedule")}`
            : nothing
        }
      </div>
      ${
        this.draft.library_enabled
          ? html`<div class="settings-card">
                ${this.heading("What to sync", "Choose the information to read from your system.")}${this.toggle("library_sync_collections")}${this.toggle("library_sync_details")}${this.toggle("library_sync_artwork")}
                <details class="setting-help">
                  <summary>What comes from the device?</summary>
                  <p>
                    Collections determine watched and in-progress status. Detail
                    fields depend on available source metadata. “Added on” means
                    first detected by Companion. Internet providers can fill in
                    additional information separately.
                  </p>
                  ${this.shortcut("metadata", "Choose metadata providers")}
                </details>
              </div>
              <div class="settings-card">
                ${this.heading("Artwork & purchase display", "Control local storage and the Recently Added purchase badge.")}
                <div class="settings-grid">
                  ${LIBRARY_FIELDS.slice(1).map((field) => this.field(field))}
                </div>
                ${this.draft.library_sync_artwork ? html`<p class="settings-note">Artwork uses additional disk space: up to ${String(this.draft.library_artwork_cache_mb)} MiB plus one incoming image (up to 5 MiB). The journal database retains its 256 MiB limit. HA backups can include these cached files.</p>` : nothing}
              </div>
              <div class="settings-card">
                ${this.heading("Collection actions", "Control whether administrators can queue explicit changes on the device.")}${this.toggle("library_allow_collection_add")}
              </div>`
          : nothing
      }
      <div class="settings-card">
        ${this.heading("Collection visibility", "Hide collection names in shared Library labels and filters. Movies and status remain visible.", "Shared · save visibility")}${this.renderCollections()}
      </div>`;
  }
  private renderPlayback() {
    return html`<div class="settings-card">
        ${this.heading("Playback connection", "The control target is separate from the player observed by the Journal.")}${this.toggle("control_enabled")}
        <div class="settings-grid spaced">
          ${this.field({ key: "control_host", label: "Kaleidescape Player Address", type: "text", section: "playback", hint: "Leave blank to use the Kaleidescape Server Address. Use a private LAN hostname or IP address.", placeholder: "Use Kaleidescape Server Address" })}
        </div>
        <details class="setting-help">
          <summary>What happens when controls are enabled?</summary>
          <p>
            Active Home Assistant users can send player commands from Companion.
            Commands run when clicked. Controls use the local device interface
            on TCP port 10000. Discovery reads the configured system without
            waking players.
          </p>
        </details>
      </div>
      <div class="settings-card">
        ${this.heading("Default player", "Save the connection, discover your system, then select a player and save again.")}
        <ol class="setup-steps">
          <li>Enable controls and save the connection.</li>
          <li>Discover devices and choose a movie player below.</li>
          <li>Save your player selection.</li>
        </ol>
        <kaleidescape-device-controls
          mode="settings"
          .settingsDisabled=${this.blocked}
          .client=${this.client}
          .scope=${this.scope}
          .value=${String(this.draft.control_player ?? "")}
          .configured=${!this.blocked && this.draft.control_enabled === this.initial.control_enabled && this.draft.control_host === this.initial.control_host && this.draft.library_host === this.initial.library_host}
          @player-selected=${(event: CustomEvent<string>) => this.change("control_player", event.detail)}
        ></kaleidescape-device-controls>
      </div>
      <div class="settings-card">
        ${this.heading("Launch movies from Library", "An additional opt-in for starting a movie from its details.")}${this.toggle("control_allow_launch")}
      </div>`;
  }
  private renderMetadata() {
    return html`<kaleidescape-enrichment-settings
      .client=${this.client}
      .scope=${this.scope}
      .draft=${this.draft}
      .disabled=${this.blocked}
      .actionsDisabled=${this.blocked || this.collectionsDirty || this.dirtyKeys.length > 0}
      .credentialConfigured=${!!this.flow?.credential_configured}
      @metadata-settings=${(event: CustomEvent<SettingsDraft>) => {
        this.draft = { ...this.draft, ...event.detail };
        this.requestUpdate();
      }}
    ></kaleidescape-enrichment-settings>`;
  }
  private async insertCalendarField(key: string, token: string) {
    const input = this.renderRoot.querySelector<
      HTMLInputElement | HTMLTextAreaElement
    >(`[name="${key}"]`);
    const value = String(this.draft[key] ?? "");
    const start = input?.selectionStart ?? value.length,
      end = input?.selectionEnd ?? value.length;
    this.change(key, value.slice(0, start) + `{${token}}` + value.slice(end));
    await this.updateComplete;
    input?.focus();
    input?.setSelectionRange(
      start + token.length + 2,
      start + token.length + 2,
    );
  }
  private templateHelp(key: string) {
    return html`<details class="setting-help">
      <summary>Insert a movie or viewing field</summary>
      <p>
        Select a field to insert at the cursor. Missing values are blank;
        duration and watched time use minutes. Double braces produce literal
        braces.
      </p>
      <div class="template-tokens">
        ${["title", "year", "collection", "cast", "director", "writer", "studio", "genre", "duration", "rating", "format", "edition", "synopsis", "purchase_date", "added_on", "status", "started_at", "ended_at", "watched"].map((token) => html`<button type="button" aria-label=${`Insert ${token} in ${key === "calendar_title" ? "event title" : "event description"}`} @click=${() => this.insertCalendarField(key, token)}>{${token}}</button>`)}
      </div>
    </details>`;
  }
  private renderCalendar() {
    return html`<div class="settings-card">
        ${this.heading("Calendar publishing", "Add completed viewings to a Home Assistant calendar.")}${this.toggle("calendar_enabled")}
        <p class="settings-note">
          Movie information is shared with the calendar provider and anyone who
          can read that calendar.
        </p>
        ${
          this.draft.calendar_enabled
            ? html`<div class="setting-field">
                  ${settingLabel("calendar_entity", "Calendar destination", "Choose a Home Assistant calendar that supports creating events. Full Sync also requires deletion support and a dedicated calendar. Changing this destination resets the dedicated-calendar acknowledgement.")}<input
                    name="calendar_entity"
                    id="calendar_entity"
                    aria-describedby="calendar_entity-hint"
                    list="calendar-choices"
                    placeholder="calendar.movies"
                    maxlength="255"
                    required
                    .value=${String(this.draft.calendar_entity ?? "")}
                    @input=${(event: Event) => {
                      this.draft = {
                        ...this.draft,
                        calendar_entity: (event.target as HTMLInputElement)
                          .value,
                        calendar_full_sync_dedicated: false,
                      };
                      this.requestUpdate();
                    }}
                  />
                </div>
                <datalist id="calendar-choices">
                  ${(this.flow?.calendar_choices ?? []).map((choice) => html`<option value=${choice.value}>${choice.label}</option>`)}
                </datalist>`
            : nothing
        }
      </div>
      ${
        this.draft.calendar_enabled
          ? html`<div class="settings-card">
                ${this.heading("Event format", "Use movie and viewing fields to make calendar entries useful.")}
                <div class="setting-field">
                  ${settingLabel("calendar_title", "Event title", "Format each calendar event with placeholders such as {title} and {year}. Use the insertion buttons below; unknown values are blank. Changing the title format can cause a later export to create additional events.")}<input
                    name="calendar_title"
                    id="calendar_title"
                    aria-describedby="calendar_title-hint"
                    maxlength="500"
                    required
                    .value=${String(this.draft.calendar_title ?? "Watched: {title}")}
                    @input=${(event: Event) => this.change("calendar_title", (event.target as HTMLInputElement).value)}
                  />
                </div>
                ${this.templateHelp("calendar_title")}
                <div class="setting-field spaced">
                  ${settingLabel("calendar_description", "Event description", "Use plain text and supported movie/viewing placeholders. Duration and watched time are in minutes; double braces create literal braces. Standard export leaves existing descriptions unchanged; Full Sync can reconcile them.")}<textarea
                    name="calendar_description"
                    id="calendar_description"
                    aria-describedby="calendar_description-hint"
                    rows="6"
                    maxlength="5000"
                    .value=${String(this.draft.calendar_description ?? "")}
                    @input=${(event: Event) => this.change("calendar_description", (event.target as HTMLTextAreaElement).value)}
                  ></textarea>
                </div>
                ${this.templateHelp("calendar_description")}
              </div>
              <div class="settings-card">
                ${this.heading("Dedicated calendar maintenance", "Optional Full Sync reconciles a separate calendar against completed Journal entries.")}${fullSyncSettings(
                  this.draft,
                  (patch) => {
                    this.draft = { ...this.draft, ...patch };
                    this.requestUpdate();
                  },
                )}${this.shortcut("automations", "Configure the Full Sync schedule")}
              </div>`
          : nothing
      }
      <div class="settings-card">
        ${this.heading("Existing viewing history", "Export previous completions or inspect calendar jobs using saved settings.", "Runs when requested")}<kaleidescape-calendar-export
          .client=${this.client}
          .scope=${this.scope}
          .disabled=${this.blocked || this.collectionsDirty || this.dirtyKeys.length > 0}
        ></kaleidescape-calendar-export>
      </div>`;
  }
  private renderMaintenance() {
    return html`<div class="settings-card">
        ${this.heading("Database cleanup", "Review and remove old, finalized maintenance receipts.")}
        <kaleidescape-database-cleanup
          .client=${this.client}
          .scope=${this.scope}
          .disabled=${this.blocked || this.collectionsDirty || this.dirtyKeys.length > 0}
        ></kaleidescape-database-cleanup>
      </div>
      <div class="settings-card">
        ${this.heading("Settings transfer", "Export selected categories or review a settings file before importing it.", "Review before applying")}
        <p class="muted">
          Credentials are excluded. Imported integration settings are staged for
          Save settings; personal and shared display preferences apply when you
          confirm the import.
        </p>
        <kaleidescape-settings-transfer
          .client=${this.client}
          .scope=${this.scope}
          .disabled=${this.blocked || this.loading || this.collectionsDirty || this.savingCollections}
          @settings-imported=${(event: CustomEvent<SettingsDraft>) => {
            this.draft = { ...this.draft, ...event.detail };
            this.requestUpdate();
          }}
        ></kaleidescape-settings-transfer>
      </div>
      <div class="settings-card">
        ${this.heading("Metadata repair", "Review local cached metadata before applying a repair.", "Runs when requested")}
        ${
          this.initial.library_enabled
            ? html`<kaleidescape-metadata-repair
                .client=${this.client}
                .scope=${this.scope}
                .disabled=${this.blocked || this.collectionsDirty || this.dirtyKeys.length > 0}
              ></kaleidescape-metadata-repair>`
            : html`<p>Enable and save Library sync to use metadata repair.</p>
                ${this.shortcut("library", "Open Library settings")}`
        }
      </div>
      <div class="settings-card">
        ${this.heading("Test dashboard", "Create a Home Assistant dashboard to try Companion's cards.", "Runs when requested")}
        <kaleidescape-test-dashboard
          .client=${this.client}
          .scope=${this.scope}
          .disabled=${this.blocked || this.collectionsDirty || this.dirtyKeys.length > 0}
          @dashboard-busy=${(event: CustomEvent<boolean>) => {
            if (this.dashboardBusy !== event.detail) {
              this.dashboardBusy = event.detail;
              this.busy();
              this.requestUpdate();
            }
          }}
          @access-denied=${() => this.fail(new ApiError("unauthorized"))}
        ></kaleidescape-test-dashboard>
      </div>
      <div class="settings-card">
        ${this.heading("Reload saved settings", "Discard the current configuration draft and fetch the saved values.", "Keeps saved preferences")}<button
          type="button"
          ?disabled=${this.saving || this.loading || this.dashboardBusy}
          @click=${this.reload}
        >
          Reload settings
        </button>
      </div>`;
  }
  private async loadPurchaseTotals() {
    if (
      !this.client ||
      !this.scope?.library_enabled ||
      !this.scope.permissions.edit ||
      this.purchaseLoading
    )
      return;
    const generation = this.generation;
    this.purchaseLoading = true;
    this.purchaseError = "";
    this.requestUpdate();
    try {
      const result = await this.client.libraryPurchaseTotals(this.scope);
      if (generation === this.generation) this.purchaseTotals = result;
    } catch (error) {
      if (generation === this.generation) {
        this.purchaseError = errorMessage(error);
        if (errorCode(error) === "unauthorized") this.fail(error);
      }
    } finally {
      if (generation === this.generation) {
        this.purchaseLoading = false;
        this.requestUpdate();
      }
    }
  }
  private purchaseAmount(field: "library_cost" | "retail_price" | "savings") {
    if (!this.purchaseTotals)
      return this.purchaseError ? "Unavailable" : "Loading…";
    if (!this.purchaseTotals.purchase_count) return "No recorded purchases";
    return (
      this.purchaseTotals.currencies
        .map((row) => row[field])
        .filter((value) => value !== null)
        .join(" · ") || "Not available"
    );
  }
  private date(value: string | null | undefined) {
    return value
      ? new Date(value).toLocaleString(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
        })
      : "Not yet synced";
  }
  private renderPurchaseDetails() {
    const totals = this.purchaseTotals;
    return html`<details
      class="purchase-details"
      @toggle=${(event: Event) => {
        if ((event.target as HTMLDetailsElement).open)
          void this.loadPurchaseTotals();
      }}
    >
      <summary>Purchase details</summary>
      <p class="muted">
        Recorded purchases for this Library source include older orders and
        unavailable titles. Unlinked purchases are excluded until matched.
        Filters do not change these totals. Currencies are kept separate.
      </p>
      ${this.purchaseLoading ? html`<p role="status">Loading purchase totals…</p>` : nothing}
      ${this.purchaseError ? html`<p class="error" role="alert">${this.purchaseError} <button @click=${() => this.loadPurchaseTotals()}>Retry purchase totals</button></p>` : nothing}
      ${
        totals
          ? html`<dl class="purchase-summary">
                <dt>Total library cost</dt>
                <dd>${this.purchaseAmount("library_cost")}</dd>
                <dt>Total retail price</dt>
                <dd>${this.purchaseAmount("retail_price")}</dd>
                <dt>Savings</dt>
                <dd>${this.purchaseAmount("savings")}</dd>
                <dt>Unique transactions</dt>
                <dd>${totals.unique_transactions}</dd>
              </dl>
              <p class="muted">
                ${counted(totals.purchase_count, "purchase record")}. Missing
                prices are excluded. Savings use records with both prices in the
                same currency.
              </p>
              ${totals.missing_purchase_prices || totals.missing_retail_prices ? html`<p class="muted">${counted(totals.missing_purchase_prices, "missing paid price")} · ${counted(totals.missing_retail_prices, "missing retail price")}.</p>` : nothing}
              ${totals.unpaired_prices ? html`<p class="muted">${counted(totals.unpaired_prices, "purchase record")} excluded from savings because prices are missing or use different currencies.</p>` : nothing}
              ${totals.missing_order_ids ? html`<p class="muted">${counted(totals.missing_order_ids, "purchase record")} without an order ID; not included in the transaction count.</p>` : nothing}
              ${totals.duplicate_purchases ? html`<p class="muted">${counted(totals.duplicate_purchases, "duplicate purchase record")} counted only once.</p>` : nothing}`
          : nothing
      }
    </details>`;
  }
  private renderAbout() {
    return html`<div class="settings-card">
        ${this.heading("Installed versions", "Version information for troubleshooting this installation.", "Read only")}
        <dl class="version-grid">
          ${[
            ["Companion version", this.scope?.integration_version],
            ["pykaleidescape version", this.scope?.pyk_version],
            ["Companion API version", this.scope?.api_version],
            ["Database schema version", this.scope?.schema_version],
          ].map(
            ([label, value]) =>
              html`<div>
                <dt>${label}</dt>
                <dd>${value ?? "Unknown"}</dd>
              </div>`,
          )}
        </dl>
      </div>
      ${
        this.scope?.library_enabled
          ? html`<div class="settings-card">
                ${this.heading("Library details", "Information from the last Library scan.", "Read only")}
                ${
                  this.libraryInfo
                    ? html`<p>
                          ${counted(this.libraryInfo.group_count, "movie")} ·
                          ${counted(this.libraryInfo.title_count, "individual version")}
                          ·
                          ${counted(this.libraryInfo.collection_count, "collection")}.
                        </p>
                        <p>
                          Catalog synced:
                          ${this.date(this.libraryInfo.last_synced_at)}<br />Collections
                          synced:
                          ${this.date(this.libraryInfo.collections_synced_at)}
                        </p>
                        <p>
                          Source “New”, “Played” and “Paused” map to Unwatched,
                          Watched and In progress.
                        </p>`
                    : html`<p>Library details are unavailable.</p>`
                }
              </div>
              <div class="settings-card">
                ${this.heading("Purchase details", "Recorded purchases for this Library source.", "Read only")}
                ${this.renderPurchaseDetails()}
              </div>`
          : nothing
      }
      <div class="settings-card">
        ${this.heading("Documentation & updates", "Find current guidance and the history of changes.", "Reference")}
        <div class="reference-links">
          <a
            href="https://github.com/raven42/ha-kaleidescape-companion/blob/main/docs/README.md"
            target="_blank"
            rel="noopener noreferrer"
            >Documentation ↗</a
          ><a
            href="https://github.com/raven42/ha-kaleidescape-companion/blob/main/CHANGELOG.md"
            target="_blank"
            rel="noopener noreferrer"
            >Release notes ↗</a
          ><a
            href="https://github.com/raven42/ha-kaleidescape-companion/issues"
            target="_blank"
            rel="noopener noreferrer"
            >Report an issue ↗</a
          >
        </div>
        <p class="muted">
          Blueprint versions, change logs and update actions are together in
          Automations. “Bundled” means included with this Companion
          installation.
        </p>
        ${this.shortcut("automations", "Manage automation blueprints")}
      </div>`;
  }
  private sectionContent(section: SettingsSection) {
    switch (section) {
      case "general":
        return this.renderGeneral();
      case "journal":
        return this.renderJournal();
      case "library":
        return this.renderLibrary();
      case "playback":
        return this.renderPlayback();
      case "metadata":
        return this.renderMetadata();
      case "calendar":
        return this.renderCalendar();
      case "automations":
        return html`<kaleidescape-automation-blueprints
          .client=${this.client}
          .scope=${this.scope}
          .disabled=${this.blocked}
          @blueprint-busy=${(event: CustomEvent<boolean>) => {
            this.automationBusy = event.detail;
            this.busy();
            this.requestUpdate();
          }}
        ></kaleidescape-automation-blueprints>`;
      case "maintenance":
        return this.renderMaintenance();
      case "about":
        return this.renderAbout();
    }
  }
  protected render() {
    const dirty = this.dirtyKeys;
    const ready = this.flow?.type === "form" && !!this.scope?.permissions.edit;
    const results = searchSettings(this.search);
    return html`<section class="settings-page" aria-labelledby="settings-title">
      <div class="settings-top">
        <div>
          <span class="eyebrow">Your household, your way</span>
          <h2 id="settings-title">Settings</h2>
          <p class="save-status" role="status">
            ${this.loading ? "Loading settings…" : this.saving ? "Saving configuration…" : this.uncertain ? "Save result unconfirmed" : dirty.length ? `${dirty.length} unsaved ${dirty.length === 1 ? "setting" : "settings"} · save to apply` : "No unsaved configuration changes"}
          </p>
        </div>
        <div class="actions">
          <button
            type="button"
            ?disabled=${this.saving || this.savingCollections || this.loading || this.automationBusy || this.dashboardBusy || (!dirty.length && !this.collectionsDirty && !this.uncertain)}
            @click=${this.reload}
          >
            Cancel changes</button
          ><button
            type="button"
            class="primary"
            @click=${this.submitForm}
            ?disabled=${!ready || this.blocked || this.loading || this.dashboardBusy || this.automationBusy || this.savingCollections || this.collectionsDirty || !dirty.length}
          >
            ${this.saving ? "Saving…" : "Save settings"}
          </button>
        </div>
      </div>
      ${this.error ? html`<p class="error" role="alert">${this.error}</p>` : nothing}
      ${this.collectionsDirty ? html`<p class="settings-note" role="status">Save or discard Collection visibility changes before saving other settings.</p>` : nothing}
      ${this.uncertain ? html`<p class="warning">The save result is unconfirmed. Reload settings to inspect the saved values before making another change.</p>` : nothing}
      ${
        ready
          ? html`<div class="settings-layout">
              <aside class="settings-sidebar">
                <label class="setting-field settings-search"
                  >Find a setting<input
                    type="search"
                    placeholder="Search settings…"
                    maxlength="120"
                    .value=${this.search}
                    @input=${(event: Event) => {
                      this.search = (event.target as HTMLInputElement).value;
                      this.requestUpdate();
                    }}
                    @keydown=${(event: KeyboardEvent) => {
                      if (event.key === "Escape") {
                        this.search = "";
                        this.requestUpdate();
                      }
                    }}
                /></label>
                <nav
                  class="settings-tabs"
                  role="tablist"
                  aria-orientation="vertical"
                  aria-label="Settings categories"
                >
                  ${SETTINGS_SECTIONS.map(
                    ([key, label]) =>
                      html`<button
                        type="button"
                        role="tab"
                        id=${`settings-tab-${key}`}
                        aria-controls=${`settings-${key}`}
                        aria-selected=${this.tab === key}
                        tabindex=${this.tab === key ? 0 : -1}
                        class=${dirty.some((name) => SETTINGS_INDEX.find((field) => field.key === name)?.section === key) ? "has-changes" : ""}
                        @click=${() => {
                          this.search = "";
                          void this.selectTab(key);
                        }}
                        @keydown=${(event: KeyboardEvent) => this.tabKey(event, key)}
                      >
                        ${label}
                      </button>`,
                  )}
                </nav>
                <label class="setting-field mobile-category"
                  >Settings category<select
                    .value=${this.tab}
                    @change=${(event: Event) => {
                      this.search = "";
                      void this.selectTab(
                        (event.target as HTMLSelectElement).value,
                      );
                    }}
                  >
                    ${SETTINGS_SECTIONS.map(([key, label]) => html`<option value=${key} ?selected=${this.tab === key}>${label}</option>`)}
                  </select></label
                >
                <p class="settings-legend">
                  Configuration changes apply together when you save. Sections
                  marked “saves immediately” do not need Save settings.
                </p>
              </aside>
              <div class="settings-content">
                ${
                  this.search.trim()
                    ? html`<section
                        class="settings-card search-results"
                        aria-label="Settings search results"
                      >
                        <h3>Search results</h3>
                        <p role="status">
                          ${results.length}
                          ${results.length === 1 ? "setting" : "settings"} found
                        </p>
                        ${
                          results.length
                            ? html`<ul>
                                ${results.map(
                                  (field) =>
                                    html`<li>
                                      <button
                                        type="button"
                                        @click=${() => this.findSetting(field)}
                                      >
                                        <span
                                          ><strong>${field.label}</strong
                                          ><small>${field.hint}</small></span
                                        ><span class="scope-tag"
                                          >${SETTINGS_SECTIONS.find(([key]) => key === field.section)?.[1]}</span
                                        >
                                      </button>
                                    </li>`,
                                )}
                              </ul>`
                            : html`<p>
                                Try a feature such as recording, artwork,
                                receipts or calendar.
                              </p>`
                        }<button
                          type="button"
                          class="link"
                          @click=${() => {
                            this.search = "";
                            this.requestUpdate();
                          }}
                        >
                          Clear search
                        </button>
                      </section>`
                    : nothing
                }
                <form
                  id="companion-settings-form"
                  novalidate
                  @submit=${this.save}
                  @input=${() => this.requestUpdate()}
                  @change=${() => this.requestUpdate()}
                  ?hidden=${!!this.search.trim()}
                >
                  <fieldset class="settings-fieldset" ?disabled=${this.blocked}>
                    ${SETTINGS_SECTIONS.map(
                      ([key, , title, description]) =>
                        html`<section
                          role="tabpanel"
                          id=${`settings-${key}`}
                          aria-labelledby=${`settings-tab-${key}`}
                          data-settings-tab=${key}
                          ?hidden=${this.tab !== key}
                        >
                          <div class="category-heading">
                            <h2 tabindex="-1">${title}</h2>
                            <p>${description}</p>
                          </div>
                          ${this.sectionContent(key)}
                        </section>`,
                    )}
                  </fieldset>
                </form>
              </div>
            </div>`
          : this.loading
            ? html`<p class="settings-note" role="status">
                Loading your configuration and preferences…
              </p>`
            : nothing
      }
    </section>`;
  }
  private renderCollections() {
    if (!this.sharedReady)
      return html`<p>
        Shared display settings could not be loaded. Reload settings to retry.
      </p>`;
    const selected = this.hiddenCollections;
    const choices = [...new Set([...this.collectionChoices, ...selected])].sort(
      (a, b) => a.localeCompare(b),
    );
    return html`<fieldset class="full" ?disabled=${this.savingCollections}>
      <legend>
        Hidden collection names
        ${settingHint("Hidden collection names", "Selected names are hidden from Library labels, filters, and collection management. Movies remain visible and source collections still determine status. Save visibility to apply changes; this does not modify device collections.")}
      </legend>
      ${this.sharedError ? html`<p class="error" role="alert">${this.sharedError} Save could not be confirmed. Retry Save visibility or reload settings to inspect the saved values.</p>` : nothing}
      <div class="facet-options">
        ${choices.map(
          (name) =>
            html`<label class="check"
              ><input
                name="library_excluded_collections"
                type="checkbox"
                .value=${name}
                .checked=${selected.includes(name)}
                ?disabled=${selected.length >= 200 && !selected.includes(name)}
                @change=${(event: Event) => {
                  this.hiddenCollections = (event.target as HTMLInputElement)
                    .checked
                    ? [...selected, name]
                    : selected.filter((value) => value !== name);
                  this.requestUpdate();
                }}
              />${collectionLabel(name)}</label
            >`,
        )}
      </div>
      <div class="actions field-actions">
        <div class="setting-field">
          ${settingLabel("custom_collection", "Custom collection name", "Hide a collection name that is not in the current list, including one you may sync later. Enter the source collection's name and choose Add hidden name. You can hide up to 200 names.")}<input
            name="custom_collection"
            id="custom_collection"
            aria-describedby="custom_collection-hint"
            maxlength="256"
            .value=${this.customCollection}
            @input=${(event: Event) => {
              this.customCollection = (event.target as HTMLInputElement).value;
            }}
          />
        </div>
        <button
          type="button"
          @click=${() => {
            const name = this.customCollection.trim().replace(/\s+/g, " ");
            if (!name || selected.length >= 200) return;
            if (
              !selected.some(
                (value) =>
                  value.toLocaleLowerCase() === name.toLocaleLowerCase(),
              )
            ) {
              this.hiddenCollections = [...selected, name];
            }
            this.customCollection = "";
            this.requestUpdate();
          }}
        >
          Add hidden name
        </button>
      </div>
      <div class="actions field-actions">
        <button
          type="button"
          ?disabled=${!this.collectionsDirty || this.savingCollections}
          @click=${this.saveCollections}
        >
          ${this.savingCollections ? "Saving…" : "Save visibility"}
        </button>
        <button
          type="button"
          ?disabled=${!this.collectionsDirty || this.savingCollections}
          @click=${() => {
            this.hiddenCollections = [...this.savedHiddenCollections];
            this.sharedError = "";
            this.requestUpdate();
          }}
        >
          Discard changes
        </button>
      </div>
    </fieldset>`;
  }
  private get collectionsDirty() {
    return (
      JSON.stringify([...this.hiddenCollections].sort()) !==
      JSON.stringify([...this.savedHiddenCollections].sort())
    );
  }
  private async saveCollections() {
    if (
      !this.sharedPreferences ||
      !this.collectionsDirty ||
      this.savingCollections
    )
      return;
    const generation = this.generation;
    const values = [...this.hiddenCollections];
    this.savingCollections = true;
    this.busy();
    this.requestUpdate();
    const saved = await this.sharedPreferences.set({
      hidden_collections: values,
    });
    if (generation !== this.generation) return;
    if (saved) this.savedHiddenCollections = values;
    this.savingCollections = false;
    this.busy();
    this.requestUpdate();
  }
}
if (!customElements.get("kaleidescape-settings"))
  customElements.define("kaleidescape-settings", KaleidescapeSettings);
