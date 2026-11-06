import { responsivePreferences } from "./profile-controller";
/** Administrator settings page backed by Companion's native HA options flow. */
import { LitElement, css, html, nothing } from "lit";
import type { PropertyValues } from "lit";
import { ApiError, errorCode, errorMessage } from "../core/api";
import type {
  JournalClient,
  JournalInfo,
  OptionsForm,
  Scope,
} from "../core/api";
import { styles } from "./styles";
import { collectionLabel } from "../library/badges";
import { fullSyncSettings } from "./calendar-settings";
import "./calendar-export";
import "./automation-blueprints";
import "./settings-transfer";
import "./test-dashboard";
import type { TestDashboard } from "./test-dashboard";
import { CalendarExport } from "./calendar-export";
import "./metadata-repair";
import type { MetadataRepair } from "./metadata-repair";
import { PreferenceStore } from "./preference-store";
import "../playback/controls";
import "../enrichment/settings";

const fields = [
  ["media_player", "Kaleidescape media player", "text", "", ""],
  ["play_status", "Exact play-status sensor", "text", "", ""],
  ["media_location", "Media-location sensor", "text", "", ""],
  [
    "minimum_runtime_minutes",
    "Minimum runtime to record · minutes (0 disables)",
    "number",
    "0",
    "1440",
  ],
  [
    "minimum_seconds",
    "Minimum main-content playback before credits completion · seconds",
    "number",
    "1",
    "3600",
  ],
  [
    "resume_hours",
    "Merge partial viewings within · hours (0 disables)",
    "number",
    "0",
    "168",
  ],
];
const libraryFields = [
  [
    "library_host",
    "Library hostname · blank uses my-kaleidescape.local",
    "text",
    "",
    "",
  ],
  [
    "library_recent_purchase_weeks",
    "Recently Added purchase window · weeks (0 disables)",
    "number",
    "0",
    "520",
  ],
  [
    "library_artwork_cache_mb",
    "Artwork cache limit · MiB",
    "number",
    "32",
    "4096",
  ],
];
const libraryChecks = [
  ["library_allow_collection_add", "Allow Add to Collection on the device"],
  ["library_sync_collections", "Sync collections and watched status"],
  ["library_sync_details", "Sync title details and credits"],
  ["library_sync_artwork", "Sync artwork"],
];
const booleanFields = new Set([
  "calendar_enabled",
  "calendar_full_sync",
  "calendar_full_sync_dedicated",
  "tracking_enabled",
  "library_enabled",
  "control_enabled",
  "control_allow_launch",
  "metadata_store_enabled",
  "metadata_tmdb_enabled",
  "metadata_auto_save",
  "metadata_clear_tmdb_key",
  ...libraryChecks.map(([key]) => key),
]);
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
  constructor() {
    super();
    responsivePreferences(this, () => {
      if (
        this.loading ||
        this.saving ||
        this.uncertain ||
        this.personalPreferences?.unsettled
      )
        return false;
      this.personalPreferences?.dispose();
      this.personalPreferences = undefined;
      this.personalReady = false;
      if (this.tab === "personal") void this.selectTab("personal");
      return true;
    });
  }
  static properties = {
    client: { attribute: false },
    scope: { attribute: false },
  };
  static styles = [
    styles,
    css`
      [hidden] {
        display: none !important;
      }
      .settings-tabs {
        flex-basis: 100%;
        display: flex;
        overflow-x: auto;
        border-bottom: 1px solid var(--line);
      }
      .settings-tabs button {
        border: 0;
        border-radius: 0;
        border-bottom: 3px solid transparent;
        background: transparent;
        white-space: nowrap;
      }
      .settings-tabs button[aria-selected="true"] {
        color: var(--accent);
        border-bottom-color: var(--accent);
      }
      .settings-section {
        padding: 8px 0 20px;
      }
      .settings-section > h3:first-child {
        margin-top: 8px;
      }
      .settings-section + .settings-section {
        border-top: 1px solid var(--line);
      }
      .settings-scope {
        font-size: 13px;
        color: var(--muted);
        margin: 0 0 20px;
      }
    `,
  ];
  client?: JournalClient;
  scope?: JournalInfo;
  private tab = "home-assistant";
  private personalPreferences?: PreferenceStore;
  private personalReady = false;
  private personalError = "";
  private generation = 0;
  private flow?: OptionsForm;
  private draft: Record<string, string | number | boolean | string[]> = {};
  private initial: Record<string, string | number | boolean | string[]> = {};
  private collectionChoices: string[] = [];
  private hiddenCollections: string[] = [];
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
    const key = `${this.scope?.entry_id}:${this.scope?.dataset_id}`;
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
    if (this.client && this.scope) void this.start();
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
    this.personalPreferences?.dispose();
    this.personalPreferences = undefined;
    this.personalReady = false;
    this.personalError = "";
    this.sharedPreferences?.dispose();
    this.sharedPreferences = undefined;
    this.hiddenCollections = [];
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
      this.personalPreferences?.dispose();
      this.personalPreferences = undefined;
      this.personalReady = false;
      this.sharedPreferences?.dispose();
      this.sharedPreferences = undefined;
      this.sharedReady = false;
      this.hiddenCollections = [];
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
          booleanFields.has(field.name)
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
      this.sharedReady = true;
      if (scope.library_enabled) {
        const library = await client.libraryInfo(scope);
        if (generation === this.generation)
          this.collectionChoices = library.collection_names ?? [];
      }
    } catch (error) {
      if (generation === this.generation) this.fail(error);
    } finally {
      if (generation === this.generation) {
        this.loading = false;
        if (this.tab === "personal") void this.selectTab("personal");
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
      JSON.stringify(this.draft) === JSON.stringify(this.initial) ||
      window.confirm("Discard your unsaved settings changes?")
    );
  }
  private busy() {
    this.dispatchEvent(
      new CustomEvent("settings-busy", {
        detail: this.saving || this.dashboardBusy,
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
      this.uncertain ||
      this.dashboardBusy
    )
      return;
    if (!(event.target as HTMLFormElement).reportValidity()) return;
    const generation = this.generation;
    this.saving = true;
    this.busy();
    this.error = "";
    this.requestUpdate();
    const data = { ...this.draft };
    for (const [key, , type] of fields) {
      if (type === "number") data[key] = Number(data[key]);
      else if (!data[key]) delete data[key];
    }
    for (const [key, , type] of libraryFields) {
      if (type === "number") data[key] = Number(data[key]);
    }
    data.library_host = String(data.library_host ?? "");
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
  private async selectTab(tab: string) {
    this.tab = tab;
    this.requestUpdate();
    if (
      tab !== "personal" ||
      this.personalPreferences ||
      !this.client ||
      !this.scope
    )
      return;
    const generation = this.generation;
    this.personalPreferences = new PreferenceStore(
      this.client,
      this.scope,
      false,
      (error) => {
        if (generation !== this.generation) return;
        if (error && errorCode(error) === "unauthorized") this.fail(error);
        else {
          this.personalError = error ? errorMessage(error) : "";
          this.requestUpdate();
        }
      },
      "search",
    );
    try {
      await this.personalPreferences.load();
      if (generation !== this.generation) return;
      this.personalReady = true;
    } catch (error) {
      if (generation !== this.generation) return;
      this.personalError = errorMessage(error);
      this.personalPreferences?.dispose();
      this.personalPreferences = undefined;
      if (errorCode(error) === "unauthorized") this.fail(error);
    }
    this.requestUpdate();
  }
  private tabKey(event: KeyboardEvent, current: string) {
    const keys = [
      "home-assistant",
      "companion",
      "personal",
      "ecosystem",
      "scrapers",
      "about",
    ];
    const index = keys.indexOf(current);
    const next =
      event.key === "ArrowRight"
        ? keys[(index + 1) % keys.length]
        : event.key === "ArrowLeft"
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
  private async submitForm() {
    const form = this.renderRoot.querySelector<HTMLFormElement>(
      "#companion-settings-form",
    );
    if (!form) return;
    const invalid = [
      ...form.querySelectorAll<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >("input, select, textarea"),
    ].find((field) => field.willValidate && !field.validity.valid);
    const tab = invalid?.closest<HTMLElement>("[data-settings-tab]")?.dataset
      .settingsTab;
    if (tab && tab !== this.tab) {
      await this.selectTab(tab);
      await this.updateComplete;
    }
    if (invalid) {
      invalid.focus();
      invalid.reportValidity();
      return;
    }
    form.requestSubmit();
  }
  private renderSources() {
    return html`<div class="grid settings-grid">
      ${fields
        .filter(([, , type]) => type === "text")
        .map(
          ([key, label]) =>
            html` <label class="full"
              >${label}<input
                name=${key}
                maxlength="255"
                ?required=${!!this.draft.tracking_enabled}
                .value=${String(this.draft[key] ?? "")}
                @input=${(event: Event) => {
                  this.draft = {
                    ...this.draft,
                    [key]: (event.target as HTMLInputElement).value,
                  };
                }}
            /></label>`,
        )}
    </div>`;
  }
  protected render() {
    return html`<section
      class="card settings-page"
      aria-labelledby="settings-title"
    >
      <div class="settings-actions">
        <h2 id="settings-title">Companion settings</h2>
        <div class="actions">
          <button
            type="button"
            ?disabled=${this.saving || this.loading}
            @click=${this.reload}
          >
            Cancel changes</button
          ><button
            class="primary"
            type="button"
            @click=${this.submitForm}
            ?disabled=${this.saving || this.loading || this.uncertain || this.dashboardBusy || this.flow?.type !== "form"}
          >
            ${this.saving ? "Saving…" : "Save settings"}
          </button>
        </div>
        <nav
          class="settings-tabs"
          role="tablist"
          aria-label="Settings categories"
        >
          ${[
            ["home-assistant", "Home Assistant"],
            ["companion", "Companion"],
            ["personal", "Personal"],
            ["ecosystem", "Kaleidescape"],
            ["scrapers", "Scrapers"],
            ["about", "About"],
          ].map(
            ([key, label]) =>
              html` <button
                type="button"
                role="tab"
                id=${`settings-tab-${key}`}
                aria-controls=${`settings-${key}`}
                aria-selected=${this.tab === key}
                tabindex=${this.tab === key ? 0 : -1}
                @click=${() => this.selectTab(key)}
                @keydown=${(event: KeyboardEvent) => this.tabKey(event, key)}
              >
                ${label}
              </button>`,
          )}
        </nav>
      </div>
      <p>
        Integration configuration is shared and reloads when saved. Companion
        database preferences save immediately. Each section identifies its
        scope.
      </p>
      ${this.error ? html`<p class="error" role="alert">${this.error}</p>` : nothing}
      ${this.uncertain ? html`<p class="warning">The save result is unconfirmed. Reload settings to inspect the saved values before making another change.</p>` : nothing}
      ${
        this.loading
          ? html`<p role="status">Loading settings…</p>`
          : this.flow?.type === "form"
            ? html`<form
                  id="companion-settings-form"
                  @submit=${this.save}
                  @input=${() => this.requestUpdate()}
                  @change=${() => this.requestUpdate()}
                >
                  <fieldset ?disabled=${this.saving || this.uncertain}>
                    <section
                      class="settings-section"
                      role="tabpanel"
                      id="settings-home-assistant"
                      aria-labelledby="settings-tab-home-assistant"
                      data-settings-tab="home-assistant"
                      ?hidden=${this.tab !== "home-assistant"}
                    >
                      <p class="settings-scope">
                        Home Assistant integration · shared · Save settings
                        required
                      </p>
                      <kaleidescape-automation-blueprints
                        .client=${this.client}
                        .scope=${this.scope}
                      ></kaleidescape-automation-blueprints>
                      <kaleidescape-test-dashboard
                        .client=${this.client}
                        .scope=${this.scope}
                        .disabled=${this.saving || this.uncertain || JSON.stringify(this.draft) !== JSON.stringify(this.initial)}
                        @dashboard-busy=${(event: CustomEvent<boolean>) => {
                          if (this.dashboardBusy !== event.detail) {
                            this.dashboardBusy = event.detail;
                            this.busy();
                            this.requestUpdate();
                          }
                        }}
                        @access-denied=${() => this.fail(new ApiError("unauthorized"))}
                      ></kaleidescape-test-dashboard>
                      <h3>Playback source entities</h3>
                      <p class="muted">
                        Choose the HA entities used for automatic journal
                        recording. Recording rules are under Companion.
                      </p>
                      ${this.renderSources()}
                      <h3>Watched movies calendar</h3>
                      <label class="check"
                        ><input
                          type="checkbox"
                          name="calendar_enabled"
                          .checked=${!!this.draft.calendar_enabled}
                          @change=${(event: Event) => {
                            this.draft = {
                              ...this.draft,
                              calendar_enabled: (
                                event.target as HTMLInputElement
                              ).checked,
                            };
                            this.requestUpdate();
                          }}
                        />Add watched movies to calendar</label
                      >
                      <p class="muted">
                        Publishes new movie completions automatically. Use the
                        explicit Journal export below to sync existing completed
                        viewings. Movie metadata is shared with the calendar
                        provider and anyone who can read that calendar.
                      </p>
                      ${
                        this.draft.calendar_enabled
                          ? html`<div class="grid settings-grid">
                                <label class="full"
                                  >HA calendar<input
                                    name="calendar_entity"
                                    list="calendar-choices"
                                    type="text"
                                    placeholder="calendar.movies"
                                    maxlength="255"
                                    required
                                    .value=${String(this.draft.calendar_entity ?? "")}
                                    @input=${(event: Event) => {
                                      this.draft = {
                                        ...this.draft,
                                        calendar_entity: (
                                          event.target as HTMLInputElement
                                        ).value,
                                        calendar_full_sync_dedicated: false,
                                      };
                                    }} /></label
                                ><label class="full"
                                  >Event title<input
                                    name="calendar_title"
                                    type="text"
                                    maxlength="500"
                                    required
                                    .value=${String(this.draft.calendar_title ?? "Watched: {title}")}
                                    @input=${(event: Event) => {
                                      this.draft = {
                                        ...this.draft,
                                        calendar_title: (
                                          event.target as HTMLInputElement
                                        ).value,
                                      };
                                    }} /></label
                                ><label class="full"
                                  >Event description<textarea
                                    name="calendar_description"
                                    maxlength="5000"
                                    .value=${String(this.draft.calendar_description ?? "")}
                                    @input=${(event: Event) => {
                                      this.draft = {
                                        ...this.draft,
                                        calendar_description: (
                                          event.target as HTMLTextAreaElement
                                        ).value,
                                      };
                                    }}
                                  ></textarea>
                                </label>
                              </div>
                              <p class="muted">
                                <datalist id="calendar-choices">
                                  ${(this.flow.calendar_choices ?? []).map((choice) => html`<option value=${choice.value}>${choice.label}</option>`)}
                                </datalist>
                                Allowed fields: {title}, {year}, {collection},
                                {cast}, {director}, {writer}, {studio}, {genre},
                                {duration}, {rating}, {format}, {edition},
                                {synopsis}, {purchase_date}, {added_on},
                                {status}, {started_at}, {ended_at}, {watched}.
                                Duration and watched time are minutes; missing
                                values are blank. Use double braces for literal
                                braces.
                              </p>
                              ${fullSyncSettings(this.draft, (patch) => {
                                this.draft = { ...this.draft, ...patch };
                                this.requestUpdate();
                              })}`
                          : nothing
                      }
                      <kaleidescape-calendar-export
                        .client=${this.client}
                        .scope=${this.scope}
                        .disabled=${this.saving || this.uncertain || JSON.stringify(this.draft) !== JSON.stringify(this.initial)}
                      ></kaleidescape-calendar-export>
                    </section>
                    <section
                      class="settings-section"
                      role="tabpanel"
                      id="settings-companion"
                      aria-labelledby="settings-tab-companion"
                      data-settings-tab="companion"
                      ?hidden=${this.tab !== "companion"}
                    >
                      <p class="settings-scope">
                        Companion runtime behavior · shared · saved with the HA
                        integration
                      </p>
                      <h3>Journal recording</h3>
                      <label class="check"
                        ><input
                          name="tracking_enabled"
                          type="checkbox"
                          .checked=${!!this.draft.tracking_enabled}
                          @change=${(event: Event) => {
                            this.draft = {
                              ...this.draft,
                              tracking_enabled: (
                                event.target as HTMLInputElement
                              ).checked,
                            };
                            this.requestUpdate();
                          }}
                        />Automatically record playback</label
                      >
                      <div class="grid settings-grid">
                        ${fields
                          .filter(([, , type]) => type === "number")
                          .map(
                            ([key, label, type, min, max]) =>
                              html`<label class=${type === "text" ? "full" : ""}
                                >${label}<input
                                  name=${key}
                                  type=${type}
                                  min=${min || nothing}
                                  max=${max || nothing}
                                  step=${type === "number" ? "1" : nothing}
                                  maxlength=${type === "text" ? "255" : nothing}
                                  ?required=${type === "number" || !!this.draft.tracking_enabled}
                                  .value=${String(this.draft[key] ?? "")}
                                  @input=${(event: Event) => {
                                    this.draft = {
                                      ...this.draft,
                                      [key]: (event.target as HTMLInputElement)
                                        .value,
                                    };
                                  }}
                              /></label>`,
                          )}
                      </div>
                      <p class="muted">
                        The runtime cutoff uses total duration; missing runtime
                        waits for metadata. Completion uses watched time and
                        confirmed credits. Select the HA source entities under
                        Home Assistant.
                      </p>
                      <h3>Landing page</h3>
                      <label
                        >Default landing page<select
                          name="default_landing_page"
                          .value=${String(this.draft.default_landing_page ?? "journal")}
                          @change=${(event: Event) => {
                            this.draft = {
                              ...this.draft,
                              default_landing_page: (
                                event.target as HTMLSelectElement
                              ).value,
                            };
                            this.requestUpdate();
                          }}
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
                        </select></label
                      >
                      <p class="muted">
                        The URL remembers your current tab. Library view, page
                        size, filters and sort save automatically for your HA
                        user while browsing.
                      </p>
                    </section>
                    <section
                      class="settings-section"
                      role="tabpanel"
                      id="settings-ecosystem"
                      aria-labelledby="settings-tab-ecosystem"
                      data-settings-tab="ecosystem"
                      ?hidden=${this.tab !== "ecosystem"}
                    >
                      <p class="settings-scope">
                        Kaleidescape devices and metadata providers · shared ·
                        Save settings required
                      </p>
                      <h3>Library sync</h3>
                      <label class="check"
                        ><input
                          name="library_enabled"
                          type="checkbox"
                          .checked=${!!this.draft.library_enabled}
                          @change=${(event: Event) => {
                            this.draft = {
                              ...this.draft,
                              library_enabled: (
                                event.target as HTMLInputElement
                              ).checked,
                            };
                            this.requestUpdate();
                          }}
                        />Enable library sync</label
                      >
                      <p class="muted">
                        Optional synchronization with your local Kaleidescape
                        library. Disabled by default; no library discovery or
                        device requests occur while disabled.
                      </p>
                      ${
                        this.draft.library_enabled
                          ? html`<div class="grid settings-grid">
                                ${libraryFields.map(
                                  ([key, label, type, min, max]) =>
                                    html`<label
                                      class=${type === "text" ? "full" : ""}
                                      >${label}<input
                                        name=${key}
                                        type=${type}
                                        min=${min || nothing}
                                        max=${max || nothing}
                                        step=${type === "number" ? "1" : nothing}
                                        maxlength=${type === "text" ? "255" : nothing}
                                        ?required=${type === "number"}
                                        .value=${String(this.draft[key] ?? "")}
                                        @input=${(event: Event) => {
                                          this.draft = {
                                            ...this.draft,
                                            [key]: (
                                              event.target as HTMLInputElement
                                            ).value,
                                          };
                                          this.requestUpdate();
                                        }}
                                    /></label>`,
                                )}
                                ${libraryChecks.map(
                                  ([key, label]) =>
                                    html`<label class="check full"
                                      ><input
                                        name=${key}
                                        type="checkbox"
                                        .checked=${!!this.draft[key]}
                                        @change=${(event: Event) => {
                                          this.draft = {
                                            ...this.draft,
                                            [key]: (
                                              event.target as HTMLInputElement
                                            ).checked,
                                          };
                                          this.requestUpdate();
                                        }}
                                      />${label}</label
                                    >`,
                                )}
                              </div>
                              <p class="muted">
                                Add to Collection is separately disabled by
                                default. Enabling it lets administrators add an
                                explicitly selected version to an existing
                                offered collection. It requires collection sync.
                                Removal is not supported.
                              </p>
                              <p class="muted">
                                Source collections determine watched status,
                                with in-progress. Detail fields depend on
                                available source metadata. “Added on” means
                                first detected, not purchased or downloaded.
                              </p>
                              ${this.draft.library_sync_artwork ? html`<p class="warning">Artwork uses additional disk space in a separate private cache, up to ${String(this.draft.library_artwork_cache_mb)} MiB plus one incoming image (up to 5 MiB). The journal database retains its 256 MiB limit. Increase the cache limit for a large library; older covers may be evicted and fetched again. HA backups can include these files.</p>` : nothing}`
                          : nothing
                      }
                      ${
                        this.initial.library_enabled
                          ? html`<kaleidescape-metadata-repair
                              .client=${this.client}
                              .scope=${this.scope}
                              .disabled=${this.saving || this.uncertain || JSON.stringify(this.draft) !== JSON.stringify(this.initial)}
                            ></kaleidescape-metadata-repair>`
                          : nothing
                      }
                      <h3>Device discovery and controls</h3>
                      <label class="check"
                        ><input
                          name="control_enabled"
                          type="checkbox"
                          .checked=${!!this.draft.control_enabled}
                          @change=${(event: Event) => {
                            this.draft = {
                              ...this.draft,
                              control_enabled: (
                                event.target as HTMLInputElement
                              ).checked,
                            };
                            this.requestUpdate();
                          }}
                        />Enable playback controls</label
                      >
                      <label
                        >Control hostname · blank uses the Library host<input
                          name="control_host"
                          maxlength="255"
                          .value=${String(this.draft.control_host ?? "")}
                          @input=${(event: Event) => {
                            this.draft = {
                              ...this.draft,
                              control_host: (event.target as HTMLInputElement)
                                .value,
                            };
                            this.requestUpdate();
                          }}
                      /></label>
                      <kaleidescape-device-controls
                        mode="settings"
                        .client=${this.client}
                        .scope=${this.scope}
                        .value=${String(this.draft.control_player ?? "")}
                        .configured=${this.draft.control_enabled === this.initial.control_enabled && this.draft.control_host === this.initial.control_host}
                        @player-selected=${(event: CustomEvent<string>) => {
                          this.draft = {
                            ...this.draft,
                            control_player: event.detail,
                          };
                          this.requestUpdate();
                        }}
                      ></kaleidescape-device-controls>
                      <label class="check"
                        ><input
                          name="control_allow_launch"
                          type="checkbox"
                          .checked=${!!this.draft.control_allow_launch}
                          @change=${(event: Event) => {
                            this.draft = {
                              ...this.draft,
                              control_allow_launch: (
                                event.target as HTMLInputElement
                              ).checked,
                            };
                            this.requestUpdate();
                          }}
                        />Allow experimental Library title playback</label
                      >
                      <p class="muted">
                        Enabled controls are available to all active HA users
                        and use TCP 10000. Commands run when clicked without
                        confirmation. Discovery reads the configured system
                        without waking players. Save enablement/host first,
                        discover, select a movie player, then save again. The
                        control target is separate from Journal tracking.
                        Library playback uses the same catalog seed and verifies
                        the selected title before launch; the player chooses its
                        playable format.
                      </p>
                    </section>
                    <section
                      class="settings-section"
                      role="tabpanel"
                      id="settings-scrapers"
                      aria-labelledby="settings-tab-scrapers"
                      data-settings-tab="scrapers"
                      ?hidden=${this.tab !== "scrapers"}
                    >
                      <p class="settings-scope">
                        Metadata providers · shared backend behavior · Save
                        settings required
                      </p>
                      <p class="muted">
                        Optional provider requests are separate from the local
                        Kaleidescape library scan. Each scraper requires
                        administrator opt-in.
                      </p>
                      <kaleidescape-enrichment-settings
                        .client=${this.client}
                        .scope=${this.scope}
                        .draft=${this.draft}
                        .disabled=${this.saving || this.uncertain}
                        @metadata-settings=${(
                          event: CustomEvent<Record<string, unknown>>,
                        ) => {
                          this.draft = {
                            ...this.draft,
                            ...event.detail,
                          } as typeof this.draft;
                          this.requestUpdate();
                        }}
                      ></kaleidescape-enrichment-settings>
                    </section>
                    <section
                      class="settings-section"
                      role="tabpanel"
                      id="settings-about"
                      aria-labelledby="settings-tab-about"
                      data-settings-tab="about"
                      ?hidden=${this.tab !== "about"}
                    >
                      <h3>About Kaleidescape Companion</h3>
                      <p>
                        Companion version:
                        <strong
                          >${this.scope?.integration_version || "Unknown"}</strong
                        ><br />
                        pykaleidescape version:
                        <strong>${this.scope?.pyk_version || "Unknown"}</strong
                        ><br />
                        Companion API version:
                        <strong>${this.scope?.api_version ?? "Unknown"}</strong
                        ><br />
                        Database schema version:
                        <strong
                          >${this.scope?.schema_version ?? "Unknown"}</strong
                        >
                      </p>
                      <kaleidescape-automation-blueprints
                        .client=${this.client}
                        .scope=${this.scope}
                        .versionsOnly=${true}
                      ></kaleidescape-automation-blueprints>
                      <h3>Release notes · current development build</h3>
                      <ul>
                        <li>
                          Missing automation blueprints are installed
                          automatically. Settings shows blueprint status and
                          offers explicit updates; Home Assistant notifies you
                          about outdated and updated blueprints.
                        </li>
                        <li>
                          Library sync and calendar full sync actions support
                          opt-in schedules. Calendar full sync also schedules a
                          safeguard recheck.
                        </li>
                        <li>
                          Metadata refresh schedules can select providers and
                          limit work to titles with missing data.
                        </li>
                        <li>
                          Purchase receipts save unmatched purchases for later
                          reconciliation from the database. Update the receipt
                          blueprint to version 4 to handle quoted forwards.
                        </li>
                      </ul>
                    </section>
                  </fieldset>
                </form>
                <section
                  class="settings-section"
                  ?hidden=${this.tab !== "companion"}
                >
                  <h3>Shared Library display settings</h3>
                  <p class="settings-scope">
                    Companion database · shared · saved immediately without an
                    HA reload
                  </p>
                  ${this.renderCollections()}
                  <h3>Settings transfer and maintenance</h3>
                  <p class="muted">
                    Export or review selected settings categories before import.
                    Reload discards unsaved integration changes.
                  </p>
                  <div class="actions">
                    <button
                      ?disabled=${this.saving || this.loading}
                      @click=${this.reload}
                    >
                      Reload settings
                    </button>
                    <kaleidescape-settings-transfer
                      .client=${this.client}
                      .scope=${this.scope}
                      .disabled=${this.saving || this.loading}
                      @settings-imported=${(
                        event: CustomEvent<
                          Record<string, string | number | boolean | string[]>
                        >,
                      ) => {
                        this.draft = { ...this.draft, ...event.detail };
                        this.requestUpdate();
                      }}
                    ></kaleidescape-settings-transfer>
                  </div>
                </section>
                <section
                  class="settings-section"
                  role="tabpanel"
                  id="settings-personal"
                  aria-labelledby="settings-tab-personal"
                  ?hidden=${this.tab !== "personal"}
                >
                  <p class="settings-scope">
                    Companion database · your HA account only · saved
                    immediately
                  </p>
                  <h3>Search behavior</h3>
                  <label class="check"
                    ><input
                      type="checkbox"
                      name="personal_fuzzy_search"
                      .checked=${this.personalPreferences?.values.fuzzy_search !== false}
                      ?disabled=${!this.personalReady}
                      @change=${(event: Event) => {
                        this.personalPreferences?.set({
                          fuzzy_search: (event.target as HTMLInputElement)
                            .checked,
                        });
                        this.requestUpdate();
                      }}
                    />Fuzzy search across all views</label
                  >
                  ${this.personalError ? html`<p class="error" role="alert">${this.personalError}<button type="button" @click=${() => this.personalPreferences?.retry()}>Retry personal settings</button></p>` : nothing}
                  <h3>View preferences</h3>
                  <p>
                    Library, Journal and Database Options save view layouts,
                    page sizes and display choices for your account as you
                    browse. Library filters and sorting are personal too.
                  </p>
                  <p class="muted">
                    The default landing page under Companion is shared. The URL
                    remembers the current main view.
                  </p>
                </section>`
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
    return html`<fieldset class="full">
      <legend>Hidden collection names</legend>
      ${this.sharedError ? html`<p class="error" role="alert">${this.sharedError}<button type="button" @click=${() => this.sharedPreferences?.retry()}>Retry UI settings</button></p>` : nothing}
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
                  this.sharedPreferences?.set({
                    hidden_collections: this.hiddenCollections,
                  });
                  this.requestUpdate();
                }}
              />${collectionLabel(name)}</label
            >`,
        )}
      </div>
      <div class="actions field-actions">
        <label
          >Custom collection name<input
            name="custom_collection"
            maxlength="256"
            .value=${this.customCollection}
            @input=${(event: Event) => {
              this.customCollection = (event.target as HTMLInputElement).value;
            }} /></label
        ><button
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
              this.sharedPreferences?.set({
                hidden_collections: this.hiddenCollections,
              });
            }
            this.customCollection = "";
            this.requestUpdate();
          }}
        >
          Add hidden name
        </button>
      </div>
      <small
        >Selected names are hidden from labels and filters. Movies remain
        visible; source collections still determine status. No device
        changes.</small
      >
    </fieldset>`;
  }
}
if (!customElements.get("kaleidescape-settings"))
  customElements.define("kaleidescape-settings", KaleidescapeSettings);
