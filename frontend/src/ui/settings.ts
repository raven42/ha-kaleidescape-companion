/** Administrator settings page backed by Companion's native HA options flow. */
import { LitElement, html, nothing } from "lit";
import type { PropertyValues } from "lit";
import { errorCode, errorMessage } from "../core/api";
import type {
  JournalClient,
  JournalInfo,
  OptionsForm,
  Scope,
} from "../core/api";
import { styles } from "./styles";
import { collectionLabel } from "../library/badges";
import "./calendar-export";
import { CalendarExport } from "./calendar-export";
import "./metadata-repair";
import type { MetadataRepair } from "./metadata-repair";
import { PreferenceStore } from "./preference-store";

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
  ["library_interval_hours", "Sync interval · hours", "number", "1", "168"],
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
  "tracking_enabled",
  "library_enabled",
  ...libraryChecks.map(([key]) => key),
]);
const validation: Record<string, string> = {
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
  invalid_library_host:
    "Enter a hostname or private LAN HTTP(S) origin without a path, credentials, or query.",
  invalid_library_options:
    "Choose a sync interval of 1–168 hours and an artwork cache limit of 32–4096 MiB.",
};

export class KaleidescapeSettings extends LitElement {
  static properties = {
    client: { attribute: false },
    scope: { attribute: false },
  };
  static styles = styles;
  client?: JournalClient;
  scope?: JournalInfo;
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
        this.requestUpdate();
      }
    }
  }
  confirmNavigation() {
    const exporting = this.renderRoot.querySelector<CalendarExport>(
      "kaleidescape-calendar-export",
    );
    const repairing = this.renderRoot.querySelector<MetadataRepair>(
      "kaleidescape-metadata-repair",
    );
    if (
      this.saving ||
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
        detail: this.saving,
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
      this.uncertain
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
  protected render() {
    return html`<section
      class="card settings-page"
      aria-labelledby="settings-title"
    >
      <div class="settings-actions">
        <h2 id="settings-title">Companion settings</h2>
        <button ?disabled=${this.saving || this.loading} @click=${this.reload}>
          Reload settings
        </button>
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
            @click=${() => this.renderRoot.querySelector<HTMLFormElement>("#companion-settings-form")?.requestSubmit()}
            ?disabled=${this.saving || this.loading || this.uncertain || this.flow?.type !== "form"}
          >
            ${this.saving ? "Saving…" : "Save settings"}
          </button>
        </div>
      </div>
      <p>
        HA runtime settings use the integration’s Configure options and reload
        when saved. Shared Library display settings save immediately to the
        database.
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
                    <label class="check"
                      ><input
                        name="tracking_enabled"
                        type="checkbox"
                        .checked=${!!this.draft.tracking_enabled}
                        @change=${(event: Event) => {
                          this.draft = {
                            ...this.draft,
                            tracking_enabled: (event.target as HTMLInputElement)
                              .checked,
                          };
                          this.requestUpdate();
                        }}
                      />Automatically record playback</label
                    >
                    <div class="grid settings-grid">
                      ${fields.map(
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
                      Use HA entity IDs for the three sources. The runtime
                      cutoff uses total duration; missing runtime waits for
                      metadata. Completion uses watched time and confirmed
                      credits.
                    </p>
                    <h3>Watched movies calendar</h3>
                    <label class="check"
                      ><input
                        type="checkbox"
                        name="calendar_enabled"
                        .checked=${!!this.draft.calendar_enabled}
                        @change=${(event: Event) => {
                          this.draft = {
                            ...this.draft,
                            calendar_enabled: (event.target as HTMLInputElement)
                              .checked,
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
                              {duration}, {rating}, {format},
                              {edition}, {synopsis}, {purchase_date},
                              {added_on}, {status}, {started_at}, {ended_at},
                              {watched}. Duration and watched time are minutes;
                              missing values are blank. Use double braces for
                              literal braces.
                            </p>`
                        : nothing
                    }
                    <kaleidescape-calendar-export
                      .client=${this.client}
                      .scope=${this.scope}
                      .disabled=${this.saving || this.uncertain || JSON.stringify(this.draft) !== JSON.stringify(this.initial)}
                    ></kaleidescape-calendar-export>
                    <h3>Library sync</h3>
                    <label class="check"
                      ><input
                        name="library_enabled"
                        type="checkbox"
                        .checked=${!!this.draft.library_enabled}
                        @change=${(event: Event) => {
                          this.draft = {
                            ...this.draft,
                            library_enabled: (event.target as HTMLInputElement)
                              .checked,
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
                              explicitly selected version to an existing offered
                              collection. It requires collection sync. Removal
                              is not supported.
                            </p>
                            <p class="muted">
                              Source collections determine watched status, with
                              in-progress. Detail fields depend on available
                              source metadata. “Added on” means first detected,
                              not purchased or downloaded.
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
                      size, filters and sort save automatically for your HA user
                      while browsing.
                    </p>
                  </fieldset>
                </form>
                <h3>Shared Library display settings</h3>
                <p>Saved to the database as you change them; no HA reload.</p>
                ${this.renderCollections()}`
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
