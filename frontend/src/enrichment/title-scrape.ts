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
import "../library/cover";
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
      dialog.inset-dialog {
        --dialog-top-gap: max(24px, env(safe-area-inset-top));
        width: min(900px, calc(100% - 24px));
        max-height: min(88dvh, 900px);
        overflow-y: auto;
      }
      .manager-head > div:first-child {
        flex: 1;
        min-width: 0;
      }
      .manager-head .dialog-close {
        margin-left: auto;
      }
      .manager-head p {
        margin: 2px 0 0;
        color: var(--muted);
      }
      .manager-section {
        border: 1px solid var(--line);
        border-radius: 12px;
        padding: 14px;
        margin-block: 12px;
        background: var(--card-background-color, transparent);
      }
      .manager-section h3 {
        margin: 0 0 10px;
      }
      .current-layout {
        display: grid;
        grid-template-columns: minmax(0, 1.3fr) minmax(220px, 0.85fr) minmax(
            155px,
            0.7fr
          );
        gap: 14px;
        align-items: start;
      }
      .current-identity {
        display: grid;
        grid-template-columns: 84px minmax(0, 1fr);
        gap: 12px;
      }
      .current-identity kaleidescape-library-cover {
        width: 84px;
        height: 126px;
        aspect-ratio: 2 / 3;
        border-radius: 8px;
      }
      .current-backdrop kaleidescape-library-cover {
        width: min(100%, 224px);
        height: 126px;
        aspect-ratio: 16 / 9;
        border-radius: 8px;
      }
      .current-meta {
        margin: 0;
        display: grid;
        grid-template-columns: auto 1fr;
        gap: 4px 12px;
      }
      .current-meta dt {
        color: var(--muted);
      }
      .current-meta dd {
        margin: 0;
      }
      .expectation {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-top: 8px;
        font-size: 13px;
      }
      .status-line {
        display: flex;
        align-items: center;
        gap: 7px;
        margin: 7px 0;
        font-size: 13px;
      }
      .status-line[data-complete="true"] .status-icon {
        color: var(--success-color, #4caf50);
      }
      .status-line[data-complete="false"] .status-icon {
        color: var(--warning-color, #e2a600);
      }
      .switch {
        position: relative;
        display: inline-flex;
        align-items: center;
        width: 38px;
        height: 22px;
        flex: none;
        cursor: pointer;
      }
      .switch input {
        position: absolute;
        opacity: 0;
        width: 1px;
        height: 1px;
      }
      .switch span {
        width: 38px;
        height: 22px;
        border-radius: 999px;
        background: var(--divider-color, #666);
        transition: background 0.15s;
      }
      .switch span::after {
        content: "";
        display: block;
        width: 18px;
        height: 18px;
        margin: 2px;
        border-radius: 50%;
        background: #fff;
        transition: transform 0.15s;
      }
      .switch input:checked + span {
        background: var(--accent);
      }
      .switch input:checked + span::after {
        transform: translateX(16px);
      }
      .switch input:focus-visible + span {
        outline: 3px solid var(--accent);
        outline-offset: 2px;
      }
      .switch input:disabled + span {
        opacity: 0.5;
      }
      .source-list {
        display: grid;
        gap: 8px;
      }
      .source-row {
        display: grid;
        grid-template-columns:
          38px minmax(120px, 1fr) minmax(150px, 1.2fr)
          auto;
        gap: 10px;
        align-items: center;
        border: 1px solid var(--line);
        border-radius: 8px;
        padding: 10px;
      }
      .source-row small {
        color: var(--muted);
      }
      .manager-tabs {
        margin-top: 12px;
      }
      .manager-actions {
        justify-content: space-between;
      }
      .source-row .actions {
        justify-content: flex-end;
      }
      @media (max-width: 850px) {
        .current-layout {
          grid-template-columns: minmax(0, 1fr) minmax(190px, 0.8fr);
        }
        .artwork-status {
          grid-column: 1 / -1;
        }
        .source-row {
          grid-template-columns: 38px minmax(0, 1fr) auto;
        }
        .source-row .source-detail {
          grid-column: 2 / -1;
        }
      }
      @media (max-width: 600px) {
        .current-layout {
          grid-template-columns: 1fr;
        }
        .artwork-status {
          grid-column: auto;
        }
        .source-row {
          grid-template-columns: 38px minmax(0, 1fr);
        }
        .source-row .actions {
          grid-column: 2;
          justify-content: flex-start;
        }
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
      .match-search .year-field {
        flex: 0 0 110px;
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
  private year = "";
  private provider = "";
  private sourceExpected: Record<string, boolean> = {};
  private artworkExpected = { poster: true, backdrop: true };
  private fields = new Set<string>();
  private images: Record<string, string> = {};
  private pages: Record<string, number> = { poster: 0, backdrop: 0 };
  private tab = "metadata";
  private view: "sources" | "mapping" | "history" = "sources";
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
    this.year = "";
    this.fields.clear();
    this.images = {};
    this.pending = undefined;
    this.busy = false;
    this.error = "";
    this.provider = "";
    this.sourceExpected = {};
    this.artworkExpected = { poster: true, backdrop: true };
    this.tab = "metadata";
    this.view = "sources";
    this.pages = { poster: 0, backdrop: 0 };
    this.queue.cache.dispose();
    this.queue = new CoverQueue();
    this.renderRoot.querySelector<HTMLDialogElement>("dialog")?.close();
    this.lock();
  }
  private close() {
    const plan = this.review?.plan_id ?? this.candidatesPage?.search_id;
    if (plan && this.client && this.scope)
      void this.client.cancelTitleScrape(this.scope, plan).catch(() => {});
    this.reset();
    this.requestUpdate();
  }
  private clearCandidates() {
    if (this.candidatesPage && this.client && this.scope)
      void this.client
        .cancelTitleScrape(this.scope, this.candidatesPage.search_id)
        .catch(() => {});
    this.candidatesPage = undefined;
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
      this.options = options;
      this.query = options.search_title ?? options.title ?? "";
      this.year = options.current?.year ? String(options.current.year) : "";
      this.sourceExpected = Object.fromEntries(
        this.options.providers.map((source) => [
          source.id,
          !source.unavailable,
        ]),
      );
      this.artworkExpected = {
        poster: !options.artwork_unavailable?.includes("poster"),
        backdrop: !options.artwork_unavailable?.includes("backdrop"),
      };
      this.provider =
        this.visibleProviders.find(
          (provider) => provider.available && !provider.unavailable,
        )?.id ?? "";
    } catch (error) {
      if (generation === this.generation) this.report(error);
    } finally {
      if (generation === this.generation) {
        this.busy = false;
        this.requestUpdate();
      }
    }
  }
  private get visibleProviders() {
    return this.artworkOnly
      ? (this.options?.providers ?? []).filter(
          (provider) => provider.supports_images,
        )
      : (this.options?.providers ?? []);
  }
  private get validYear() {
    return (
      !this.year.trim() ||
      (Number.isInteger(Number(this.year)) &&
        Number(this.year) >= 1800 &&
        Number(this.year) <= 2100)
    );
  }
  private get expectationsChanged() {
    return (
      !!this.options &&
      (this.options.providers.some(
        (source) => this.sourceExpected[source.id] !== !source.unavailable,
      ) ||
        (["poster", "backdrop"] as const).some(
          (kind) =>
            this.artworkExpected[kind] !==
            !this.options!.artwork_unavailable?.includes(kind),
        ))
    );
  }
  private statusLine(label: string, complete: boolean) {
    return html`<p class="status-line" data-complete=${complete}>
      <span class="status-icon" aria-hidden="true"
        >${complete ? "✓" : "⚠"}</span
      >
      ${label}: ${complete ? "Complete" : "Missing"}
    </p>`;
  }
  private async inspect(provider: string) {
    if (this.expectationsChanged || !this.sourceExpected[provider]) return;
    this.provider = provider;
    await this.search();
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
      this.view = "mapping";
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
      !this.sourceExpected[this.provider] ||
      !this.query.trim() ||
      !this.validYear ||
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
        this.year.trim() ? Number(this.year) : undefined,
      );
      if (generation === this.generation) {
        this.candidatesPage = matches;
        this.review = undefined;
        this.view = "sources";
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
  private async apply() {
    if (
      !this.client ||
      !this.scope ||
      (!this.review && !this.pending && !this.expectationsChanged) ||
      this.busy
    )
      return;
    const generation = this.generation;
    this.busy = true;
    this.error = "";
    try {
      if (!this.pending && !this.review) {
        const options = await this.client.titleScrapeOptions(
          this.scope,
          this.versionId,
        );
        if (generation !== this.generation) return;
        if (!options.snapshot || options.snapshot !== this.options?.snapshot)
          throw new ApiError("refresh_required");
        this.pending = this.client.prepareScrapeExpectations(this.scope, {
          title_id: this.versionId,
          snapshot: options.snapshot,
          providers: this.sourceExpected,
          artwork: this.artworkExpected,
        });
      }
      if (!this.pending && this.review)
        this.pending = this.client.prepareTitleScrape(this.scope, {
          plan_id: this.review.plan_id,
          fields: [...this.fields],
          images: this.images,
          ...(this.review.matched ? { save_match: true } : {}),
        });
      this.lock();
      this.requestUpdate();
      const result = await this.client.applyTitleScrape(this.pending!);
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
        [
          "invalid_request",
          "conflict",
          "refresh_required",
          "not_found",
          "metadata_unavailable",
          "metadata_disabled",
          "library_artwork",
          "provider_destination",
          "provider_encoding",
          "provider_content_type",
          "provider_response_too_large",
          "provider_http_error",
          "provider_access_denied",
          "provider_rate_limited",
          "provider_artwork_unavailable",
          "provider_disabled",
        ].includes(errorCode(error))
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
  private searchPanel() {
    if (!this.options) return nothing;
    return html`<section class="manager-section" aria-label="Search and match">
      <h3>Search &amp; Match</h3>
      <div class="match-search">
        <label
          >Title search<input
            name="scraper_query"
            type="search"
            maxlength="200"
            .value=${this.query}
            ?disabled=${this.busy || !!this.pending}
            @input=${(event: Event) => {
              this.query = (event.target as HTMLInputElement).value;
              this.review = undefined;
              this.clearCandidates();
              this.view = "sources";
              this.requestUpdate();
            }}
        /></label>
        <label class="year-field"
          >Release year<input
            name="scraper_year"
            type="number"
            min="1800"
            max="2100"
            step="1"
            .value=${this.year}
            ?disabled=${this.busy || !!this.pending}
            @input=${(event: Event) => {
              this.year = (event.target as HTMLInputElement).value;
              this.review = undefined;
              this.clearCandidates();
              this.view = "sources";
              this.requestUpdate();
            }}
        /></label>
      </div>
      ${
        this.review?.matched
          ? html`<p class="notice">
              Selected match:
              <strong
                >${this.review.matched.title}
                (${this.review.matched.year})</strong
              >
            </p>`
          : nothing
      }
      ${this.matchResults()}
    </section>`;
  }
  private sourcePanel() {
    if (!this.options) return nothing;
    return html`<section class="manager-section" aria-label="Scraper sources">
      <h3>Scraper Sources</h3>
      ${this.artworkOnly && !this.options.artwork_enabled ? html`<p class="notice">Enable Sync artwork in Settings to retrieve image choices.</p>` : nothing}
      <p class="muted">
        Switch on sources expected for this movie. Inspect searches that source
        using the title and year above. Save switch changes before inspecting.
      </p>
      <div class="source-list">
        ${this.visibleProviders.map(
          (source) =>
            html`<div class="source-row" data-provider=${source.id}>
              <label
                class="switch"
                title=${`Use ${source.label} for this movie`}
                ><input
                  type="checkbox"
                  aria-label=${`Use ${source.label} for this movie`}
                  .checked=${this.sourceExpected[source.id] ?? false}
                  ?disabled=${this.busy || !!this.pending || !!this.review || !this.options?.snapshot}
                  @change=${(event: Event) => {
                    this.clearCandidates();
                    this.sourceExpected = {
                      ...this.sourceExpected,
                      [source.id]: (event.target as HTMLInputElement).checked,
                    };
                    this.requestUpdate();
                  }} /><span aria-hidden="true"></span
              ></label>
              <strong>${source.label}</strong>
              <span class="source-detail"
                >${source.has_data ? `${source.fields ?? 0} fields saved` : this.sourceExpected[source.id] ? "Metadata missing" : "No data saved"}<br /><small
                  >${this.sourceExpected[source.id] ? (source.available ? "Included" : "Needs configuration") : "Excluded from completeness"}${source.fetched_at ? ` · Updated ${new Date(source.fetched_at).toLocaleDateString()}` : ""}</small
                ></span
              >
              <div class="actions">
                <button
                  ?disabled=${!source.available || !this.sourceExpected[source.id] || this.busy || !!this.pending || this.expectationsChanged || !this.query.trim() || !this.validYear}
                  @click=${() => void this.inspect(source.id)}
                >
                  Inspect
                </button>
              </div>
            </div>`,
        )}
      </div>
      ${!this.visibleProviders.some((source) => source.available) ? html`<p class="muted">Configure a scraper in Settings first.</p>` : nothing}
    </section>`;
  }
  private historyPanel() {
    if (!this.options) return nothing;
    return html`<section class="manager-section" aria-label="Source history">
      <h3>Source History</h3>
      <div class="source-list">
        ${this.options.providers.map((source) => html`<div class="source-row" data-provider=${source.id}><strong>${source.label}</strong><span>${source.fetched_at ? `${source.fields ?? 0} fields saved` : "No saved metadata"}</span><small>${source.fetched_at ? `Last updated ${new Date(source.fetched_at).toLocaleString()}` : source.unavailable ? "No metadata expected" : "Not yet scraped"}</small></div>`)}
      </div>
    </section>`;
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
          event.preventDefault();
          this.close();
        }}
      >
        <div class="card-head manager-head">
          <div>
            <h2 id="scrape-title">Movie Metadata Manager</h2>
            <p>
              Search, scrape and reconcile
              metadata${this.artworkOnly ? " and artwork" : ""}.
            </p>
          </div>
          ${closeButton(() => this.close())}
        </div>
        ${this.error ? html`<p class="error" role="alert">${this.error}</p>` : nothing}
        ${this.busy ? html`<p role="status">${this.pending ? "Applying selected data…" : "Retrieving provider data…"}</p>` : nothing}
        ${this.currentMovie()} ${this.searchPanel()}
        ${
          this.options
            ? html`<div
                class="page-tabs manager-tabs"
                role="tablist"
                aria-label="Metadata manager sections"
                @keydown=${this.tabKey}
              >
                ${(["sources", "mapping", "history"] as const).map(
                  (view) =>
                    html`<button
                      role="tab"
                      aria-selected=${this.view === view}
                      tabindex=${this.view === view ? 0 : -1}
                      @click=${() => {
                        this.view = view;
                        this.requestUpdate();
                      }}
                    >
                      ${view === "sources" ? "Sources" : view === "mapping" ? "Field Mapping" : "History"}
                    </button>`,
                )}
              </div>`
            : nothing
        }
        ${
          this.view === "mapping" && this.review
            ? html`<section class="manager-section" aria-label="Field mapping">
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
                }${!this.review.images.length ? html`<p class="muted">${this.review.artwork_enabled ? "This provider returned no image choices." : "Enable Sync artwork in Settings to retrieve image choices."}</p>` : nothing}
              </section>`
            : this.view === "sources"
              ? this.sourcePanel()
              : this.view === "history"
                ? this.historyPanel()
                : html`<section class="manager-section">
                    <p class="muted">
                      Choose a source and Inspect it to compare fields and
                      images.
                    </p>
                  </section>`
        }
        <div class="dialog-footer manager-actions">
          <div class="actions">
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
                        this.candidatesPage = undefined;
                        this.view = "sources";
                        this.error = "";
                        this.requestUpdate();
                      }}
                    >
                      Change match / scraper
                    </button>`
                  : nothing
            }${
              this.review && this.view !== "mapping"
                ? html`<button
                    @click=${() => {
                      this.view = "mapping";
                      this.requestUpdate();
                    }}
                  >
                    Review Data
                  </button>`
                : nothing
            }<button
              class="primary"
              ?disabled=${this.busy || (!this.pending && !this.review && (!this.expectationsChanged || !this.options?.snapshot)) || (!!this.review && (this.artworkOnly || !this.review.matched) && !this.fields.size && !Object.keys(this.images).length)}
              @click=${() => this.apply()}
            >
              ${this.pending ? "Retry exact save" : "Save"}
            </button>
          </div>
        </div>
      </dialog>`;
  }
  private currentMovie() {
    const current = this.options?.current;
    const posterPresent =
      this.options?.artwork_present?.poster ?? !!current?.artwork_key;
    const backdropPresent =
      this.options?.artwork_present?.backdrop ?? !!current?.backdrop_key;
    const metadataComplete =
      this.options?.providers.every(
        (source) => !this.sourceExpected[source.id] || source.has_data === true,
      ) ?? true;
    return current
      ? html`<section
          class="manager-section current-movie"
          aria-label="Current Library movie"
        >
          <h3>
            Current Library Info <small class="muted">Existing record</small>
          </h3>
          <div class="current-layout">
            <div class="current-identity">
              <div class="current-poster">
                <kaleidescape-library-cover
                  .client=${this.client}
                  .scope=${this.scope}
                  .queue=${this.queue}
                  .artworkKey=${current.artwork_key}
                  .title=${current.title}
                ></kaleidescape-library-cover>
                <div class="expectation">
                  <label class="switch" title="Expect cover art for this movie"
                    ><input
                      type="checkbox"
                      aria-label="Expect cover art"
                      .checked=${this.artworkExpected.poster}
                      ?disabled=${this.busy || !!this.pending || !!this.review || !this.options?.snapshot}
                      @change=${(event: Event) => {
                        this.artworkExpected.poster = (
                          event.target as HTMLInputElement
                        ).checked;
                        this.requestUpdate();
                      }} /><span aria-hidden="true"></span></label
                  ><span>Cover</span>
                </div>
              </div>
              <div>
                <h3>${current.title}</h3>
                <p>
                  ${current.year ?? "Year unavailable"} ·
                  ${current.duration_seconds ? `${Math.round(current.duration_seconds / 60)} min` : "Runtime unavailable"}
                </p>
                <dl class="current-meta">
                  <dt>Edition</dt>
                  <dd>${current.edition || "Unavailable"}</dd>
                  <dt>Director</dt>
                  <dd>${current.directors.join(", ") || "Unavailable"}</dd>
                  <dt>Top cast</dt>
                  <dd>${current.actors.join(", ") || "Unavailable"}</dd>
                  <dt>Metadata updated</dt>
                  <dd>
                    ${current.metadata_synced_at ? new Date(current.metadata_synced_at).toLocaleDateString() : "Unavailable"}
                  </dd>
                </dl>
              </div>
            </div>
            <div class="current-backdrop">
              <kaleidescape-library-cover
                .client=${this.client}
                .scope=${this.scope}
                .queue=${this.queue}
                .artworkKey=${current.backdrop_key}
                .title=${`${current.title} backdrop`}
                .fit=${"contain"}
              ></kaleidescape-library-cover>
              <div class="expectation">
                <label class="switch" title="Expect backdrop art for this movie"
                  ><input
                    type="checkbox"
                    aria-label="Expect backdrop art"
                    .checked=${this.artworkExpected.backdrop}
                    ?disabled=${this.busy || !!this.pending || !!this.review || !this.options?.snapshot}
                    @change=${(event: Event) => {
                      this.artworkExpected.backdrop = (
                        event.target as HTMLInputElement
                      ).checked;
                      this.requestUpdate();
                    }} /><span aria-hidden="true"></span></label
                ><span>Backdrop</span>
              </div>
            </div>
            <div class="artwork-status">
              <h3>Scraping status</h3>
              ${this.statusLine("Artwork", !this.artworkExpected.poster || posterPresent)}
              ${this.statusLine("Backdrop", !this.artworkExpected.backdrop || backdropPresent)}
              ${this.statusLine("Metadata", metadataComplete)}
            </div>
          </div>
        </section>`
      : nothing;
  }
}
if (!customElements.get("kaleidescape-title-scrape"))
  customElements.define("kaleidescape-title-scrape", TitleScrape);
