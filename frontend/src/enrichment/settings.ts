/** Opt-in external metadata settings; provider credentials never enter public APIs. */
import { LitElement, html, nothing } from "lit";
import type { PropertyValues } from "lit";
import { errorMessage } from "../core/api";
import type { JournalClient, JournalInfo, MetadataStatus } from "../core/api";
import { counted } from "../core/text";
import { styles } from "../ui/styles";
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
