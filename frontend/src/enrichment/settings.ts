/** Opt-in external metadata settings; provider credentials never enter public APIs. */
import { LitElement, html, nothing } from "lit";
import type { PropertyValues } from "lit";
import { errorMessage } from "../core/api";
import type { JournalClient, JournalInfo, MetadataStatus } from "../core/api";
import { counted } from "../core/text";
import { styles } from "../ui/styles";
import { SOURCE_FIELDS, SOURCE_LABELS } from "./sources";
import { tmdbCredits } from "./credits";

export class EnrichmentSettings extends LitElement {
  static properties = {
    client: { attribute: false },
    scope: { attribute: false },
    draft: { attribute: false },
    disabled: { type: Boolean },
  };
  static styles = styles;
  client?: JournalClient;
  scope?: JournalInfo;
  draft: Record<string, unknown> = {};
  disabled = false;
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
    this.dispatchEvent(
      new CustomEvent("metadata-settings", {
        detail: { [key]: value },
        bubbles: true,
        composed: true,
      }),
    );
  }
  private async refresh(sync = false) {
    if (this.loading || !this.scope?.permissions.edit || !this.client) return;
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
  protected render() {
    if (!this.scope?.permissions.edit) return nothing;
    return html`<section aria-label="External metadata">
      <h3>External movie metadata</h3>
      <p class="muted">
        Optional internet lookups share movie titles and release years with the
        enabled provider. Store enrichment uses existing purchase store links;
        it sends no prices or order IDs. Both providers are disabled by default.
        Save settings before syncing.
      </p>
      ${[
        ["metadata_store_enabled", "Kaleidescape public store (experimental)"],
        ["metadata_tmdb_enabled", "TMDB"],
      ].map(
        ([key, label]) =>
          html`<label class="check"
            ><input
              name=${key}
              type="checkbox"
              .checked=${!!this.draft[key]}
              ?disabled=${this.disabled}
              @change=${(event: Event) => this.change(key, (event.target as HTMLInputElement).checked)}
            />Enable ${label}</label
          >`,
      )}
      <div class="grid settings-grid">
        <label
          >Requests per second · shared limit<input
            name="metadata_requests_per_second"
            type="number"
            min="0.1"
            max="10"
            step="0.1"
            .value=${String(this.draft.metadata_requests_per_second ?? 2)}
            ?disabled=${this.disabled}
            @input=${(event: Event) => this.change("metadata_requests_per_second", Number((event.target as HTMLInputElement).value))}
        /></label>
        <label
          >TMDB API key or API Read Access Token<input
            name="metadata_tmdb_credential"
            type="password"
            autocomplete="new-password"
            maxlength="1024"
            placeholder="Blank keeps the saved credential"
            .value=${String(this.draft.metadata_tmdb_credential ?? "")}
            ?disabled=${this.disabled}
            @input=${(event: Event) => this.change("metadata_tmdb_credential", (event.target as HTMLInputElement).value)}
        /></label>
      </div>
      <label class="check"
        ><input
          name="metadata_clear_tmdb_key"
          type="checkbox"
          .checked=${!!this.draft.metadata_clear_tmdb_key}
          ?disabled=${this.disabled}
          @change=${(event: Event) => this.change("metadata_clear_tmdb_key", (event.target as HTMLInputElement).checked)}
        />Remove saved TMDB credential</label
      >
      <details class="field-sources">
        <summary>Preferred metadata sources</summary>
        <p class="muted">
          These shared choices apply to the whole Library after Save settings.
          Missing provider values fall back to another cached source. Original
          library data uses only the scanned field. Per-title edits and reviewed
          selections take priority. Enabling a preference does not enable a
          scraper.
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
        <div class="grid settings-grid">
          ${SOURCE_FIELDS.map(([field, label, providers]) => {
            const key = "metadata_source_" + field;
            return html`<label
              >${label}<select
                name=${key}
                .value=${String(this.draft[key] ?? "auto")}
                ?disabled=${this.disabled}
                @change=${(event: Event) => this.change(key, (event.target as HTMLSelectElement).value)}
              >
                ${["auto", "original", ...providers].map((value) => html`<option value=${value}>${field === "artwork" && value === "kaleidescape" ? "Kaleidescape library cover" : SOURCE_LABELS[value]}</option>`)}
              </select></label
            >`;
          })}
        </div>
        <p class="muted">
          Kaleidescape covers use the edition artwork already cached from your
          player. TMDB covers download on the next metadata refresh when Sync
          artwork is enabled. Landscape images currently come from TMDB.
          Disabled scrapers make no requests; their existing cache can still be
          used.
        </p>
      </details>
      <p class="muted">
        Successful scans enrich new or week-old metadata. Ambiguous matches are
        skipped. Provider errors stop the pass; no automatic HTTP retry. Refresh
        metadata forces a pass using saved settings.
      </p>
      <div class="actions">
        <button
          type="button"
          ?disabled=${this.disabled || this.loading || this.status?.running}
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
      <details>
        <summary>Metadata credits</summary>
        ${tmdbCredits()}
        <p>
          Kaleidescape store metadata and Rotten Tomatoes scores remain
          attributed to their source. TMDB votes are a separate audience rating.
        </p>
      </details>
    </section>`;
  }
}
if (!customElements.get("kaleidescape-enrichment-settings"))
  customElements.define("kaleidescape-enrichment-settings", EnrichmentSettings);
