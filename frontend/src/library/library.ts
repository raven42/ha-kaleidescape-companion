/** Read-only, locally cached library browsing; networking to devices stays in HA. */
import { LitElement, html, nothing } from "lit";
import { live } from "lit/directives/live.js";
import type { PropertyValues } from "lit";
import { ApiError, errorCode, errorMessage } from "../core/api";
import type {
  JournalClient,
  JournalInfo,
  LibraryInfo,
  LibraryPage,
  LibraryTitle,
  LibrarySummary,
  LibraryVersionPage,
} from "../core/api";
import { styles } from "../ui/styles";
import { libraryStyles } from "./styles";
import { dismissBackdrop } from "../ui/dialog";
import { CoverQueue } from "./cover";
import "./collections";

const FILTERS = [
  ["collection", "Collection", "collections"],
  ["actor", "Actor", "actors"],
  ["director", "Director", "directors"],
  ["rating", "Rating", "rating"],
] as const;
const SORTS = [
  ["name", "Title"],
  ["year", "Year"],
  ["collection", "Collection"],
  ["length", "Length"],
  ["watched", "Status"],
  ["added", "Added on"],
] as const;
type Filters = Record<string, string | string[] | boolean>;
const STATUS: Record<string, string> = {
  watched: "Watched",
  unwatched: "Unwatched",
  in_progress: "In progress",
  unknown: "Unknown",
};

export class KaleidescapeLibrary extends LitElement {
  static properties = {
    client: { attribute: false },
    scope: { attribute: false },
  };
  static styles = [styles, libraryStyles];
  client?: JournalClient;
  scope?: JournalInfo;
  private boundClient?: JournalClient;
  private bound = "";
  private generation = 0;
  private listRequest = 0;
  private statusRequest = 0;
  private page?: LibraryPage;
  private info?: LibraryInfo;
  private selected?: LibrarySummary;
  private versions?: LibraryVersionPage;
  private activeVersion?: LibraryTitle;
  private versionRequest = 0;
  private versionsLoading = false;
  private versionsError = "";
  private widths = [360, 90, 260, 150, 140, 210];
  private resize?: { index: number; start: number; width: number };
  private collectionLocked = false;
  private checkingCollection = false;
  confirmNavigation() {
    if (this.collectionLocked || this.checkingCollection) return false;
    return true;
  }

  private filters: Filters = {
    query: "",
    sort: "name",
    descending: false,
  };
  private applied: Filters = { ...this.filters };
  private loading = false;
  private requesting = false;
  private error = "";
  private notice = "";
  private timer?: ReturnType<typeof setTimeout>;
  private covers = new CoverQueue();
  private mode: "list" | "covers" = "list";
  private coverSize = 150;
  private entriesPerPage = 50;
  private coverColumns = 1;
  private gridWidth = 0;
  private grid?: HTMLElement;
  private gridObserver?: ResizeObserver;
  private layoutTimer?: ReturnType<typeof setTimeout>;
  private pendingLimit?: number;
  private requestLimit = 50;
  private requestedOffset = 0;
  private draft: Filters = {};
  private facetSearch = "";
  private visibility = () => {
    clearTimeout(this.timer);
    if (document.hidden) {
      clearTimeout(this.layoutTimer);
      this.layoutTimer = undefined;
      this.pendingLimit = undefined;
    } else {
      void this.refreshStatus();
      this.scheduleLayoutPage();
    }
  };
  connectedCallback() {
    super.connectedCallback();
    document.addEventListener("visibilitychange", this.visibility);
    this.requestUpdate("client");
    this.requestUpdate("scope");
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener("visibilitychange", this.visibility);
    this.clear();
    this.boundClient = undefined;
    this.bound = "";
  }
  protected willUpdate(changed: PropertyValues) {
    if (!changed.has("client") && !changed.has("scope")) return;
    const key = `${this.scope?.entry_id}:${this.scope?.dataset_id}:${this.scope?.library_enabled}:${this.scope?.permissions.edit}`;
    if (this.boundClient === this.client && this.bound === key) return;
    this.clear();
    this.boundClient = this.client;
    this.bound = key;
    if (this.client && this.scope?.library_enabled) {
      this.mode =
        this.scope.ui_defaults?.library_default_view === "covers"
          ? "covers"
          : "list";
      const count = this.scope.ui_defaults?.library_default_count ?? 50;
      this.entriesPerPage =
        Number.isInteger(count) && count >= 1 && count <= 1000 ? count : 50;
      void this.load();
      void this.refreshStatus();
    }
  }
  private clear() {
    this.generation++;
    this.listRequest++;
    clearTimeout(this.timer);
    clearTimeout(this.layoutTimer);
    this.layoutTimer = undefined;
    this.pendingLimit = undefined;
    this.gridObserver?.disconnect();
    this.gridObserver = undefined;
    this.grid = undefined;
    this.gridWidth = 0;
    this.coverColumns = 1;
    this.entriesPerPage = this.requestLimit = 50;
    this.requestedOffset = 0;
    for (const dialog of this.renderRoot.querySelectorAll("dialog"))
      dialog.close();
    this.covers = new CoverQueue();
    this.draft = {};
    this.facetSearch = "";
    this.page = this.info = this.selected = undefined;
    this.collectionLocked = this.checkingCollection = false;
    this.clearVersions();
    this.widths = [360, 90, 260, 150, 140, 210];
    this.resize = undefined;
    this.filters = { query: "", sort: "name", descending: false };
    this.applied = { ...this.filters };
    this.loading = this.requesting = false;
    this.error = this.notice = "";
    this.requestUpdate();
  }
  protected updated() {
    const grid =
      this.isConnected &&
      this.mode === "covers" &&
      this.scope?.library_enabled &&
      this.client
        ? (this.renderRoot.querySelector<HTMLElement>(".cover-grid") ??
          undefined)
        : undefined;
    if (grid !== this.grid) {
      this.gridObserver?.disconnect();
      this.grid = grid;
      if (grid) {
        this.gridObserver = new ResizeObserver((entries) => {
          const entry = entries.find((entry) => entry.target === this.grid);
          if (entry && this.isConnected) this.fitGrid(entry.contentRect.width);
        });
        this.gridObserver.observe(grid);
      }
    }
    if (grid)
      this.fitGrid(grid.getBoundingClientRect().width || this.gridWidth);
  }
  private get pageSize() {
    if (this.mode === "list") return this.entriesPerPage;
    return Math.max(
      this.coverColumns,
      Math.floor(this.entriesPerPage / this.coverColumns) * this.coverColumns,
    );
  }
  private fitGrid(width: number) {
    if (
      !this.isConnected ||
      !Number.isFinite(width) ||
      width <= 0 ||
      this.mode !== "covers"
    )
      return;
    this.gridWidth = width;
    // Match the 2px grid gap, and keep one full row even for a small target.
    const columns = Math.max(
      1,
      Math.min(1000, Math.floor((width + 2) / (this.coverSize + 2))),
    );
    if (columns !== this.coverColumns) {
      this.coverColumns = columns;
      this.requestUpdate();
    }
    this.scheduleLayoutPage();
  }
  private scheduleLayoutPage() {
    if (
      !this.client ||
      !this.scope?.library_enabled ||
      !this.isConnected ||
      document.hidden
    )
      return;
    if (this.pageSize === this.requestLimit) {
      clearTimeout(this.layoutTimer);
      this.layoutTimer = undefined;
      this.pendingLimit = undefined;
      return;
    }
    if (this.layoutTimer && this.pendingLimit === this.pageSize) return;
    clearTimeout(this.layoutTimer);
    this.pendingLimit = this.pageSize;
    this.layoutTimer = setTimeout(() => {
      this.layoutTimer = undefined;
      this.pendingLimit = undefined;
      const anchor = this.loading
        ? this.requestedOffset
        : (this.page?.offset ?? 0);
      void this.load(Math.floor(anchor / this.pageSize) * this.pageSize, true);
    }, 100);
    this.requestUpdate();
  }
  private async setMode(mode: "list" | "covers") {
    if (this.mode === mode) return;
    this.mode = mode;
    this.requestUpdate();
    await this.updateComplete;
    this.scheduleLayoutPage();
  }
  private changePageSize(event: Event) {
    const input = event.target as HTMLInputElement;
    const value = Number(input.value);
    if (!Number.isInteger(value) || value < 1 || value > 1000) {
      input.reportValidity();
      return;
    }
    this.entriesPerPage = value;
    this.requestUpdate();
    this.scheduleLayoutPage();
  }
  private fail(error: unknown) {
    const code = errorCode(error);
    if (code === "unauthorized" || code === "library_disabled") {
      this.clear();
      this.dispatchEvent(
        new CustomEvent(
          code === "unauthorized" ? "access-denied" : "library-disabled",
          { bubbles: true, composed: true },
        ),
      );
    }
    this.error = errorMessage(error);
    this.requestUpdate();
  }
  private async load(offset = 0, preserveSelection = false) {
    if (this.collectionLocked) return;
    if (!this.client || !this.scope?.library_enabled) return;
    clearTimeout(this.layoutTimer);
    this.layoutTimer = undefined;
    this.pendingLimit = undefined;
    const generation = this.generation,
      request = ++this.listRequest,
      limit = this.pageSize;
    this.requestLimit = limit;
    this.requestedOffset = offset;
    this.loading = true;
    this.error = "";
    this.requestUpdate();
    try {
      const page = await this.client.libraryList(this.scope, {
        ...this.applied,
        grouped: true,
        limit,
        offset,
        ...(offset && this.page
          ? {
              revision: this.page.revision,
              ...(this.page.preferences_key
                ? { preferences_key: this.page.preferences_key }
                : {}),
            }
          : {}),
      });
      if (
        generation !== this.generation ||
        request !== this.listRequest ||
        limit !== this.pageSize
      )
        return;
      this.page = page;
      if (this.selected) {
        this.selected =
          page.items.find((row) => row.id === this.selected?.id) ??
          (preserveSelection ? this.selected : undefined);
        if (!this.selected) this.closeDialog("title-dialog");
        else if (
          this.versions &&
          (this.versions.revision !== page.revision ||
            this.versions.preferences_key !== page.preferences_key)
        )
          void this.loadVersions();
      }
    } catch (error) {
      if (generation === this.generation && request === this.listRequest)
        this.fail(error);
    } finally {
      if (generation === this.generation && request === this.listRequest) {
        this.loading = false;
        this.requestUpdate();
      }
    }
  }
  private async refreshStatus() {
    if (
      !this.client ||
      !this.scope?.library_enabled ||
      document.hidden ||
      !this.isConnected
    )
      return;
    clearTimeout(this.timer);
    const generation = this.generation,
      request = ++this.statusRequest;
    let denied = false;
    try {
      const info = await this.client.libraryInfo(this.scope);
      if (generation !== this.generation || request !== this.statusRequest)
        return;
      this.info = info;
      if (
        this.page &&
        (this.page.revision !== info.revision ||
          this.page.preferences_key !== info.preferences_key) &&
        !this.loading
      )
        void this.load();
    } catch (error) {
      denied = errorCode(error) === "unauthorized";
      if (generation === this.generation && request === this.statusRequest)
        this.fail(error);
    } finally {
      if (
        generation === this.generation &&
        request === this.statusRequest &&
        this.isConnected &&
        !denied &&
        !document.hidden
      ) {
        this.timer = setTimeout(
          () => void this.refreshStatus(),
          !this.info?.phase || this.info.phase === "idle" ? 30000 : 5000,
        );
        this.requestUpdate();
      }
    }
  }
  private async sync() {
    if (!this.client || !this.scope?.permissions.edit || this.requesting)
      return;
    const generation = this.generation;
    this.requesting = true;
    this.error = this.notice = "";
    this.requestUpdate();
    try {
      await this.client.librarySync(this.scope);
      if (generation !== this.generation) return;
      this.notice =
        "Library sync requested. Cached titles remain available while it runs.";
      void this.refreshStatus();
    } catch (error) {
      if (generation === this.generation) this.fail(error);
    } finally {
      if (generation === this.generation) {
        this.requesting = false;
        this.requestUpdate();
      }
    }
  }
  private async openDialog(id: string) {
    this.requestUpdate();
    await this.updateComplete;
    if (this.isConnected)
      this.renderRoot.querySelector<HTMLDialogElement>(`#${id}`)?.showModal();
  }
  private closeDialog(id: string) {
    if (id === "title-dialog" && this.collectionLocked) return;
    this.renderRoot.querySelector<HTMLDialogElement>(`#${id}`)?.close();
    if (id === "title-dialog") {
      this.selected = undefined;
      this.clearVersions();
    }
    this.requestUpdate();
  }
  private select(row: LibrarySummary) {
    this.clearVersions();
    this.selected = row;
    void this.openDialog("title-dialog");
    void this.loadVersions();
  }
  private clearVersions() {
    this.collectionLocked = false;
    this.versionRequest++;
    this.versions = undefined;
    this.activeVersion = undefined;
    this.versionsError = "";
    this.versionsLoading = false;
  }
  private async loadVersions(offset = 0) {
    if (this.collectionLocked) return;
    if (!this.client || !this.scope || !this.selected) return;
    const generation = this.generation,
      request = ++this.versionRequest,
      id = this.selected.id;
    this.versionsLoading = true;
    this.versionsError = "";
    this.activeVersion = undefined;
    this.requestUpdate();
    try {
      const result = await this.client.libraryVersions(
        this.scope,
        id,
        offset,
        this.page?.revision,
      );
      if (
        generation !== this.generation ||
        request !== this.versionRequest ||
        this.selected?.id !== id
      )
        return;
      this.versions = result;
      this.activeVersion =
        result.items.find((item) => item.id === id) ?? result.items[0];
    } catch (error) {
      if (generation === this.generation && request === this.versionRequest) {
        if (["unauthorized", "library_disabled"].includes(errorCode(error)))
          this.fail(error);
        else this.versionsError = errorMessage(error);
      }
    } finally {
      if (generation === this.generation && request === this.versionRequest) {
        this.versionsLoading = false;
        this.requestUpdate();
      }
    }
  }
  private format(row: LibrarySummary) {
    const formats =
      row.formats ??
      (row.edition && row.edition.toLowerCase() !== "multiple"
        ? [row.edition]
        : []);
    return formats.length
      ? formats.join(", ") + (row.formats_truncated ? "…" : "")
      : "Formats unavailable · sync library to refresh";
  }
  private years(row: LibrarySummary) {
    return row.years?.join(", ") || String(row.year ?? "—");
  }
  private runtime(row: LibrarySummary) {
    if (row.duration_seconds === null) return "Unknown";
    const minimum = (row.duration_seconds / 60).toFixed(2);
    const maximum = row.maximum_duration_seconds;
    return `${minimum}${maximum != null && maximum !== row.duration_seconds ? `–${(maximum / 60).toFixed(2)}` : ""} min`;
  }
  private resizeColumn(event: KeyboardEvent, index: number) {
    if (!["ArrowLeft", "ArrowRight", "Home"].includes(event.key)) return;
    event.preventDefault();
    this.widths[index] =
      event.key === "Home"
        ? [360, 90, 260, 150, 140, 210][index]
        : Math.max(
            80,
            Math.min(
              800,
              this.widths[index] + (event.key === "ArrowLeft" ? -20 : 20),
            ),
          );
    this.requestUpdate();
  }
  private versionKey(event: KeyboardEvent) {
    if (this.collectionLocked) return;
    if (
      !this.versions?.items.length ||
      !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)
    )
      return;
    event.preventDefault();
    const items = this.versions.items;
    const current = items.findIndex(
      (item) => item.id === this.activeVersion?.id,
    );
    const index =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? items.length - 1
          : (current + (event.key === "ArrowLeft" ? -1 : 1) + items.length) %
            items.length;
    this.activeVersion = items[index];
    this.requestUpdate();
    void this.updateComplete.then(() =>
      this.renderRoot
        .querySelector<HTMLButtonElement>(`#version-${index}`)
        ?.focus(),
    );
  }
  private sort(key: string) {
    this.applied = {
      ...this.applied,
      sort: key,
      descending: this.applied.sort === key ? !this.applied.descending : false,
    };
    void this.load();
  }
  private openFilters() {
    this.draft = structuredClone(this.applied);
    this.facetSearch = "";
    void this.openDialog("filter-dialog");
  }
  private clearFilters() {
    if (this.loading) return;
    this.filters = {
      query: "",
      sort: this.applied.sort,
      descending: this.applied.descending,
    };
    this.applied = { ...this.filters };
    this.draft = {};
    this.facetSearch = "";
    void this.load();
  }
  private choices(key: string, facet: string) {
    const values =
      key === "status" ? Object.keys(STATUS) : (this.page?.facets[facet] ?? []);
    // Retain selected names even if a subsequent sync removes their suggestion.
    return [
      ...new Set([...values, ...((this.draft[key] ?? []) as string[])]),
    ].filter((value) =>
      value.toLocaleLowerCase().includes(this.facetSearch.toLocaleLowerCase()),
    );
  }
  private cover(row: LibrarySummary) {
    return html`<kaleidescape-library-cover
      .client=${this.client}
      .scope=${this.scope}
      .queue=${this.covers}
      .artworkKey=${row.artwork_key}
      .title=${row.title}
    ></kaleidescape-library-cover>`;
  }
  private date(value: string | null | undefined) {
    return value
      ? new Date(
          value.length === 10 ? `${value}T00:00:00` : value,
        ).toLocaleString(undefined, {
          dateStyle: "medium",
          ...(value.length === 10 ? {} : { timeStyle: "short" as const }),
        })
      : "Not yet synced";
  }
  private async checkCollection(request: string, acknowledge = false) {
    if (!this.client || !this.scope || this.checkingCollection) return;
    if (
      acknowledge &&
      !window.confirm(
        "Inspect the collection on the device first. Acknowledging does not undo an add or send another one; it allows a new request even if this add already applied. Continue?",
      )
    )
      return;
    const generation = this.generation;
    this.checkingCollection = true;
    this.error = "";
    this.requestUpdate();
    try {
      const result = await (acknowledge
        ? this.client.collectionAcknowledge(this.scope, request)
        : this.client.collectionCheck(this.scope, request));
      if (generation !== this.generation) return;
      this.notice =
        result.status === "confirmed"
          ? "Collection membership confirmed on the device."
          : result.status === "abandoned"
            ? "Request acknowledged. No device edit was sent."
            : "The requested membership is not confirmed. Inspect the device before acknowledging this request.";
      void this.load();
      void this.refreshStatus();
    } catch (error) {
      if (generation === this.generation) this.fail(error);
    } finally {
      if (generation === this.generation) {
        this.checkingCollection = false;
        this.requestUpdate();
      }
    }
  }
  private renderFilterDialog() {
    return html`<dialog
      id="filter-dialog"
      @click=${dismissBackdrop}
      class="database-dialog library-dialog"
      aria-labelledby="filters-title"
    >
      <div class="card-head">
        <h2 id="filters-title">Library filters</h2>
        <button @click=${() => this.closeDialog("filter-dialog")}>
          Cancel
        </button>
      </div>
      <p>
        Match any checked value within a category and all selected categories.
      </p>
      <label
        >Find filter options<input
          name="facet_search"
          type="search"
          .value=${this.facetSearch}
          @input=${(event: Event) => {
            this.facetSearch = (event.target as HTMLInputElement).value;
            this.requestUpdate();
          }}
      /></label>
      ${this.page?.truncated_facets.length ? html`<p class="muted">Each category shows up to 500 known names.</p>` : nothing}
      <div class="facet-groups">
        ${[...FILTERS, ["status", "Watched status", "status"]].map(
          ([key, label, facet]) => {
            const selected = (this.draft[key] ?? []) as string[];
            const choices = this.choices(key, facet);
            return html`<fieldset>
              <legend>${label}</legend>
              <div class="facet-options">
                ${
                  choices.length
                    ? choices.map(
                        (value) =>
                          html`<label class="check"
                            ><input
                              type="checkbox"
                              name=${key}
                              .value=${value}
                              .checked=${selected.includes(value)}
                              ?disabled=${selected.length >= 100 && !selected.includes(value)}
                              @change=${(event: Event) => {
                                this.draft = {
                                  ...this.draft,
                                  [key]: (event.target as HTMLInputElement)
                                    .checked
                                    ? [...selected, value]
                                    : selected.filter((item) => item !== value),
                                };
                                this.requestUpdate();
                              }}
                            />${key === "status" ? STATUS[value] : value}</label
                          >`,
                      )
                    : html`<p class="muted">No matching options</p>`
                }
              </div>
            </fieldset>`;
          },
        )}
      </div>
      <div class="actions dialog-footer">
        <button
          @click=${() => {
            this.draft = {};
            this.requestUpdate();
          }}
        >
          Clear filters</button
        ><button
          class="primary"
          @click=${() => {
            const next = { ...this.applied };
            for (const key of [...FILTERS.map(([key]) => key), "status"])
              next[key] = this.draft[key] ?? [];
            this.applied = next;
            this.closeDialog("filter-dialog");
            void this.load();
          }}
        >
          Apply filters
        </button>
      </div>
    </dialog>`;
  }
  private renderTitleDialog() {
    const group = this.selected;
    const row = this.activeVersion;
    const admin = this.scope?.permissions.edit;
    return html`<dialog
      id="title-dialog"
      @cancel=${(event: Event) => {
        if (this.collectionLocked) event.preventDefault();
      }}
      @click=${dismissBackdrop}
      class="database-dialog library-dialog"
      aria-labelledby="library-title"
      @close=${() => {
        this.selected = undefined;
        this.clearVersions();
        this.requestUpdate();
      }}
    >
      ${
        group
          ? html`<div class="card-head">
                <h2 id="library-title">
                  ${group.title}${group.year ? ` (${group.year})` : ""}
                </h2>
                <button
                  ?disabled=${this.collectionLocked}
                  @click=${() => this.closeDialog("title-dialog")}
                >
                  Close
                </button>
              </div>
              <p>
                ${group.version_count ?? 1} version(s) · ${this.format(group)}
              </p>
              ${this.versionsLoading ? html`<p role="status">Loading individual versions…</p>` : nothing}
              ${
                this.versionsError
                  ? html`<p class="error" role="alert">${this.versionsError}</p>
                      <button
                        @click=${async () => {
                          await this.load();
                          void this.loadVersions();
                        }}
                      >
                        Refresh title details
                      </button>`
                  : nothing
              }
              ${
                this.versions
                  ? html`<div
                        class="page-tabs version-tabs"
                        role="tablist"
                        aria-label="Title versions"
                        @keydown=${this.versionKey}
                      >
                        ${this.versions.items.map(
                          (item, index) =>
                            html`<button
                              ?disabled=${this.collectionLocked}
                              role="tab"
                              id=${`version-${index}`}
                              aria-controls="version-details"
                              tabindex=${item.id === row?.id ? 0 : -1}
                              aria-selected=${item.id === row?.id}
                              @click=${() => {
                                this.activeVersion = item;
                                this.requestUpdate();
                              }}
                            >
                              ${this.format(item)} ·
                              ${item.year ?? "Year unknown"} · Version
                              ${this.versions!.offset + index + 1}
                            </button>`,
                        )}
                      </div>
                      ${this.versions.total > 50 ? html`<div class="actions"><button ?disabled=${!this.versions.offset || this.versionsLoading} @click=${() => this.loadVersions(Math.max(0, this.versions!.offset - 50))}>Previous versions</button><button ?disabled=${!this.versions.has_more || this.versionsLoading} @click=${() => this.loadVersions(this.versions!.offset + 50)}>Next versions</button></div>` : nothing}`
                  : nothing
              }
              ${
                row
                  ? html`<div
                      class="playback-layout"
                      id="version-details"
                      role="tabpanel"
                      aria-labelledby=${`version-${this.versions?.items.findIndex((item) => item.id === row.id) ?? 0}`}
                    >
                      <div class="cover">${this.cover(row)}</div>
                      <div>
                        <p>${row.synopsis || "No synopsis available."}</p>
                        <p>
                          ${row.year ?? "Year unknown"} ·
                          ${row.rating || "Unrated"} · ${this.format(row)} ·
                          ${STATUS[row.watched_status]}
                        </p>
                        <p>
                          ${row.duration_seconds === null ? "Runtime unknown" : `${(row.duration_seconds / 60).toFixed(2)} min`}
                        </p>
                        ${[
                          ["Collections", row.collections],
                          ["Cast", row.actors],
                          ["Directors", row.directors],
                          ["Genres", row.genres],
                        ].map(([label, values]) =>
                          (values as string[]).length
                            ? html`<p>
                                <strong>${label}:</strong>
                                ${(values as string[]).join(", ")}
                              </p>`
                            : nothing,
                        )}
                        <p class="muted">
                          ${row.purchased_on ? html`Purchased ${this.date(row.purchased_on)}<br />` : nothing}
                          First detected ${this.date(row.first_seen)}.
                        </p>
                        ${
                          admin
                            ? html`<kaleidescape-library-collection-add
                                .client=${this.client}
                                .scope=${this.scope}
                                .version=${row}
                                .revision=${this.versions?.revision ?? 0}
                                .enabled=${!!this.info?.collection_add_enabled}
                                .blocked=${!!this.info?.pending_adds?.length}
                                @collection-lock=${(
                                  event: CustomEvent<boolean>,
                                ) => {
                                  if (event.detail !== this.collectionLocked) {
                                    this.collectionLocked = event.detail;
                                    this.requestUpdate();
                                  }
                                }}
                                @collection-changed=${(
                                  event: CustomEvent<{ status: string }>,
                                ) => {
                                  this.collectionLocked = false;
                                  this.notice =
                                    event.detail.status === "confirmed"
                                      ? "Collection membership confirmed on the device."
                                      : "Check the pending collection add before making another change.";
                                  void this.load();
                                  void this.refreshStatus();
                                }}
                              ></kaleidescape-library-collection-add>`
                            : nothing
                        }
                      </div>
                    </div>`
                  : nothing
              }`
          : nothing
      }
    </dialog>`;
  }
  protected render() {
    const step = this.page?.limit ?? this.requestLimit;
    const paging = this.loading || !!this.layoutTimer;
    const pageItems = this.page?.items ?? [];
    const coverItems =
      this.mode === "covers" &&
      this.page?.has_more &&
      pageItems.length >= this.coverColumns
        ? pageItems.slice(
            0,
            pageItems.length - (pageItems.length % this.coverColumns),
          )
        : pageItems;
    const admin = this.scope?.permissions.edit;
    const activeFilters = [...FILTERS.map(([key]) => key), "status"].reduce(
      (count, key) =>
        count + ((this.applied[key] as string[] | undefined)?.length ?? 0),
      0,
    );
    return html`<section
      class="library-page"
      @access-denied=${(event: Event) => {
        event.stopPropagation();
        this.fail(new ApiError("unauthorized"));
      }}
    >
      <div class="section-head">
        <h2>Library</h2>
        <div class="actions">
          <button
            ?disabled=${this.loading}
            @click=${() => {
              void this.load();
              void this.refreshStatus();
            }}
          >
            Refresh cached data
          </button>
          ${admin ? html`<button class="primary" ?disabled=${this.requesting || (!!this.info?.phase && this.info.phase !== "idle")} @click=${this.sync}>Sync now</button>` : nothing}
        </div>
      </div>
      ${
        this.info
          ? html`<p class="muted">
                ${this.info.group_count} titles · ${this.info.title_count}
                versions · ${this.info.collection_count} collections · Last
                catalog sync: ${this.date(this.info.last_synced_at)}
                ${admin && this.info.phase && this.info.phase !== "idle" ? html`<br />${({ catalog: "Reading titles", collections: "Reading collections", details: "Fetching title data" } as Record<string, string>)[this.info.phase] ?? "Syncing"}… ${this.info.total ? `${this.info.processed}/${this.info.total}` : ""}` : nothing}
              </p>
              <p class="muted">
                Played means watched; Paused takes priority. Collections last
                synced: ${this.date(this.info.collections_synced_at)}.
                ${admin && this.info.collections_enabled === false ? "Collection sync is disabled; retained statuses may be stale." : ""}
              </p>
              ${admin && this.info.artwork_enabled ? html`<p class="muted">Artwork cache: ${((this.info.artwork_bytes ?? 0) / 1048576).toFixed(1)} / ${((this.info.artwork_limit_bytes ?? 0) / 1048576).toFixed(0)} MiB</p>` : nothing}
              ${admin && this.info.error ? html`<p class="warning" role="status">${errorMessage(new ApiError(this.info.error))}</p>` : nothing}`
          : nothing
      }
      ${this.error ? html`<p class="error" role="alert">${this.error}<button @click=${() => this.load()}>Refresh results</button></p>` : nothing}
      ${this.notice ? html`<p class="notice" role="status">${this.notice}</p>` : nothing}
      ${
        admin
          ? (this.info?.pending_adds ?? []).map(
              (item) =>
                html`<div class="warning" role="status">
                  Unconfirmed collection add: <strong>${item.title}</strong> →
                  ${item.collection}. Checking never sends another add.
                  <div class="actions">
                    <button
                      ?disabled=${this.checkingCollection}
                      @click=${() => this.checkCollection(item.request_id)}
                    >
                      Check membership</button
                    ><button
                      ?disabled=${this.checkingCollection}
                      @click=${() => this.checkCollection(item.request_id, true)}
                    >
                      Acknowledge unconfirmed add
                    </button>
                  </div>
                </div>`,
            )
          : nothing
      }
      <section class="card">
        <div class="library-toolbar">
          <form
            @submit=${(event: Event) => {
              event.preventDefault();
              this.applied = { ...this.applied, query: this.filters.query };
              void this.load();
            }}
          >
            <label
              >Search titles<input
                name="library_query"
                type="search"
                maxlength="500"
                .value=${live(String(this.filters.query ?? ""))}
                @input=${(event: Event) => {
                  this.filters.query = (event.target as HTMLInputElement).value;
                }}
            /></label>
            <button type="submit" ?disabled=${this.loading}>Search</button>
          </form>
          <button @click=${this.openFilters}>
            Filters${activeFilters ? ` (${activeFilters})` : ""}
          </button>
          <button ?disabled=${this.loading} @click=${this.clearFilters}>
            Clear Filter
          </button>
          <div class="view-switch" role="group" aria-label="Library view">
            ${(["list", "covers"] as const).map(
              (mode) =>
                html`<button
                  aria-pressed=${this.mode === mode}
                  @click=${() => this.setMode(mode)}
                >
                  ${mode === "list" ? "List" : "Covers"}
                </button>`,
            )}
          </div>
          <label class="page-size"
            >Entries per page<input
              name="library_page_size"
              type="number"
              min="1"
              max="1000"
              step="1"
              .value=${String(this.entriesPerPage)}
              @change=${this.changePageSize}
          /></label>
          ${
            this.mode === "covers"
              ? html`<label class="cover-size"
                    >Cover size<input
                      type="range"
                      name="cover_size"
                      min="90"
                      max="300"
                      step="10"
                      .value=${String(this.coverSize)}
                      @input=${(event: Event) => {
                        this.coverSize = Number(
                          (event.target as HTMLInputElement).value,
                        );
                        this.fitGrid(this.gridWidth);
                        this.requestUpdate();
                      }}
                  /></label>
                  <label
                    >Sort by<select
                      name="library_sort"
                      .value=${String(this.applied.sort)}
                      @change=${(event: Event) => this.sort((event.target as HTMLSelectElement).value)}
                    >
                      ${SORTS.map(([key, label]) => html`<option value=${key}>${label}</option>`)}
                    </select></label
                  >
                  <button @click=${() => this.sort(String(this.applied.sort))}>
                    ${this.applied.descending ? "Descending ↓" : "Ascending ↑"}
                  </button>`
              : nothing
          }
        </div>
        ${
          this.mode === "covers"
            ? html`<div
                class="cover-grid"
                style=${`--cover-size: ${this.coverSize}px; --cover-columns: ${this.coverColumns}`}
              >
                ${coverItems.map(
                  (item) =>
                    html`<button
                      class="cover-tile"
                      title=${`${item.title}${item.year ? ` (${item.year})` : ""}`}
                      aria-label=${`Details for ${item.title}${item.year ? ` (${item.year})` : ""}`}
                      @click=${() => this.select(item)}
                    >
                      <div class="cover-image">${this.cover(item)}</div>
                      <span
                        >${item.title}${item.year ? ` (${item.year})` : ""}</span
                      >
                    </button>`,
                )}
              </div>`
            : html`<div class="table-wrap">
                <table
                  class="library-table"
                  style=${`--library-width: ${this.widths.reduce((a, b) => a + b, 0)}px`}
                >
                  <colgroup>
                    ${this.widths.map((width) => html`<col style=${`width: ${width}px`} />`)}
                  </colgroup>
                  <thead>
                    <tr>
                      ${SORTS.map(
                        ([key, label], index) =>
                          html`<th
                            aria-sort=${this.applied.sort === key ? (this.applied.descending ? "descending" : "ascending") : "none"}
                          >
                            <button
                              class="sort-heading"
                              @click=${() => this.sort(key)}
                            >
                              <span>${label}</span
                              ><span class="sort-icon" aria-hidden="true"
                                >${this.applied.sort === key ? (this.applied.descending ? "↓" : "↑") : "↕"}</span
                              >
                            </button>
                            <span
                              class="column-resize"
                              role="separator"
                              aria-label=${`Resize ${label} column`}
                              aria-orientation="vertical"
                              aria-valuemin="80"
                              aria-valuemax="800"
                              aria-valuenow=${this.widths[index]}
                              tabindex="0"
                              title="Drag or use Left/Right to resize; Home resets"
                              @keydown=${(event: KeyboardEvent) => this.resizeColumn(event, index)}
                              @pointerdown=${(event: PointerEvent) => {
                                event.preventDefault();
                                this.resize = {
                                  index,
                                  start: event.clientX,
                                  width: this.widths[index],
                                };
                                (
                                  event.currentTarget as HTMLElement
                                ).setPointerCapture(event.pointerId);
                              }}
                              @pointermove=${(event: PointerEvent) => {
                                if (this.resize?.index !== index) return;
                                this.widths[index] = Math.max(
                                  80,
                                  Math.min(
                                    800,
                                    this.resize.width +
                                      event.clientX -
                                      this.resize.start,
                                  ),
                                );
                                this.requestUpdate();
                              }}
                              @pointerup=${() => {
                                this.resize = undefined;
                              }}
                              @pointercancel=${() => {
                                this.resize = undefined;
                              }}
                              @lostpointercapture=${() => {
                                this.resize = undefined;
                              }}
                            ></span>
                          </th>`,
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    ${(this.page?.items ?? []).map(
                      (item) =>
                        html`<tr>
                          <td>
                            <button
                              class="link"
                              @click=${() => this.select(item)}
                            >
                              ${item.title}</button
                            ><small title=${this.format(item)}
                              >${this.format(item)}${(item.version_count ?? 1) > 1 ? ` · ${item.version_count} versions` : ""}</small
                            >
                          </td>
                          <td title=${this.years(item)}>${this.years(item)}</td>
                          <td>
                            <span
                              class="collection-cell"
                              title=${item.collections.join(", ")}
                              >${item.collections.join(", ") || "—"}</span
                            >
                          </td>
                          <td>${this.runtime(item)}</td>
                          <td>${STATUS[item.watched_status]}</td>
                          <td
                            title=${item.purchased_on ? "Imported purchase date" : "First detected by Companion"}
                          >
                            ${this.date(item.purchased_on ?? item.first_seen)}
                          </td>
                        </tr>`,
                    )}
                  </tbody>
                </table>
              </div>`
        }
        ${!this.page?.items.length ? html`<p class="empty" role="status">${this.loading ? "Loading library…" : "No cached titles match. Adjust your filters or wait for a library sync."}</p>` : nothing}
        <div class="pagination">
          <small
            >${this.page?.total ?? 0} matching titles · ${this.pageSize} per
            page${this.mode === "covers" ? ` · ${this.coverColumns} covers per row` : ""}</small
          >
          <div class="actions">
            <button
              ?disabled=${paging || !this.page?.offset}
              @click=${() => this.load()}
            >
              First
            </button>
            <button
              ?disabled=${paging || !this.page?.offset}
              @click=${() => this.load(Math.max(0, (this.page?.offset ?? 0) - step))}
            >
              Previous
            </button>
            <button
              ?disabled=${paging || !this.page?.has_more}
              @click=${() => this.load((this.page?.offset ?? 0) + step)}
            >
              Next
            </button>
          </div>
        </div>
      </section>
      ${this.renderFilterDialog()} ${this.renderTitleDialog()}
    </section>`;
  }
}
if (!customElements.get("kaleidescape-library"))
  customElements.define("kaleidescape-library", KaleidescapeLibrary);
