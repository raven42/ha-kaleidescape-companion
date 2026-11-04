/** Per-movie metadata sources, field choices, and artwork editing. */
import { LitElement, css, html, nothing } from "lit";
import type { PropertyValues } from "lit";
import { ApiError, errorCode, errorMessage } from "../core/api";
import type {
  JournalClient,
  JournalInfo,
  PreparedMutation,
  ScrapeMatches,
  ScrapeOptions,
  ScrapeReview,
} from "../core/api";
import { styles } from "../ui/styles";
import { iconAction, iconActionStyles } from "../ui/action-icons";
import { closeButton, dismissBackdrop } from "../ui/dialog";
import { CoverQueue } from "../library/cover";
import "../library/cover";
import "./scrape-image";

type ArtworkKind = "poster" | "backdrop";

function providerLink(value: string | null | undefined) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.port &&
      !url.search &&
      !url.hash
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
}

export class TitleScrape extends LitElement {
  static properties = {
    client: { attribute: false },
    scope: { attribute: false },
    versionId: {},
    blocked: { type: Boolean },
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
        width: min(1180px, calc(100% - 24px));
        max-height: min(
          880px,
          calc(var(--companion-viewport-height, 100dvh) - 32px)
        );
        overflow-y: auto;
      }
      dialog.inset-dialog:modal,
      dialog.choice-dialog:modal {
        inset-block-start: calc(
          var(--companion-viewport-top, 0px) +
            var(--companion-viewport-height, 100dvh) * 0.5
        );
        transform: translateY(-50%);
      }
      dialog.choice-dialog {
        width: min(650px, calc(100% - 24px));
        max-height: min(700px, calc(100dvh - 32px));
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
        grid-template-columns: minmax(0, 1.25fr) minmax(200px, 0.85fr) minmax(
            145px,
            0.7fr
          );
        gap: 14px;
        align-items: stretch;
      }
      .current-identity {
        display: grid;
        grid-template-columns: 84px minmax(0, 1fr);
        gap: 12px;
        min-width: 0;
      }
      .current-identity kaleidescape-library-cover {
        width: 84px;
        height: 126px;
        aspect-ratio: 2/3;
        border-radius: 8px;
      }
      .current-backdrop {
        position: relative;
        padding-inline: 14px;
        min-width: 0;
      }
      .current-backdrop::before,
      .current-backdrop::after {
        content: "";
        position: absolute;
        top: 0;
        height: 100%;
        width: 1px;
        background: var(--line);
      }
      .current-backdrop::before {
        left: 0;
      }
      .current-backdrop::after {
        right: 0;
      }
      .current-backdrop kaleidescape-library-cover {
        width: 100%;
        max-width: 224px;
        height: 126px;
        aspect-ratio: 16/9;
        border-radius: 8px;
      }
      .movie-title {
        font-size: 20px;
        line-height: 1.2;
        margin: 0 0 6px;
        overflow-wrap: anywhere;
      }
      .current-meta {
        margin: 6px 0 0;
        display: grid;
        grid-template-columns: auto 1fr;
        gap: 4px 10px;
        font-size: 12px;
      }
      .current-meta dt {
        color: var(--muted);
      }
      .current-meta dd {
        margin: 0;
        overflow-wrap: anywhere;
      }
      .image-links,
      .status-line {
        display: flex;
        align-items: center;
        gap: 7px;
        margin-top: 4px;
        font-size: 11px;
      }
      .image-links {
        flex-wrap: wrap;
      }
      .image-links button {
        min-height: unset;
        padding: 0;
        font-size: 11px;
      }
      .text-link {
        background: none;
        border: 0;
        color: var(--accent);
        text-decoration: underline;
        cursor: pointer;
      }
      .artwork-flags {
        grid-column: 1 / 3;
        display: grid;
        grid-template-columns: minmax(0, 1.25fr) minmax(200px, 0.85fr);
        gap: 14px;
        align-items: center;
      }
      .artwork-flags .check {
        margin: 0;
      }
      .status-line[data-complete="true"] span {
        color: var(--success-color, #4caf50);
      }
      .status-line[data-complete="false"] span {
        color: var(--warning-color, #e2a600);
      }
      .switch {
        position: relative;
        display: inline-flex;
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
          38px minmax(120px, 1fr) minmax(160px, 1.4fr)
          auto;
        gap: 10px;
        align-items: center;
        border: 1px solid var(--line);
        border-radius: 8px;
        padding: 10px;
      }
      .source-row small,
      .muted {
        color: var(--muted);
      }
      .source-name {
        display: flex;
        flex-wrap: wrap;
        align-items: baseline;
        gap: 6px 10px;
      }
      .source-name a {
        color: var(--accent);
        font-size: 12px;
      }
      .source-row button {
        min-height: 36px;
      }
      .match-search {
        display: flex;
        align-items: end;
        gap: 8px;
      }
      .match-search label:first-child {
        flex: 1;
        min-width: 0;
      }
      .match-search .year-field {
        width: 110px;
      }
      .manager-tabs {
        margin-top: 12px;
      }
      .manager-actions {
        justify-content: flex-end;
      }
      .mapping-scroll {
        overflow-x: auto;
      }
      .mapping-table {
        border-collapse: collapse;
        width: max-content;
        min-width: 100%;
        table-layout: fixed;
        font-size: 12px;
      }
      .mapping-table .field-column {
        width: 155px;
      }
      .mapping-table .source-column {
        width: 220px;
      }
      .mapping-table th,
      .mapping-table td {
        border: 1px solid var(--line);
        padding: 8px;
        text-align: left;
        vertical-align: top;
        min-width: 115px;
      }
      .mapping-table th:first-child {
        min-width: 125px;
      }
      .mapping-table thead th {
        background: var(--card-background-color, transparent);
      }
      .mapping-table label {
        display: flex;
        align-items: start;
        gap: 5px;
        cursor: pointer;
      }
      .mapping-table input {
        flex: none;
      }
      .mapping-table input[type="radio"],
      .image-grid input[type="radio"] {
        appearance: none;
        width: 14px;
        height: 14px;
        min-width: 14px;
        min-height: 14px;
        margin: 2px 0;
        padding: 0;
        border: 1px solid var(--secondary-text-color, #888);
        border-radius: 50%;
        background: transparent;
      }
      .mapping-table input[type="radio"]:checked,
      .image-grid input[type="radio"]:checked {
        border: 4px solid var(--accent);
      }
      .mapping-table input[type="radio"]:focus-visible,
      .image-grid input[type="radio"]:focus-visible {
        outline: 2px solid var(--accent);
        outline-offset: 2px;
      }
      .mapping-value {
        overflow-wrap: anywhere;
        white-space: pre-wrap;
        max-height: 100px;
        overflow-y: auto;
        display: block;
      }
      .history-list {
        display: grid;
        gap: 12px;
      }
      .history-entry {
        border: 1px solid var(--line);
        border-radius: 8px;
        padding: 12px;
      }
      .history-head {
        display: grid;
        grid-template-columns: minmax(0, 1.4fr) minmax(180px, 1fr) auto;
        align-items: baseline;
        gap: 12px;
        padding-bottom: 8px;
        border-bottom: 1px solid var(--line);
      }
      .history-head time,
      .history-outcome {
        color: var(--muted);
        font-size: 12px;
      }
      .history-values {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px 18px;
        padding-top: 10px;
      }
      .history-value {
        display: grid;
        grid-template-columns: minmax(95px, 0.4fr) minmax(0, 1fr);
        gap: 8px;
        min-width: 0;
        font-size: 12px;
      }
      .history-value > :last-child {
        overflow-wrap: anywhere;
        white-space: pre-wrap;
      }
      .match-list,
      .image-grid {
        display: grid;
        gap: 10px;
      }
      .match-card {
        display: grid;
        grid-template-columns: 64px minmax(0, 1fr);
        gap: 12px;
        padding: 10px;
        border: 1px solid var(--line);
        border-radius: 8px;
      }
      .match-card h3 {
        margin: 0 0 5px;
        font-size: 16px;
      }
      .match-card p {
        margin: 4px 0;
        font-size: 12px;
      }
      .match-card kaleidescape-scrape-image {
        width: 64px;
        height: 96px;
      }
      .image-grid {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }
      .image-grid label {
        border: 1px solid var(--line);
        border-radius: 8px;
        padding: 6px;
      }
      .image-grid label:has(input:checked) {
        border-color: var(--accent);
      }
      .image-grid kaleidescape-scrape-image {
        display: block;
        width: 100%;
        aspect-ratio: 2/3;
      }
      .image-grid[data-kind="backdrop"] kaleidescape-scrape-image {
        aspect-ratio: 16/9;
      }
      .image-grid small {
        font-size: 11px;
      }
      .image-grid input[type="radio"] {
        vertical-align: middle;
        margin: 6px 5px 2px 0;
      }
      @media (max-width: 750px) {
        dialog.inset-dialog {
          width: min(980px, calc(100% - 24px));
        }
        .current-layout {
          grid-template-columns: minmax(0, 1fr) minmax(180px, 0.8fr);
        }
        .artwork-status {
          grid-column: 1 / -1;
        }
        .source-row {
          grid-template-columns: 38px minmax(0, 1fr) auto;
        }
        .source-detail {
          grid-column: 2 / -1;
        }
      }
      @media (max-width: 540px) {
        .current-layout {
          grid-template-columns: 1fr;
        }
        .current-backdrop {
          padding: 0;
        }
        .current-backdrop::before,
        .current-backdrop::after {
          display: none;
        }
        .artwork-flags {
          grid-column: 1;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }
        .history-head,
        .history-values {
          grid-template-columns: 1fr;
        }
        .source-row {
          grid-template-columns: 38px minmax(0, 1fr);
        }
        .source-row button {
          grid-column: 2;
          justify-self: start;
        }
        .match-search {
          flex-wrap: wrap;
        }
        .image-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }
    `,
  ];
  client?: JournalClient;
  scope?: JournalInfo;
  versionId = "";
  blocked = false;
  private options?: ScrapeOptions;
  private review?: ScrapeReview;
  private candidatePage?: ScrapeMatches;
  private matchMode: "refresh" | "image" = "refresh";
  private matchProvider = "";
  private query = "";
  private year = "";
  private sourceExpected: Record<string, boolean> = {};
  private artworkExpected: Record<ArtworkKind, boolean> = {
    poster: true,
    backdrop: true,
  };
  private fieldSources: Record<string, string> = {};
  private initialSources: Record<string, string> = {};
  private mappingTouched = false;
  private imageKind?: ArtworkKind;
  private imageChoice = "";
  private imagePage = 0;
  private busy = false;
  private pending?: PreparedMutation;
  private imagePending?: PreparedMutation;
  private resetPending?: PreparedMutation;
  private error = "";
  private generation = 0;
  private view: "sources" | "mapping" | "history" = "sources";
  private queue = new CoverQueue();
  private get writePending() {
    return !!(this.pending || this.imagePending || this.resetPending);
  }

  protected willUpdate(changed: PropertyValues) {
    if (["client", "scope", "versionId"].some((key) => changed.has(key)))
      this.reset();
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    this.reset();
  }
  private mainDialog() {
    return this.renderRoot.querySelector<HTMLDialogElement>(".inset-dialog");
  }
  private choiceDialog() {
    return this.renderRoot.querySelector<HTMLDialogElement>(".choice-dialog");
  }
  private lock() {
    this.dispatchEvent(
      new CustomEvent("scrape-lock", {
        detail: this.writePending,
        bubbles: true,
        composed: true,
      }),
    );
  }
  private reset() {
    this.generation++;
    this.mainDialog()?.close();
    this.choiceDialog()?.close();
    this.options = this.review = undefined;
    this.candidatePage = undefined;
    this.query = this.year = this.matchProvider = this.imageChoice = "";
    this.sourceExpected = {};
    this.artworkExpected = { poster: true, backdrop: true };
    this.fieldSources = {};
    this.initialSources = {};
    this.mappingTouched = false;
    this.imageKind = undefined;
    this.imagePage = 0;
    this.pending = undefined;
    this.imagePending = undefined;
    this.resetPending = undefined;
    this.busy = false;
    this.error = "";
    this.view = "sources";
    this.queue.cache.dispose();
    this.queue = new CoverQueue();
    this.lock();
  }
  private close() {
    if (this.pending || this.imagePending || this.resetPending || this.busy)
      return;
    if (this.candidatePage && this.client && this.scope)
      void this.client
        .cancelTitleScrape(this.scope, this.candidatePage.search_id)
        .catch(() => {});
    if (this.review && this.client && this.scope)
      void this.client
        .cancelTitleScrape(this.scope, this.review.plan_id)
        .catch(() => {});
    this.reset();
    this.requestUpdate();
  }
  private closeChoice(force = false) {
    if (!force && (this.imagePending || this.busy)) return;
    if (this.candidatePage && this.client && this.scope)
      void this.client
        .cancelTitleScrape(this.scope, this.candidatePage.search_id)
        .catch(() => {});
    if (this.review && this.client && this.scope)
      void this.client
        .cancelTitleScrape(this.scope, this.review.plan_id)
        .catch(() => {});
    this.choiceDialog()?.close();
    this.candidatePage = undefined;
    this.imageKind = undefined;
    this.imageChoice = "";
    this.requestUpdate();
  }
  private async loadOptions(resetDraft = false) {
    if (!this.client || !this.scope) return;
    const options = await this.client.titleScrapeOptions(
      this.scope,
      this.versionId,
    );
    this.options = options;
    if (resetDraft || !this.mappingTouched) {
      this.fieldSources = Object.fromEntries(
        (options.field_mapping ?? []).map((field) => [
          field.field,
          field.selected,
        ]),
      );
      this.initialSources = { ...this.fieldSources };
    }
    if (resetDraft) {
      this.query = options.search_title ?? options.title ?? "";
      this.year = options.current?.year ? String(options.current.year) : "";
      this.sourceExpected = Object.fromEntries(
        options.providers.map((source) => [source.id, !source.unavailable]),
      );
      this.artworkExpected = {
        poster: !options.artwork_unavailable?.includes("poster"),
        backdrop: !options.artwork_unavailable?.includes("backdrop"),
      };
      this.mappingTouched = false;
    }
  }
  private async open() {
    if (!this.client || !this.scope?.permissions.edit || this.blocked) return;
    this.reset();
    this.busy = true;
    this.requestUpdate();
    await this.updateComplete;
    this.mainDialog()?.showModal();
    const generation = this.generation;
    try {
      await this.loadOptions(true);
    } catch (error) {
      if (generation === this.generation) this.report(error);
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
  private changedExpectations() {
    return (
      !!this.options &&
      (this.options.providers.some(
        (row) => this.sourceExpected[row.id] !== !row.unavailable,
      ) ||
        (["poster", "backdrop"] as const).some(
          (kind) =>
            this.artworkExpected[kind] !==
            !this.options!.artwork_unavailable?.includes(kind),
        ))
    );
  }
  private validYear() {
    return (
      !this.year.trim() ||
      (Number.isInteger(Number(this.year)) &&
        Number(this.year) >= 1800 &&
        Number(this.year) <= 2100)
    );
  }
  private emitChange() {
    this.dispatchEvent(
      new CustomEvent("metadata-changed", { bubbles: true, composed: true }),
    );
  }
  private async refresh(provider: string) {
    if (
      !this.client ||
      !this.scope ||
      !this.options ||
      !this.sourceExpected[provider] ||
      this.changedExpectations() ||
      this.mappingTouched ||
      this.busy ||
      this.writePending ||
      !this.query.trim() ||
      !this.validYear()
    )
      return;
    this.busy = true;
    this.error = "";
    this.requestUpdate();
    const generation = this.generation;
    try {
      const result = await this.client.titleScrapeRefresh(
        this.scope,
        this.versionId,
        provider,
        this.query,
        this.year.trim() ? Number(this.year) : undefined,
      );
      if (generation !== this.generation) return;
      if (result.outcome === "matches") {
        this.candidatePage = result;
        this.matchMode = "refresh";
        this.matchProvider = provider;
        this.requestUpdate();
        await this.updateComplete;
        this.choiceDialog()?.showModal();
      } else {
        await this.loadOptions();
        this.emitChange();
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
  private async useMatch(choice: string) {
    if (!this.client || !this.scope || !this.candidatePage || this.busy) return;
    const generation = this.generation;
    this.busy = true;
    this.error = "";
    this.requestUpdate();
    try {
      if (this.matchMode === "refresh") {
        await this.client.titleScrapeRefreshChoice(
          this.scope,
          this.versionId,
          this.matchProvider,
          this.candidatePage.search_id,
          choice,
        );
        if (generation !== this.generation) return;
        this.closeChoice(true);
        await this.loadOptions();
        this.emitChange();
      } else {
        const review = await this.client.titleScrapePreview(
          this.scope,
          this.versionId,
          "tmdb",
          this.candidatePage.search_id,
          choice,
        );
        if (generation !== this.generation) return;
        if ("search_id" in review) throw new ApiError("refresh_required");
        this.review = review;
        this.candidatePage = undefined;
        this.imageChoice = "";
        this.requestUpdate();
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
  private async editImage(kind: ArtworkKind) {
    if (
      !this.client ||
      !this.scope ||
      this.busy ||
      this.writePending ||
      this.mappingTouched ||
      this.changedExpectations()
    )
      return;
    this.busy = true;
    this.error = "";
    this.imageKind = kind;
    this.requestUpdate();
    const generation = this.generation;
    try {
      const result = await this.client.titleScrapePreview(
        this.scope,
        this.versionId,
        "tmdb",
      );
      if (generation !== this.generation) return;
      this.imageChoice = "";
      this.imagePage = 0;
      if ("search_id" in result) {
        this.candidatePage = result;
        this.matchMode = "image";
        this.matchProvider = "tmdb";
      } else {
        this.review = result;
      }
      this.requestUpdate();
      await this.updateComplete;
      this.choiceDialog()?.showModal();
    } catch (error) {
      if (generation === this.generation) {
        this.imageKind = undefined;
        this.report(error);
      }
    } finally {
      if (generation === this.generation) {
        this.busy = false;
        this.requestUpdate();
      }
    }
  }
  private async useImage() {
    if (
      !this.client ||
      !this.scope ||
      !this.review ||
      !this.imageKind ||
      !this.imageChoice ||
      this.busy
    )
      return;
    this.busy = true;
    this.error = "";
    this.requestUpdate();
    const generation = this.generation;
    try {
      this.imagePending ??= this.client.prepareTitleScrape(this.scope, {
        plan_id: this.review.plan_id,
        fields: [],
        images: { [this.imageKind]: this.imageChoice },
        save_match: true,
      });
      this.lock();
      await this.client.applyTitleScrape(this.imagePending);
      if (generation !== this.generation) return;
      this.imagePending = undefined;
      this.lock();
      this.closeChoice(true);
      this.review = undefined;
      await this.loadOptions();
      this.emitChange();
    } catch (error) {
      if (generation === this.generation) {
        this.report(error);
        if (
          ["invalid_request", "refresh_required", "not_found"].includes(
            errorCode(error),
          )
        ) {
          this.imagePending = undefined;
          this.lock();
        }
      }
    } finally {
      if (generation === this.generation) {
        this.busy = false;
        this.requestUpdate();
      }
    }
  }
  private async resetCover() {
    if (
      !this.client ||
      !this.scope ||
      !this.options?.snapshot ||
      this.busy ||
      this.pending ||
      this.imagePending ||
      this.mappingTouched ||
      this.changedExpectations()
    )
      return;
    this.busy = true;
    this.error = "";
    const generation = this.generation;
    try {
      this.resetPending ??= this.client.prepareMetadataAction(this.scope, {
        action: "reset_cover",
        title_id: this.versionId,
        snapshot: this.options.snapshot,
      });
      this.lock();
      await this.client.applyTitleScrape(this.resetPending);
      if (generation !== this.generation) return;
      this.resetPending = undefined;
      this.lock();
      await this.loadOptions();
      this.emitChange();
    } catch (error) {
      if (generation === this.generation) {
        this.report(error);
        if (
          ["invalid_request", "refresh_required", "not_found"].includes(
            errorCode(error),
          )
        ) {
          this.resetPending = undefined;
          this.lock();
        }
      }
    } finally {
      if (generation === this.generation) {
        this.busy = false;
        this.requestUpdate();
      }
    }
  }
  private async save() {
    if (
      !this.client ||
      !this.scope ||
      !this.options?.snapshot ||
      this.busy ||
      this.resetPending ||
      this.imagePending ||
      (!this.changedExpectations() && !this.mappingTouched && !this.pending)
    )
      return;
    this.busy = true;
    this.error = "";
    this.requestUpdate();
    const generation = this.generation;
    try {
      if (this.changedExpectations()) {
        this.pending ??= this.client.prepareScrapeExpectations(this.scope, {
          title_id: this.versionId,
          snapshot: this.options.snapshot,
          providers: this.sourceExpected,
          artwork: this.artworkExpected,
        });
        this.lock();
        await this.client.applyTitleScrape(this.pending);
        if (generation !== this.generation) return;
        this.pending = undefined;
        this.lock();
        await this.loadOptions();
      }
      if (this.mappingTouched) {
        const sources = Object.fromEntries(
          (this.options!.field_mapping ?? [])
            .filter(
              (field) =>
                field.override ||
                this.fieldSources[field.field] !==
                  this.initialSources[field.field],
            )
            .map((field) => [field.field, this.fieldSources[field.field]]),
        );
        this.pending ??= this.client.prepareMetadataAction(this.scope, {
          action: "mapping",
          title_id: this.versionId,
          snapshot: this.options!.snapshot,
          sources,
        });
        this.lock();
        await this.client.applyTitleScrape(this.pending);
        if (generation !== this.generation) return;
        this.pending = undefined;
        this.lock();
      }
      this.emitChange();
      this.reset();
      this.requestUpdate();
    } catch (error) {
      if (generation === this.generation) {
        this.report(error);
        if (
          ["invalid_request", "refresh_required", "metadata_disabled"].includes(
            errorCode(error),
          )
        ) {
          this.pending = undefined;
          this.lock();
        }
      }
    } finally {
      if (generation === this.generation) {
        this.busy = false;
        this.requestUpdate();
      }
    }
  }
  private status(label: string, complete: boolean) {
    return html`<p class="status-line" data-complete=${complete}>
      <span aria-hidden="true">${complete ? "✓" : "⚠"}</span>${label}:
      ${complete ? "Complete" : "Missing"}
    </p>`;
  }
  private switchFor(
    label: string,
    checked: boolean,
    set: (value: boolean) => void,
  ) {
    return html`<label class="switch" title=${label}
      ><input
        type="checkbox"
        aria-label=${label}
        .checked=${checked}
        ?disabled=${this.busy || this.writePending || !this.options?.snapshot}
        @change=${(event: Event) => {
          set((event.target as HTMLInputElement).checked);
          this.requestUpdate();
        }} /><span aria-hidden="true"></span
    ></label>`;
  }
  private currentMovie() {
    const current = this.options?.current;
    if (!current) return nothing;
    const poster =
      this.options?.artwork_present?.poster ?? !!current.artwork_key;
    const backdrop =
      this.options?.artwork_present?.backdrop ?? !!current.backdrop_key;
    const metadata =
      this.options?.providers.every(
        (source) => !this.sourceExpected[source.id] || source.has_data,
      ) ?? true;
    const tmdb = this.options?.providers.some(
      (source) => source.id === "tmdb" && source.available,
    );
    return html`<section
      class="manager-section"
      aria-label="Current Library movie"
    >
      <h3>Current Library Info <small class="muted">Existing record</small></h3>
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
            <div class="image-links">
              ${tmdb && this.options?.artwork_enabled ? html`<button class="text-link" ?disabled=${this.busy || this.writePending || this.mappingTouched || this.changedExpectations()} @click=${() => void this.editImage("poster")}>Edit</button>` : nothing}
              ${current.original_artwork_key ? html`<button class="text-link" ?disabled=${this.busy || !!this.pending || !!this.imagePending || this.mappingTouched || this.changedExpectations()} @click=${() => void this.resetCover()}>${this.resetPending ? "Retry reset" : "Reset"}</button>` : nothing}
            </div>
          </div>
          <div>
            <h2 class="movie-title">${current.title}</h2>
            <p>
              ${current.year ?? "Year unavailable"} ·
              ${current.duration_seconds ? `${Math.round(current.duration_seconds / 60)} min` : "Runtime unavailable"}
            </p>
            <dl class="current-meta">
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
          ${tmdb && this.options?.artwork_enabled ? html`<div class="image-links"><button class="text-link" ?disabled=${this.busy || this.writePending || this.mappingTouched || this.changedExpectations()} @click=${() => void this.editImage("backdrop")}>Edit</button></div>` : nothing}
        </div>
        <div class="artwork-status">
          <h3>Scraping status</h3>
          ${this.status("Artwork", !this.artworkExpected.poster || poster)}
          ${this.status("Backdrop", !this.artworkExpected.backdrop || backdrop)}
          ${this.status("Metadata", metadata)}
        </div>
        <div
          class="artwork-flags"
          aria-label="Artwork availability declarations"
        >
          <label class="check">
            <input
              type="checkbox"
              aria-label="Cover art unavailable"
              .checked=${!this.artworkExpected.poster}
              ?disabled=${this.busy || this.writePending || !this.options?.snapshot}
              @change=${(event: Event) => {
                this.artworkExpected.poster = !(
                  event.target as HTMLInputElement
                ).checked;
                this.requestUpdate();
              }}
            />
            Cover art unavailable
          </label>
          <label class="check">
            <input
              type="checkbox"
              aria-label="Backdrop art unavailable"
              .checked=${!this.artworkExpected.backdrop}
              ?disabled=${this.busy || this.writePending || !this.options?.snapshot}
              @change=${(event: Event) => {
                this.artworkExpected.backdrop = !(
                  event.target as HTMLInputElement
                ).checked;
                this.requestUpdate();
              }}
            />
            Backdrop art unavailable
          </label>
        </div>
      </div>
    </section>`;
  }
  private sourcesPanel() {
    if (!this.options) return nothing;
    return html`<section class="manager-section" aria-label="Scraper sources">
      <h3>Scraper Sources</h3>
      <p class="muted">
        Refresh searches this source using the title and year above. A unique
        match is downloaded automatically. Save changed switches or field
        choices before refreshing.
      </p>
      <div class="source-list">
        ${this.options.providers.map(
          (source) =>
            html`<div class="source-row" data-provider=${source.id}>
              ${this.switchFor(
                `Use ${source.label} for this movie`,
                this.sourceExpected[source.id] ?? false,
                (value) => {
                  this.sourceExpected = {
                    ...this.sourceExpected,
                    [source.id]: value,
                  };
                },
              )}
              <div class="source-name">
                <strong>${source.label}</strong>
                ${providerLink(source.match_url) ? html`<a href=${providerLink(source.match_url)!} target="_blank" rel="noopener noreferrer" aria-label=${`View ${source.label} match`}>View match</a>` : nothing}
              </div>
              <span class="source-detail">
                ${
                  source.has_data
                    ? source.fetched_at
                      ? `Downloaded - Updated ${new Date(source.fetched_at).toLocaleDateString()}`
                      : "Downloaded - Update date unavailable"
                    : source.checked_at
                      ? `No data available - Last Checked ${new Date(source.checked_at).toLocaleDateString()}`
                      : "Not yet scanned"
                }
                <br /><small
                  >${source.has_data ? `${source.fields ?? 0} fields saved · ` : ""}${this.sourceExpected[source.id] ? (source.available ? "Included" : "Needs configuration") : "Excluded from completeness"}</small
                >
              </span>
              <button
                ?disabled=${!source.available || !this.sourceExpected[source.id] || this.busy || this.writePending || this.mappingTouched || this.changedExpectations() || !this.query.trim() || !this.validYear()}
                @click=${() => void this.refresh(source.id)}
              >
                Refresh
              </button>
            </div>`,
        )}
      </div>
    </section>`;
  }
  private formatted(value: unknown) {
    if (
      value === null ||
      value === undefined ||
      value === "" ||
      (Array.isArray(value) && !value.length)
    )
      return "—";
    if (Array.isArray(value)) return value.join(", ");
    return String(value);
  }
  private fieldLabel(field: string) {
    return (
      this.options?.field_mapping?.find((item) => item.field === field)
        ?.label ??
      field.replaceAll("_", " ").replace(/^./, (first) => first.toUpperCase())
    );
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
  private mappingPanel() {
    if (!this.options) return nothing;
    return html`<section class="manager-section" aria-label="Field mapping">
      <h3>Field Mapping</h3>
      <p class="muted">
        Select the source whose value should appear in the Library for each
        field. Raw Library values come from the server scan. Automatic settings
        may combine credits until a source is saved for that field.
      </p>
      <div class="mapping-scroll">
        <table class="mapping-table">
          <colgroup>
            <col class="field-column" />
            <col class="source-column" />
            ${this.options.providers.map(() => html`<col class="source-column" />`)}
          </colgroup>
          <thead>
            <tr>
              <th scope="col">Field</th>
              <th scope="col">Raw Library</th>
              ${this.options.providers.map((source) => html`<th scope="col">${source.label}</th>`)}
            </tr>
          </thead>
          <tbody>
            ${(this.options.field_mapping ?? []).map(
              (field) =>
                html`<tr>
                  <th scope="row">${field.label}</th>
                  ${[
                    "original",
                    ...this.options!.providers.map((source) => source.id),
                  ].map((source) => {
                    const value = field.values[source];
                    const available =
                      value !== null &&
                      value !== undefined &&
                      value !== "" &&
                      (!Array.isArray(value) || value.length > 0);
                    return html`<td>
                      <label
                        ><input
                          type="radio"
                          name=${`field-${field.field}`}
                          aria-label=${`Use ${source === "original" ? "Raw Library" : this.options!.providers.find((row) => row.id === source)?.label} for ${field.label}`}
                          .checked=${this.fieldSources[field.field] === source}
                          ?disabled=${this.busy || this.writePending || !available || !(source in field.values)}
                          @change=${() => {
                            this.fieldSources = {
                              ...this.fieldSources,
                              [field.field]: source,
                            };
                            this.mappingTouched = true;
                            this.requestUpdate();
                          }}
                        />
                        <span class="mapping-value"
                          >${this.formatted(value)}</span
                        ></label
                      >
                    </td>`;
                  })}
                </tr>`,
            )}
          </tbody>
        </table>
      </div>
    </section>`;
  }
  private historyPanel() {
    if (!this.options) return nothing;
    return html`<section class="manager-section" aria-label="Source history">
      <h3>Source History</h3>
      ${
        this.options.history?.length
          ? html`<div class="history-list">
              ${this.options.history.map((entry) => {
                const provider = this.options!.providers.find(
                  (row) => row.id === entry.provider,
                );
                const values = Object.entries(entry.values);
                return html`<article class="history-entry">
                  <div class="history-head">
                    <strong>${provider?.label ?? entry.provider}</strong>
                    <time datetime=${entry.checked_at}
                      >${new Date(entry.checked_at).toLocaleString()}</time
                    >
                    <span class="history-outcome"
                      >${entry.outcome === "downloaded" ? `${values.length} values saved` : "No data available"}</span
                    >
                  </div>
                  ${
                    values.length
                      ? html`<div class="history-values">
                          ${values.map(([field, value]) => html`<div class="history-value"><strong>${this.fieldLabel(field)}</strong><span>${this.formatted(value)}</span></div>`)}
                        </div>`
                      : html`<p class="muted">
                          No provider values were returned for this check.
                        </p>`
                  }
                </article>`;
              })}
            </div>`
          : html`<p class="muted">No provider history is available yet.</p>`
      }
    </section>`;
  }
  private searchPanel() {
    if (!this.options) return nothing;
    return html`<section class="manager-section" aria-label="Search and match">
      <h3>Search &amp; Match</h3>
      <div class="match-search">
        <label
          >Title search<input
            type="search"
            maxlength="200"
            .value=${this.query}
            ?disabled=${this.busy || this.writePending}
            @input=${(event: Event) => {
              this.query = (event.target as HTMLInputElement).value;
              this.requestUpdate();
            }}
        /></label>
        <label class="year-field"
          >Release year<input
            type="number"
            min="1800"
            max="2100"
            step="1"
            .value=${this.year}
            ?disabled=${this.busy || this.writePending}
            @input=${(event: Event) => {
              this.year = (event.target as HTMLInputElement).value;
              this.requestUpdate();
            }}
        /></label>
      </div>
    </section>`;
  }
  private choiceContent() {
    if (this.candidatePage)
      return html`<div>
        <div class="card-head">
          <h2 id="choice-title">Choose a movie match</h2>
          ${closeButton(() => this.closeChoice(), this.busy)}
        </div>
        <p>
          Current Library movie:
          <strong>${this.options?.current?.title}</strong>
          (${this.options?.current?.year ?? "year unavailable"})
        </p>
        <p class="muted">
          Select the matching result to download its metadata.
        </p>
        ${!this.candidatePage.candidates.length ? html`<p>No matching movies were found. Try Refresh with another title or year.</p>` : nothing}
        <div class="match-list">
          ${this.candidatePage.candidates.map(
            (candidate) =>
              html`<article class="match-card">
                ${candidate.has_artwork ? html`<kaleidescape-scrape-image .client=${this.client} .scope=${this.scope} .queue=${this.queue} .plan=${this.candidatePage!.search_id} .choice=${candidate.id}></kaleidescape-scrape-image>` : html`<div class="muted">No cover</div>`}
                <div>
                  <h3>${candidate.title} (${candidate.year})</h3>
                  <p>
                    Director: ${candidate.directors.join(", ") || "Unavailable"}
                  </p>
                  <p>Cast: ${candidate.actors.join(", ") || "Unavailable"}</p>
                  <button
                    ?disabled=${this.busy}
                    @click=${() => void this.useMatch(candidate.id)}
                  >
                    Use this match
                  </button>
                </div>
              </article>`,
          )}
        </div>
      </div>`;
    if (!this.review || !this.imageKind) return nothing;
    const images = this.review.images.filter(
      (image) => image.kind === this.imageKind,
    );
    const start = this.imagePage * 6;
    return html`<div>
      <div class="card-head">
        <h2 id="choice-title">
          Choose ${this.imageKind === "poster" ? "cover art" : "backdrop art"}
        </h2>
        ${closeButton(() => this.closeChoice(), this.busy || !!this.imagePending)}
      </div>
      <p class="muted">
        Images from TMDB for
        ${this.review.matched?.title ?? this.options?.title}.
      </p>
      ${!images.length ? html`<p>No images available from TMDB.</p>` : nothing}
      <div class="image-grid" data-kind=${this.imageKind}>
        ${images.slice(start, start + 6).map(
          (image, index) =>
            html`<label>
              <kaleidescape-scrape-image
                .client=${this.client}
                .scope=${this.scope}
                .queue=${this.queue}
                .plan=${this.review!.plan_id}
                .choice=${image.id}
              ></kaleidescape-scrape-image>
              <input
                type="radio"
                name="artwork-choice"
                .checked=${this.imageChoice === image.id}
                ?disabled=${!!this.imagePending}
                @change=${() => {
                  this.imageChoice = image.id;
                  this.requestUpdate();
                }}
              />
              ${this.imageKind === "poster" ? "Cover" : "Backdrop"}
              ${start + index + 1}
              <small>${image.width ?? "?"} × ${image.height ?? "?"}</small>
            </label>`,
        )}
      </div>
      ${
        images.length > 6
          ? html`<div class="actions">
              <button
                ?disabled=${!start}
                @click=${() => {
                  this.imagePage--;
                  this.requestUpdate();
                }}
              >
                Previous
              </button>
              <button
                ?disabled=${start + 6 >= images.length}
                @click=${() => {
                  this.imagePage++;
                  this.requestUpdate();
                }}
              >
                Next
              </button>
            </div>`
          : nothing
      }
      <div class="dialog-footer manager-actions">
        ${
          this.imagePending
            ? html`<button
                ?disabled=${this.busy}
                @click=${() => {
                  if (
                    window.confirm(
                      "Inspect the Library before discarding an unconfirmed image save. Discard retry?",
                    )
                  ) {
                    this.imagePending = undefined;
                    this.lock();
                    this.requestUpdate();
                  }
                }}
              >
                Discard retry
              </button>`
            : nothing
        }
        <button
          class="primary"
          ?disabled=${!this.imageChoice || this.busy}
          @click=${() => void this.useImage()}
        >
          ${this.imagePending ? "Retry exact image save" : "Use image"}
        </button>
      </div>
    </div>`;
  }
  protected render() {
    if (!this.scope?.permissions.edit) return nothing;
    return html`${iconAction("Scrape title", "scrape", this.blocked || this.writePending, () => void this.open(), "scrape-button")}
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
            <p>Search, scrape and reconcile metadata.</p>
          </div>
          ${closeButton(() => this.close(), this.busy || this.writePending)}
        </div>
        ${this.error ? html`<p class="error" role="alert">${this.error}</p>` : nothing}
        ${this.busy ? html`<p role="status">Updating movie metadata…</p>` : nothing}
        ${this.currentMovie()}${this.searchPanel()}
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
        ${this.view === "sources" ? this.sourcesPanel() : this.view === "mapping" ? this.mappingPanel() : this.historyPanel()}
        <div class="dialog-footer manager-actions">
          ${
            this.pending || this.resetPending
              ? html`<button
                  @click=${() => {
                    if (
                      window.confirm(
                        "Inspect the Library before discarding an unconfirmed save. Discard retry?",
                      )
                    ) {
                      this.pending = undefined;
                      this.resetPending = undefined;
                      this.lock();
                      this.requestUpdate();
                    }
                  }}
                >
                  Discard retry
                </button>`
              : nothing
          }
          <button
            class="primary"
            ?disabled=${this.busy || !!this.resetPending || !!this.imagePending || (!this.pending && !this.changedExpectations() && !this.mappingTouched)}
            @click=${() => void this.save()}
          >
            ${this.pending ? "Retry exact save" : "Save"}
          </button>
        </div>
      </dialog>
      <dialog
        data-admin-dialog
        class="choice-dialog"
        aria-labelledby="choice-title"
        @click=${dismissBackdrop}
        @cancel=${(event: Event) => {
          event.preventDefault();
          if (!this.busy) this.closeChoice();
        }}
      >
        ${this.choiceContent()}
      </dialog>`;
  }
}
if (!customElements.get("kaleidescape-title-scrape"))
  customElements.define("kaleidescape-title-scrape", TitleScrape);
