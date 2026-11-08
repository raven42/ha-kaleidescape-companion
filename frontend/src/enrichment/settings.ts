/** Opt-in external metadata settings; provider credentials never enter public APIs. */
import { LitElement, html, nothing } from "lit";
import type { PropertyValues } from "lit";
import { errorMessage } from "../core/api";
import type { JournalClient, JournalInfo, MetadataStatus } from "../core/api";
import { counted } from "../core/text";
import { styles } from "../ui/styles";
import { settingsStyles } from "../ui/settings-styles";
import { settingLabel, settingHint } from "../ui/settings-hint";
import { SOURCE_FIELDS, SOURCE_LABELS } from "./sources";
import { tmdbCredits } from "./credits";

export class EnrichmentSettings extends LitElement {
  static properties = {
    client: { attribute: false },
    scope: { attribute: false },
    draft: { attribute: false },
    disabled: { type: Boolean },
    actionsDisabled: { type: Boolean },
    credentialConfigured: { type: Boolean },
  };
  static styles = [styles, settingsStyles];
  client?: JournalClient;
  scope?: JournalInfo;
  draft: Record<string, unknown> = {};
  disabled = false;
  actionsDisabled = false;
  credentialConfigured = false;
  private generation = 0;
  private bound = "";
  private boundClient?: JournalClient;
  private status?: MetadataStatus;
  private error = "";
  private loading = false;
  private timer?: ReturnType<typeof setTimeout>;
  protected willUpdate(changed: PropertyValues) {
    if (changed.has("client") || changed.has("scope")) {
      const key = `${this.scope?.entry_id}:${this.scope?.dataset_id}:${!!this.scope?.permissions.edit}`;
      if (key === this.bound && this.client === this.boundClient) return;
      this.bound = key;
      this.boundClient = this.client;
      this.loading = false;
      this.generation++;
      clearTimeout(this.timer);
      this.status = undefined;
      this.error = "";
    }
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    this.generation++;
    clearTimeout(this.timer);
  }
  private change(key: string, value: unknown) {
    if (this.disabled) return;
    this.dispatchEvent(
      new CustomEvent("metadata-settings", {
        detail: { [key]: value },
        bubbles: true,
        composed: true,
      }),
    );
  }
  private async refresh(sync = false) {
    if (
      this.loading ||
      !this.scope?.permissions.edit ||
      !this.client ||
      (sync &&
        (this.disabled || this.actionsDisabled || !this.scope.library_enabled))
    )
      return;
    this.loading = true;
    clearTimeout(this.timer);
    this.requestUpdate();
    const generation = this.generation;
    try {
      const status = await this.client.metadataStatus(this.scope, sync);
      if (generation !== this.generation) return;
      this.status = status;
      this.error = "";
      if (status.running)
        this.timer = setTimeout(() => void this.refresh(), 2000);
    } catch (error) {
      if (generation === this.generation) this.error = errorMessage(error);
    } finally {
      if (generation === this.generation) {
        this.loading = false;
        this.requestUpdate();
      }
    }
  }
  private toggle(key: string, label: string, hint: string) {
    return html`<div class="switch-row">
      ${settingLabel(key, label, hint)}<input
        name=${key}
        id=${key}
        aria-describedby=${`${key}-hint`}
        type="checkbox"
        role="switch"
        .checked=${!!this.draft[key]}
        ?disabled=${this.disabled}
        @change=${(event: Event) => this.change(key, (event.target as HTMLInputElement).checked)}
      />
    </div>`;
  }
  protected render() {
    if (!this.scope?.permissions.edit) return nothing;
    return html`<section aria-label="External metadata">
      <p class="settings-note">
        Internet lookups share movie titles and release years with enabled
        providers. Store lookups may use existing purchase links; prices and
        order IDs are not sent. Save settings before refreshing.
      </p>
      <div class="settings-card">
        <div class="section-heading">
          <div>
            <h3>Kaleidescape Store</h3>
            <p>Public movie metadata and Rotten Tomatoes scores.</p>
          </div>
          <span class="scope-tag">Shared · Save settings</span>
        </div>
        ${this.toggle("metadata_store_enabled", "Enable Kaleidescape Store", "Experimental public Store lookups. No account or Store credential is required.")}
      </div>
      <div class="settings-card">
        <div class="section-heading">
          <div>
            <h3>TMDB</h3>
            <p>Additional credits, descriptions, ratings and images.</p>
          </div>
          <span class="scope-tag">Shared · Save settings</span>
        </div>
        ${this.toggle("metadata_tmdb_enabled", "Enable TMDB", "Use your TMDB API credential for optional metadata requests.")}
        <div class="credential-row spaced">
          <div class="setting-field">
            ${settingLabel("metadata_tmdb_credential", "TMDB API key or API Read Access Token", "Use an API key or API Read Access Token from your TMDB account's API settings. Leave blank to keep a saved credential; enter a new value to replace it when you save. Saved secrets are never displayed or included in settings exports.")}<input
              name="metadata_tmdb_credential"
              id="metadata_tmdb_credential"
              aria-describedby="metadata_tmdb_credential-hint"
              type="password"
              autocomplete="new-password"
              maxlength="1024"
              placeholder=${this.credentialConfigured ? "Leave blank to keep your saved credential" : "Enter an API key or read access token"}
              .value=${String(this.draft.metadata_tmdb_credential ?? "")}
              ?disabled=${this.disabled || !!this.draft.metadata_clear_tmdb_key}
              @input=${(event: Event) => this.change("metadata_tmdb_credential", (event.target as HTMLInputElement).value)}
            />
          </div>
          <span class="credential-actions"
            ><button
              type="button"
              name="metadata_clear_tmdb_key"
              id="metadata_clear_tmdb_key"
              class=${this.draft.metadata_clear_tmdb_key ? "" : "danger"}
              aria-describedby="metadata_clear_tmdb_key-hint"
              ?disabled=${this.disabled || (!this.credentialConfigured && !this.draft.metadata_tmdb_credential && !this.draft.metadata_clear_tmdb_key)}
              @click=${() => this.change("metadata_clear_tmdb_key", !this.draft.metadata_clear_tmdb_key)}
            >
              ${this.draft.metadata_clear_tmdb_key ? "Undo" : "Remove"}
            </button>
            ${settingHint("Remove TMDB credential", "Stage removal of the stored credential. Save settings to apply it, or choose Undo to keep it. Removal takes precedence over any replacement entered here.")}
            <span class="setting-description" id="metadata_clear_tmdb_key-hint"
              >Removal is applied only when you save settings; Undo cancels the
              removal.</span
            ></span
          >
        </div>
        <p class="muted" role="status">
          ${this.draft.metadata_clear_tmdb_key ? "Credential removal pending. Save settings to apply, or Undo to keep it." : this.credentialConfigured ? "A credential is saved." : "No credential is saved."}
        </p>
      </div>
      <div class="settings-card">
        <div class="section-heading">
          <div>
            <h3>Preferred sources</h3>
            <p>
              Choose the default source for each movie field. Per-movie edits
              and reviewed choices take priority.
            </p>
          </div>
          <span class="scope-tag">Shared · Save settings</span>
        </div>
        <details class="field-sources" open>
          <summary>Field mapping</summary>
          <p class="muted">
            Automatic uses the available cached sources. A preferred provider
            falls back when a value is missing; Original library data uses only
            the scanned field. These choices do not enable a provider.
          </p>
          <button
            type="button"
            ?disabled=${this.disabled || !this.draft.metadata_tmdb_enabled}
            @click=${() => {
              const patch = Object.fromEntries(
                SOURCE_FIELDS.map(([field, , providers]) => [
                  "metadata_source_" + field,
                  field === "artwork" ||
                  field === "critic_score" ||
                  field === "audience_score" ||
                  field === "distributor"
                    ? "kaleidescape"
                    : providers.some((value) => value === "tmdb")
                      ? "tmdb"
                      : "auto",
                ]),
              );
              this.dispatchEvent(
                new CustomEvent("metadata-settings", {
                  detail: patch,
                  bubbles: true,
                  composed: true,
                }),
              );
            }}
          >
            Prefer TMDB · keep Kaleidescape covers and RT scores
          </button>
          <div class="grid settings-grid spaced">
            ${SOURCE_FIELDS.map(([field, label, providers]) => {
              const key = "metadata_source_" + field,
                selected = String(this.draft[key] ?? "auto");
              const hint =
                field === "artwork"
                  ? "Choose the preferred portrait cover. Kaleidescape uses the edition artwork cached from your system; TMDB downloads covers on metadata refresh when Cover artwork sync is enabled. Per-movie choices take priority."
                  : field === "backdrop"
                    ? "Choose the source for landscape images. TMDB is the available provider; enable TMDB and Cover artwork sync for new downloads. Existing cached images remain usable."
                    : `Choose the preferred source for ${label.toLowerCase()}. Automatic uses available cached sources; a preferred provider falls back when its value is missing. Original library data uses only the scanned field. This does not enable providers or override reviewed per-movie choices.`;
              return html`<div class="setting-field">
                ${settingLabel(key, label, hint)}<select
                  name=${key}
                  id=${key}
                  aria-describedby=${`${key}-hint`}
                  .value=${selected}
                  ?disabled=${this.disabled}
                  @change=${(event: Event) => this.change(key, (event.target as HTMLSelectElement).value)}
                >
                  ${["auto", "original", ...providers].map((value) => html`<option value=${value} ?selected=${value === selected}>${field === "artwork" && value === "kaleidescape" ? "Kaleidescape library cover" : SOURCE_LABELS[value]}</option>`)}
                </select>
              </div>`;
            })}
          </div>
        </details>
        <details class="setting-help">
          <summary>How do artwork and fallback work?</summary>
          <p>
            Kaleidescape covers use edition artwork already cached from your
            system. TMDB covers download on the next metadata refresh when
            Library's Cover artwork sync is enabled. Landscape images currently
            come from TMDB. Disabled providers make no requests; their existing
            cache can still be used.
          </p>
        </details>
      </div>
      <div class="settings-card">
        <div class="section-heading">
          <div>
            <h3>Refresh & editing behavior</h3>
            <p>
              Manage provider traffic and how per-movie metadata edits are
              saved.
            </p>
          </div>
          <span class="scope-tag">Shared · Save settings</span>
        </div>
        ${this.toggle("metadata_auto_save", "Auto-save metadata manager changes", "Save per-movie source and field choices as they change. This does not auto-save this Settings page.")}
        <div class="setting-field spaced">
          ${settingLabel("metadata_requests_per_second", "Shared request limit", "The combined request rate for enabled metadata providers, from 0.1 to 10 requests per second. A lower value slows refreshes and reduces provider traffic; it is not a separate allowance for each provider.")}<span
            class="field-input"
            ><input
              name="metadata_requests_per_second"
              id="metadata_requests_per_second"
              aria-describedby="metadata_requests_per_second-hint"
              type="number"
              min="0.1"
              max="10"
              step="any"
              required
              .value=${String(this.draft.metadata_requests_per_second ?? 2)}
              ?disabled=${this.disabled}
              @input=${(event: Event) => this.change("metadata_requests_per_second", (event.target as HTMLInputElement).value)}
            /><span class="unit">req/sec</span></span
          >
        </div>
      </div>
      <div class="settings-card">
        <div class="section-heading">
          <div>
            <h3>Run a metadata refresh</h3>
            <p>Uses the saved Library and provider settings.</p>
          </div>
          <span class="scope-tag">Runs when requested</span>
        </div>
        ${this.actionsDisabled ? html`<p class="settings-note">Save or cancel your configuration changes before starting a refresh.</p>` : !this.scope.library_enabled ? html`<p class="settings-note">Enable and save Library sync before refreshing metadata.</p>` : nothing}
        <div class="actions">
          <button
            type="button"
            ?disabled=${this.disabled || this.actionsDisabled || !this.scope.library_enabled || this.loading || this.status?.running}
            @click=${() => this.refresh(true)}
          >
            Refresh metadata</button
          ><button
            type="button"
            ?disabled=${this.loading}
            @click=${() => this.refresh()}
          >
            Check metadata status
          </button>
        </div>
        ${this.status ? html`<p role="status">${this.status.running ? "Syncing" : "Idle"} · ${this.status.processed} of ${counted(this.status.total, "movie")} · ${counted(this.status.updated, "provider update")} · ${counted(this.status.skipped, "skipped attempt")}${this.status.error ? ` · ${this.status.error}` : ""}</p>` : nothing}
        ${this.error ? html`<p class="error" role="alert">${this.error}</p>` : nothing}
        <details class="setting-help">
          <summary>When is metadata refreshed?</summary>
          <p>
            Successful Library scans enrich new or week-old metadata. Ambiguous
            matches are skipped. A manual refresh forces a pass using saved
            settings; provider errors stop the pass without automatic HTTP
            retries. Recurring schedules are managed under Automations.
          </p>
        </details>
        <details class="setting-help">
          <summary>Metadata credits</summary>
          ${tmdbCredits()}
          <p>
            Kaleidescape Store metadata and Rotten Tomatoes scores remain
            attributed to their source. TMDB votes are a separate audience
            rating.
          </p>
        </details>
      </div>
    </section>`;
  }
}
if (!customElements.get("kaleidescape-enrichment-settings"))
  customElements.define("kaleidescape-enrichment-settings", EnrichmentSettings);
