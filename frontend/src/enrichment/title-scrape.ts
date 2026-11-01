/** Review one title before applying selected provider facts and cached images. */
import { LitElement, css, html, nothing } from "lit";
import type { PropertyValues } from "lit";
import { ApiError, errorCode, errorMessage } from "../core/api";
import type {
  JournalClient,
  JournalInfo,
  PreparedMutation,
  ScrapeOptions,
  ScrapeReview,
  ScrapeMatches,
} from "../core/api";
import { counted } from "../core/text";
import { styles } from "../ui/styles";
import { iconAction, iconActionStyles } from "../ui/action-icons";
import { closeButton, dismissBackdrop } from "../ui/dialog";
import { CoverQueue } from "../library/cover";
import "./scrape-image";

const LABELS: Record<string, string> = {
  actors: "Cast",
  directors: "Directors",
  writers: "Writers",
  producers: "Producers",
  studios: "Studios",
  genres: "Genres",
  synopsis: "Synopsis",
  distributor: "Distributor",
  critic_score: "Critic score (%)",
  audience_score: "Audience score (%)",
  audience_rating: "TMDB audience rating (out of 10)",
  audience_votes: "Audience votes",
};

export class TitleScrape extends LitElement {
  static properties = {
    client: { attribute: false },
    scope: { attribute: false },
    versionId: {},
    blocked: { type: Boolean },
    artworkOnly: { type: Boolean },
  };
  static styles = [
    styles,
    iconActionStyles,
    css`
      :host {
        display: inline-block;
      }
      .scrape-button {
        border-radius: 999px;
        min-height: 44px;
      }
      dialog {
        width: min(800px, calc(100% - 24px));
      }
      .scrape-fields {
        display: grid;
        gap: 8px;
      }
      .scrape-field {
        border-bottom: 1px solid var(--line);
        padding: 4px 0;
      }
      .scrape-field .check {
        margin: 0;
      }
      .scrape-field details {
        margin: 0 0 6px 28px;
      }
      .scrape-field pre {
        max-height: 180px;
        overflow: auto;
      }
      .image-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 10px;
      }
      .match-results {
        display: grid;
        gap: 10px;
        max-height: 48dvh;
        overflow-y: auto;
      }
      .match-card {
        display: grid;
        grid-template-columns: 64px minmax(0, 1fr);
        gap: 12px;
        padding: 12px;
        border: 1px solid var(--line);
        border-radius: 10px;
      }
      .match-card h3 {
        margin: 0 0 5px;
        font-size: 16px;
      }
      .match-card p {
        margin: 4px 0;
        font-size: 12px;
      }
      .match-card button {
        float: right;
        margin-top: 6px;
      }
      .current-movie {
        padding: 8px 12px;
        margin-block: 8px 12px;
        border-left: 2px solid var(--line);
        overflow-wrap: anywhere;
      }
      .current-movie h3 {
        margin: 0 0 5px;
        font-size: 13px;
      }
      .current-movie p {
        margin: 3px 0;
        font-size: 12px;
        line-height: 1.4;
      }
      .match-card kaleidescape-scrape-image {
        width: 64px;
        height: 96px;
      }
      .match-placeholder {
        width: 64px;
        min-height: 80px;
        font-size: 11px;
        color: var(--muted);
      }
      .match-search {
        display: flex;
        gap: 8px;
        align-items: end;
        margin-block: 12px;
      }
      .match-search label {
        flex: 1;
        min-width: 0;
      }
      .match-search button {
        flex: none;
      }
      .candidate {
        min-width: 0;
        padding: 6px;
        border: 1px solid var(--line);
        border-radius: 8px;
      }
      .candidate input {
        width: 20px;
        min-height: 20px;
      }
      .candidate:has(input:checked) {
        border-color: var(--accent);
      }
      kaleidescape-scrape-image {
        aspect-ratio: 2/3;
        width: 100%;
        max-width: 160px;
        margin-inline: auto;
      }
      [data-kind="backdrop"] kaleidescape-scrape-image {
        aspect-ratio: 16/9;
        max-width: none;
      }
      .image-grid small {
        overflow-wrap: anywhere;
        font-size: 11px;
      }
      .pagination {
        padding: 10px 0;
      }
      @media (max-width: 600px) {
        .image-grid {
          gap: 6px;
        }
        .candidate {
          padding: 4px;
        }
        .scrape-field .check {
          font-size: 13px;
        }
      }
    `,
  ];
  client?: JournalClient;
  scope?: JournalInfo;
  versionId = "";
  blocked = false;
  artworkOnly = false;
  private options?: ScrapeOptions;
  private review?: ScrapeReview;
  private candidatesPage?: ScrapeMatches;
  private query = "";
  private provider = "";
  private fields = new Set<string>();
  private images: Record<string, string> = {};
  private pages: Record<string, number> = { poster: 0, backdrop: 0 };
  private tab = "metadata";
  private busy = false;
  private pending?: PreparedMutation;
  private error = "";
  private generation = 0;
  private queue = new CoverQueue();
  protected willUpdate(changed: PropertyValues) {
    if (
      ["client", "scope", "versionId", "artworkOnly"].some((key) =>
        changed.has(key),
      )
    )
      this.reset();
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    this.reset();
  }
  private lock() {
    this.dispatchEvent(
      new CustomEvent("scrape-lock", {
        detail: !!this.pending,
        bubbles: true,
        composed: true,
      }),
    );
  }
  private reset() {
    this.generation++;
    this.options = this.review = undefined;
    this.candidatesPage = undefined;
    this.query = "";
    this.fields.clear();
    this.images = {};
    this.pending = undefined;
    this.busy = false;
    this.error = "";
    this.provider = "";
    this.tab = "metadata";
    this.pages = { poster: 0, backdrop: 0 };
    this.queue.cache.dispose();
    this.queue = new CoverQueue();
    this.renderRoot.querySelector<HTMLDialogElement>("dialog")?.close();
    this.lock();
  }
  private close() {
    if (!this.pending) {
      this.reset();
      this.requestUpdate();
    }
  }
  private async open() {
    if (!this.client || !this.scope?.permissions.edit || this.blocked) return;
    this.reset();
    this.busy = true;
    this.requestUpdate();
    await this.updateComplete;
    this.renderRoot.querySelector<HTMLDialogElement>("dialog")!.showModal();
    const generation = this.generation;
    try {
      const options = await this.client.titleScrapeOptions(
        this.scope,
        this.versionId,
      );
      if (generation !== this.generation) return;
      this.options = this.artworkOnly
        ? {
            ...options,
            providers: options.providers.filter(
              (provider) => provider.id === "tmdb",
            ),
          }
        : options;
      this.query = options.search_title ?? options.title ?? "";
      this.provider =
        this.options.providers.find((provider) => provider.available)?.id ?? "";
    } catch (error) {
      if (generation === this.generation) this.report(error);
    } finally {
      if (generation === this.generation) {
        this.busy = false;
        this.requestUpdate();
      }
    }
    if (
      generation === this.generation &&
      this.artworkOnly &&
      this.provider &&
      this.options?.artwork_enabled
    )
      await this.scrape();
  }
  private async scrape(choice = "") {
    if (!this.client || !this.scope || !this.provider || this.pending) return;
    const generation = this.generation;
    this.busy = true;
    this.error = "";
    this.requestUpdate();
    try {
      const review = await this.client.titleScrapePreview(
        this.scope,
        this.versionId,
        this.provider,
        choice ? this.candidatesPage?.search_id : undefined,
        choice,
      );
      if (generation !== this.generation) return;
      if ("search_id" in review) {
        this.candidatesPage = review;
        this.query = review.query;
        this.review = undefined;
        this.dispatchEvent(
          new CustomEvent("scrape-status-changed", {
            bubbles: true,
            composed: true,
          }),
        );
        return;
      }
      this.review = review;
      this.fields = new Set(this.artworkOnly ? [] : Object.keys(review.fields));
      this.images = {};
      const backdrop = review.images.find((image) => image.kind === "backdrop");
      if (review.has_backdrop === false && backdrop)
        this.images.backdrop = backdrop.id;
      this.tab = this.artworkOnly
        ? review.images.some((image) => image.kind === "poster")
          ? "poster"
          : "backdrop"
        : "metadata";
      this.pages = { poster: 0, backdrop: 0 };
    } catch (error) {
      if (generation === this.generation) this.report(error);
    } finally {
      if (generation === this.generation) {
        this.busy = false;
        this.requestUpdate();
      }
    }
  }
  private async search() {
    if (
      !this.client ||
      !this.scope ||
      !this.provider ||
      !this.query.trim() ||
      this.pending ||
      this.busy
    )
      return;
    const generation = this.generation;
    this.busy = true;
    this.error = "";
    this.requestUpdate();
    try {
      const matches = await this.client.titleScrapeSearch(
        this.scope,
        this.versionId,
        this.provider,
        this.query,
      );
      if (generation === this.generation) {
        this.candidatesPage = matches;
        this.review = undefined;
      }
    } catch (error) {
      if (generation === this.generation) this.report(error);
    } finally {
      if (generation === this.generation) {
        this.busy = false;
        this.requestUpdate();
      }
    }
  }
  private async apply(unavailable?: boolean) {
    if (
      !this.client ||
      !this.scope ||
      (!this.review && !this.pending && unavailable === undefined) ||
      this.busy
    )
      return;
    const generation = this.generation;
    this.busy = true;
    this.error = "";
    try {
      if (unavailable !== undefined && !this.pending) {
        // Searches may have recorded a conflict since the dialog opened.
        const options = await this.client.titleScrapeOptions(
          this.scope,
          this.versionId,
        );
        if (generation !== this.generation) return;
        if (!options.snapshot) throw new ApiError("refresh_required");
        this.pending = this.client.prepareScraperAvailability(this.scope, {
          title_id: this.versionId,
          provider: this.provider,
          snapshot: options.snapshot,
          unavailable,
        });
      }
      this.pending ??= this.client.prepareTitleScrape(this.scope, {
        plan_id: this.review!.plan_id,
        fields: [...this.fields],
        images: this.images,
        ...(this.review!.matched ? { save_match: true } : {}),
      });
      this.lock();
      this.requestUpdate();
      const result = await this.client.applyTitleScrape(this.pending);
      if (generation !== this.generation) return;
      this.pending = undefined;
      this.lock();
      this.close();
      this.dispatchEvent(
        new CustomEvent("metadata-changed", {
          detail: result,
          bubbles: true,
          composed: true,
        }),
      );
    } catch (error) {
      if (generation !== this.generation) return;
      this.report(error);
      if (
        ["invalid_request", "conflict", "refresh_required"].includes(
          errorCode(error),
        )
      ) {
        this.pending = undefined;
        this.lock();
      }
    } finally {
      if (generation === this.generation) {
        this.busy = false;
        this.requestUpdate();
      }
    }
  }
  private report(error: unknown) {
    this.error = errorMessage(error);
    if (errorCode(error) === "unauthorized")
      this.dispatchEvent(
        new CustomEvent("access-denied", { bubbles: true, composed: true }),
      );
  }
  private summary(value: unknown) {
    if (typeof value === "string" && value.length > 90)
      return counted(value.length, "character");
    return Array.isArray(value)
      ? counted(value.length, "name")
      : String(value ?? "Empty");
  }
  private tabKey(event: KeyboardEvent) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    const tabs = [
      ...(
        event.currentTarget as HTMLElement
      ).querySelectorAll<HTMLButtonElement>('[role="tab"]'),
    ];
    const current = tabs.findIndex(
      (tab) => tab.getAttribute("aria-selected") === "true",
    );
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? tabs.length - 1
          : (current + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) %
            tabs.length;
    event.preventDefault();
    tabs[next]?.click();
    tabs[next]?.focus();
  }
  private gallery(kind: "poster" | "backdrop") {
    const images = this.review!.images.filter((image) => image.kind === kind);
    if (!images.length) return nothing;
    const start = this.pages[kind] * 6;
    return html`<p class="muted">
        Choose one image, or keep the current image.
      </p>
      <label class="check"
        ><input
          type="radio"
          name=${kind}
          ?disabled=${!!this.pending}
          .checked=${!this.images[kind]}
          @change=${() => {
            delete this.images[kind];
            this.requestUpdate();
          }}
        />Keep current image</label
      >
      <div class="image-grid" data-kind=${kind}>
        ${images.slice(start, start + 6).map(
          (image, index) =>
            html`<label class="candidate"
              ><kaleidescape-scrape-image
                style=${Number.isFinite(image.width) && Number.isFinite(image.height) && image.width! > 0 && image.height! > 0 ? `aspect-ratio: ${image.width}/${image.height}` : ""}
                .client=${this.client}
                .scope=${this.scope}
                .queue=${this.queue}
                .plan=${this.review!.plan_id}
                .choice=${image.id}
              ></kaleidescape-scrape-image
              ><span
                ><input
                  type="radio"
                  name=${kind}
                  ?disabled=${!!this.pending}
                  .checked=${this.images[kind] === image.id}
                  @change=${() => {
                    this.images[kind] = image.id;
                    this.requestUpdate();
                  }}
                />${kind === "poster" ? "Poster" : "Backdrop"}
                ${start + index + 1}</span
              ><small
                >${image.width ?? "?"} × ${image.height ?? "?"}</small
              ></label
            >`,
        )}
      </div>
      <div class="pagination">
        <small
          >${start + 1}–${Math.min(start + 6, images.length)} of
          ${images.length}</small
        >
        <div class="actions">
          <button
            ?disabled=${!start}
            @click=${() => {
              this.pages[kind]--;
              this.requestUpdate();
            }}
          >
            Previous images</button
          ><button
            ?disabled=${start + 6 >= images.length}
            @click=${() => {
              this.pages[kind]++;
              this.requestUpdate();
            }}
          >
            Next images
          </button>
        </div>
      </div>`;
  }
  private matchResults() {
    const matches = this.candidatesPage;
    if (!matches) return nothing;
    return html`<p class="muted">
        Choose the correct movie. Up to eight results are shown; refine the
        title search if needed. The match is saved when you apply its review.
      </p>
      ${!matches.candidates.length ? html`<p role="status">No matching movies found. Try a different title in the search above.</p>` : nothing}
      <div class="match-results" aria-label="Scraper matches">
        ${matches.candidates.map(
          (candidate) =>
            html`<article class="match-card">
              ${candidate.has_artwork ? html`<kaleidescape-scrape-image .client=${this.client} .scope=${this.scope} .queue=${this.queue} .plan=${matches.search_id} .choice=${candidate.id}></kaleidescape-scrape-image>` : html`<div class="match-placeholder">Cover unavailable</div>`}
              <div>
                <h3>${candidate.title} (${candidate.year})</h3>
                <p>
                  <strong>Director:</strong>
                  ${candidate.directors.join(", ") || "Unavailable"}
                </p>
                <p>
                  <strong>Cast:</strong>
                  ${candidate.actors.join(", ") || "Unavailable"}
                </p>
                <p>
                  <strong>Genres:</strong>
                  ${candidate.genres.join(", ") || "Unavailable"}
                </p>
                <button
                  ?disabled=${this.busy || !!this.pending}
                  @click=${() => this.scrape(candidate.id)}
                >
                  Use this match
                </button>
              </div>
            </article>`,
        )}
      </div>`;
  }
  protected render() {
    if (!this.scope?.permissions.edit) return nothing;
    return html`${iconAction(this.artworkOnly ? "Edit Artwork" : "Scrape title", this.artworkOnly ? "artwork" : "scrape", this.blocked || !!this.pending, () => this.open(), "scrape-button")}
      <dialog
        data-admin-dialog
        class="inset-dialog"
        aria-labelledby="scrape-title"
        @click=${dismissBackdrop}
        @cancel=${(event: Event) => {
          if (this.pending) event.preventDefault();
          else this.close();
        }}
      >
        <div class="card-head">
          <h2 id="scrape-title">
            ${this.artworkOnly ? (this.review ? `Edit Artwork: ${this.review.title}` : "Edit Artwork") : this.review ? `Review scrape: ${this.review.title}` : "Scrape title"}
          </h2>
          ${closeButton(() => this.close(), !!this.pending)}
        </div>
        ${this.error ? html`<p class="error" role="alert">${this.error}</p>` : nothing}
        ${this.busy ? html`<p role="status">${this.pending ? "Applying selected data…" : "Retrieving provider data…"}</p>` : nothing}
        ${this.currentMovie()}
        ${
          this.review
            ? html`${this.review.matched ? html`<p class="notice">Matched: <strong>${this.review.matched.title} (${this.review.matched.year})</strong>. This source choice will be saved for future scrapes.</p>` : nothing}
                ${
                  this.artworkOnly
                    ? html`<p class="muted">
                        Choose a poster and backdrop. Only selected images are
                        applied; movie details are kept.
                      </p>`
                    : html`<p class="muted">
                        Selected fields replace displayed data across this
                        movie's versions and survive automatic scans. Identity,
                        purchase and viewing data are preserved. TMDB cast
                        follows billing order; other providers retain source
                        order.
                      </p>`
                }
                <div
                  class="page-tabs"
                  role="tablist"
                  aria-label="Scrape data"
                  @keydown=${this.tabKey}
                >
                  ${[
                    [
                      "metadata",
                      `Metadata (${Object.keys(this.review.fields).length})`,
                    ],
                    [
                      "poster",
                      `Poster (${this.review.images.filter((image) => image.kind === "poster").length})`,
                    ],
                    [
                      "backdrop",
                      `Backdrop (${this.review.images.filter((image) => image.kind === "backdrop").length})`,
                    ],
                  ]
                    .filter(([key]) =>
                      key === "metadata"
                        ? !this.artworkOnly
                        : this.review!.images.some(
                            (image) => image.kind === key,
                          ),
                    )
                    .map(
                      ([key, label]) =>
                        html`<button
                          role="tab"
                          aria-selected=${this.tab === key}
                          tabindex=${this.tab === key ? 0 : -1}
                          @click=${() => {
                            this.tab = key;
                            this.requestUpdate();
                          }}
                        >
                          ${label}
                        </button>`,
                    )}
                </div>
                ${
                  this.tab === "metadata"
                    ? html`<div class="actions">
                          <button
                            ?disabled=${!!this.pending}
                            @click=${() => {
                              this.fields = new Set(
                                Object.keys(this.review!.fields),
                              );
                              this.requestUpdate();
                            }}
                          >
                            Select all fields</button
                          ><button
                            ?disabled=${!!this.pending}
                            @click=${() => {
                              this.fields.clear();
                              this.requestUpdate();
                            }}
                          >
                            Clear fields
                          </button>
                        </div>
                        <div class="scrape-fields">
                          ${Object.entries(this.review.fields).map(
                            ([key, value]) =>
                              html`<div class="scrape-field">
                                <label class="check"
                                  ><input
                                    type="checkbox"
                                    ?disabled=${!!this.pending}
                                    .checked=${this.fields.has(key)}
                                    @change=${(event: Event) => {
                                      if (
                                        (event.target as HTMLInputElement)
                                          .checked
                                      )
                                        this.fields.add(key);
                                      else this.fields.delete(key);
                                      this.requestUpdate();
                                    }}
                                  />${LABELS[key] ?? key} ·
                                  ${this.summary(value.after)}</label
                                >
                                <details>
                                  <summary>Compare values</summary>
                                  <small>Current</small>
                                  <pre>
${Array.isArray(value.before) ? value.before.join(", ") : String(value.before ?? "Empty")}</pre>
                                  <small>From scraper</small>
                                  <pre>
${Array.isArray(value.after) ? value.after.join(", ") : String(value.after)}</pre>
                                </details>
                              </div>`,
                          )}
                        </div>`
                    : this.gallery(this.tab as "poster" | "backdrop")
                }${!this.review.images.length ? html`<p class="muted">${this.review.artwork_enabled ? "This provider returned no image choices." : "Enable Sync artwork in Settings to retrieve image choices."}</p>` : nothing}`
            : this.options
              ? html`${this.artworkOnly && !this.options.artwork_enabled ? html`<p class="notice">Enable Sync artwork in Settings to retrieve image choices.</p>` : nothing}<label
                    >Enabled scraper<select
                      .value=${this.provider}
                      ?disabled=${this.busy}
                      @change=${(event: Event) => {
                        this.provider = (
                          event.target as HTMLSelectElement
                        ).value;
                        this.candidatesPage = undefined;
                        this.error = "";
                        this.requestUpdate();
                      }}
                    >
                      <option value="">Choose a scraper</option>
                      ${this.options.providers.map(
                        (provider) =>
                          html`<option
                            value=${provider.id}
                            ?disabled=${!provider.available}
                            title=${provider.missing_data ? "No saved data from this scraper" : ""}
                            aria-label=${[provider.label, provider.unavailable ? "no data available" : provider.missing_data ? "no saved data" : "", provider.available ? "" : "missing credential"].filter(Boolean).join(" · ")}
                          >
                            ${provider.label}${provider.unavailable ? " · no data available" : provider.missing_data ? " ⚠" : ""}${provider.available ? "" : " · missing credential"}
                          </option>`,
                      )}
                    </select></label
                  >
                  ${this.options.providers.some((provider) => provider.missing_data) ? html`<p class="muted">⚠ No saved data from this scraper.</p>` : nothing}
                  ${this.options.providers.find((provider) => provider.id === this.provider)?.unavailable ? html`<p class="muted">No scraper data available for this provider. Automatic attempts and conflicts are excluded. You can still search manually, or clear the flag to resume automatic attempts.</p>` : nothing}
                  <form
                    class="match-search"
                    @submit=${(event: Event) => {
                      event.preventDefault();
                      void this.search();
                    }}
                  >
                    <label
                      >Title search<input
                        name="scraper_query"
                        type="search"
                        maxlength="200"
                        .value=${this.query}
                        ?disabled=${this.busy || !!this.pending}
                        @input=${(event: Event) => {
                          this.query = (event.target as HTMLInputElement).value;
                          this.requestUpdate();
                        }} /></label
                    ><button
                      type="submit"
                      ?disabled=${this.busy || !this.provider || !this.query.trim()}
                    >
                      Search titles
                    </button>
                  </form>
                  ${this.matchResults()}${!this.options.providers.some((provider) => provider.available) ? html`<p class="muted">Enable and configure a scraper in Settings first.</p>` : nothing}`
              : nothing
        }
        <div class="dialog-footer">
          ${!this.artworkOnly && !this.review && !this.pending && this.options?.snapshot && this.provider ? html`<button class="availability-button" ?disabled=${this.busy} @click=${() => this.apply(!this.options?.providers.find((provider) => provider.id === this.provider)?.unavailable)}>${this.options.providers.find((provider) => provider.id === this.provider)?.unavailable ? "Clear no-data flag" : "Mark no scraper data available"}</button>` : nothing}
          ${
            this.pending
              ? html`<button
                  ?disabled=${this.busy}
                  @click=${() => {
                    if (
                      window.confirm(
                        "Inspect the Library before discarding this unconfirmed apply. Discard retry?",
                      )
                    ) {
                      this.pending = undefined;
                      this.lock();
                      this.requestUpdate();
                    }
                  }}
                >
                  Discard retry
                </button>`
              : this.review
                ? html`<button
                    ?disabled=${this.busy}
                    @click=${() => {
                      this.review = undefined;
                      this.error = "";
                      this.requestUpdate();
                    }}
                  >
                    Change match / scraper
                  </button>`
                : nothing
          }<button
            class="primary"
            ?disabled=${this.busy || (this.artworkOnly && !this.options?.artwork_enabled) || (!this.review && !this.provider) || (!!this.review && (this.artworkOnly || !this.review.matched) && !this.fields.size && !Object.keys(this.images).length)}
            @click=${() => (this.pending || this.review ? this.apply() : this.scrape())}
          >
            ${this.pending ? "Retry exact apply" : this.review ? (this.artworkOnly ? "Apply images" : this.review.matched && !this.fields.size && !Object.keys(this.images).length ? "Save match" : "Apply selected data") : this.candidatesPage ? "Try automatic match" : "Scrape title"}
          </button>
        </div>
      </dialog>`;
  }
  private currentMovie() {
    const current = this.options?.current;
    return current
      ? html`<section class="current-movie" aria-label="Current Library movie">
          <h3>Current Library movie</h3>
          <p>
            <strong>${current.title}</strong> ·
            ${current.year ?? "Year unavailable"}
          </p>
          <p>
            <strong>Director:</strong>
            ${current.directors.join(", ") || "Unavailable"}
          </p>
          <p>
            <strong>Top cast:</strong>
            ${current.actors.join(", ") || "Unavailable"}
          </p>
        </section>`
      : nothing;
  }
}
if (!customElements.get("kaleidescape-title-scrape"))
  customElements.define("kaleidescape-title-scrape", TitleScrape);
