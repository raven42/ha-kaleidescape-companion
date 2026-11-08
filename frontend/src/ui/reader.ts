import "./journal-shortcuts";
import "./journal-calendar";
import { responsiveViewport } from "./viewport";
import "./viewing-library";
import type { ViewingLibrary } from "./viewing-library";
import { unifiedMovieDialog, watchMovieDialogMode } from "./movie-dialog-mode";
import type { JournalCalendar } from "./journal-calendar";
import type { CalendarStatus } from "./journal-view";
import { calendarNotice, journalTotals } from "./journal-view";
/** Household journal/library browsing; no management or export requests. */
import { LitElement, html, nothing } from "lit";
import type { PropertyValues } from "lit";
import { ApiError, JournalClient, errorCode, errorMessage } from "../core/api";
import type { Hass, JournalInfo, ViewingSummary } from "../core/api";
import companionIcon from "./assets/companion-icon.png?inline";
import { styles } from "./styles";
import { entryLayoutStyles } from "./entry-layout.styles";
import { journalStyles, viewingDetails, viewingListRow } from "./journal-view";
import { landingPage, rememberPage } from "./navigation";
import { isLibraryLocation, readLibraryFilters } from "../library/url-filters";
import "../library/library";
import "../playback/now-playing";
import "./journal-options";
import type { JournalOptions, JournalOptionsValue } from "./journal-options";
import type { LibraryCriterion } from "../library/criteria";
import type { KaleidescapeLibrary } from "../library/library";

export class KaleidescapeReader extends LitElement {
  constructor() {
    super();
    responsiveViewport(this);
  }

  static properties = {
    hass: { attribute: false },
    client: { attribute: false },
    narrow: { type: Boolean },
  };
  static styles = [styles, entryLayoutStyles, journalStyles];
  hass?: Hass;
  client?: JournalClient;
  narrow = false;
  private api: JournalClient | null = null;
  private connection?: Hass["connection"];
  private userKey = "";
  private generation = 0;
  private scope: JournalInfo | null = null;
  private rows: ViewingSummary[] = [];
  private selected: ViewingSummary | null = null;
  private linkedViewingId?: string;
  private movieSelectionId?: string;
  private unwatchMovieDialog?: () => void;
  private detailLoading = false;
  private detailRequest = 0;
  private loading = false;
  private error = "";
  private query = "";
  private status = "";
  private searchText = "";
  private filterStatus = "";
  private sort = "completed_at";
  private descending = true;
  private fuzzySearch = true;
  private journalView: "list" | "calendar" = "list";
  private calendarSize = 180;
  private calendarFit = false;
  private calendarStatus?: CalendarStatus;
  private journalMovie?: { id: string; title: string };
  private libraryTitleId?: string;
  private libraryCriterion?: LibraryCriterion;
  private next: string | null = null;
  private cursor?: string;
  private history: (string | undefined)[] = [];
  private page = 1;
  private playbackPlayer = "";
  private activePage: "now-playing" | "journal" | "library" = "journal";
  private navigationReady = false;
  private controlLocked = false;
  private locationChanged = () => {
    if (
      this.navigationReady &&
      this.scope?.library_enabled &&
      this.activePage !== "library" &&
      isLibraryLocation() &&
      readLibraryFilters()
    )
      this.selectPage("library");
  };

  confirmNavigation() {
    return (
      !this.controlLocked &&
      (this.renderRoot
        .querySelector<KaleidescapeLibrary>("kaleidescape-library")
        ?.confirmNavigation() ??
        true)
    );
  }
  private announcePage() {
    this.dispatchEvent(
      new CustomEvent("page-changed", {
        detail: this.activePage,
        bubbles: true,
        composed: true,
      }),
    );
  }

  protected willUpdate(changed: PropertyValues) {
    if (!changed.has("hass") && !changed.has("client")) return;
    if (this.hass) {
      const key = `${this.hass.user?.id}:${this.hass.user?.is_admin}`;
      if (!this.hass.user || !this.hass.connection.connected) this.bind(null);
      else if (
        this.connection !== this.hass.connection ||
        this.userKey !== key ||
        !this.api
      ) {
        this.connection = this.hass.connection;
        this.userKey = key;
        this.bind(
          new JournalClient({
            callWS: (message) => this.hass!.callWS(message),
            fetchWithAuth: (path, init) => this.hass!.fetchWithAuth(path, init),
          }),
        );
      }
    } else this.bind(this.client ?? null);
  }
  connectedCallback() {
    super.connectedCallback();
    window.addEventListener("location-changed", this.locationChanged);
    window.addEventListener("popstate", this.locationChanged);
    this.unwatchMovieDialog = watchMovieDialogMode(() => {
      if (unifiedMovieDialog() && this.selected)
        this.movieSelectionId = this.selected.id;
      this.requestUpdate();
    });
    this.requestUpdate("hass");
    this.requestUpdate("client");
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener("location-changed", this.locationChanged);
    window.removeEventListener("popstate", this.locationChanged);
    this.unwatchMovieDialog?.();
    this.unwatchMovieDialog = undefined;
    this.bind(null);
  }
  private clear() {
    this.controlLocked = false;
    this.generation++;
    this.scope = null;
    this.playbackPlayer = "";
    this.activePage = "journal";
    this.navigationReady = false;
    this.rows = [];
    this.selected = null;
    this.detailLoading = false;
    this.detailRequest++;
    this.next = null;
    this.cursor = undefined;
    this.history = [];
    this.page = 1;
    this.query = this.status = this.searchText = this.filterStatus = "";
    this.sort = "completed_at";
    this.descending = true;
    this.fuzzySearch = true;
    this.journalView = "list";
    this.calendarSize = 180;
    this.calendarFit = false;
    this.calendarStatus = undefined;
    this.journalMovie = undefined;
    this.libraryTitleId = undefined;
    this.libraryCriterion = undefined;
    this.loading = false;
    this.error = "";
  }
  private bind(api: JournalClient | null) {
    if (api === this.api) return;
    this.clear();
    this.api = api;
    this.requestUpdate();
    if (api) void this.refresh();
  }
  private fail(error: unknown) {
    if (errorCode(error) === "unauthorized") this.clear();
    this.error = errorMessage(error);
    this.requestUpdate();
  }
  private async refresh() {
    if (!this.api) return;
    const generation = ++this.generation;
    this.scope = null;
    this.rows = [];
    this.selected = null;
    this.detailLoading = false;
    this.detailRequest++;
    this.next = null;
    this.cursor = undefined;
    this.history = [];
    this.page = 1;
    this.loading = true;
    this.error = "";
    this.requestUpdate();
    try {
      const { entries } = await this.api.info();
      if (generation !== this.generation) return;
      if (!entries[0]?.permissions.read || entries[0].api_version !== 1)
        throw new ApiError("not_ready");
      this.scope = {
        ...entries[0],
        permissions: { read: true, edit: false, export: false },
      };
      if (!this.navigationReady) {
        const page = landingPage(
          this.scope.ui_defaults?.default_landing_page,
          false,
          !!this.scope.library_enabled,
        );
        this.activePage =
          page === "library" || page === "now-playing" ? page : "journal";
        this.navigationReady = true;
      }
      if (this.activePage === "library" && !this.scope.library_enabled)
        this.activePage = "journal";
      rememberPage(this.activePage);
      this.announcePage();
      await this.load(undefined, generation);
    } catch (error) {
      if (generation === this.generation) this.fail(error);
    } finally {
      if (generation === this.generation) {
        this.loading = false;
        this.requestUpdate();
      }
    }
  }
  private async load(cursor?: string, generation = ++this.generation) {
    if (!this.api || !this.scope) return;
    this.loading = true;
    this.error = "";
    this.rows = [];
    this.selected = null;
    this.detailLoading = false;
    this.detailRequest++;
    this.requestUpdate();
    try {
      const result = await this.api.list(
        this.scope,
        this.query,
        this.status,
        cursor,
        this.sort,
        this.descending,
        this.fuzzySearch,
        this.journalMovie?.id,
      );
      if (generation !== this.generation) return;
      this.rows = result.items;
      this.next = result.next_cursor;
      this.cursor = cursor;
    } catch (error) {
      if (generation === this.generation) {
        this.next = null;
        this.fail(error);
      }
    } finally {
      if (generation === this.generation) {
        this.loading = false;
        this.requestUpdate();
      }
    }
  }
  private selectJournalEntry(id: string) {
    return this.selectRecord(id, true);
  }
  private async selectRecord(id: string, openMovie = false) {
    if (!this.api || !this.scope) return;
    this.movieSelectionId = openMovie ? id : undefined;
    const generation = this.generation,
      request = ++this.detailRequest;
    this.selected = null;
    this.detailLoading = true;
    this.requestUpdate();
    try {
      const row = await this.api.get(this.scope, id);
      if (generation === this.generation && request === this.detailRequest)
        this.selected = row;
    } catch (error) {
      if (generation === this.generation && request === this.detailRequest)
        this.fail(error);
    } finally {
      if (generation === this.generation && request === this.detailRequest) {
        this.detailLoading = false;
        this.requestUpdate();
      }
    }
  }
  private date(value: string | null) {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
  }
  private selectPage(
    page: "now-playing" | "journal" | "library",
    target?: {
      movie?: { id: string; title: string };
      libraryTitleId?: string;
      libraryCriterion?: LibraryCriterion;
    },
  ) {
    if (
      this.controlLocked ||
      (page === "library" && !this.scope?.library_enabled)
    )
      return;
    this.selected = null;
    this.detailLoading = false;
    this.detailRequest++;
    this.libraryTitleId = target?.libraryTitleId;
    this.libraryCriterion = target?.libraryCriterion;
    this.activePage = page;
    if (page === "journal") {
      this.journalMovie = target?.movie;
      this.query = this.searchText = this.status = this.filterStatus = "";
      this.page = 1;
      this.history = [];
      void this.load();
    }
    rememberPage(page);
    this.announcePage();
    this.requestUpdate();
  }
  private tabKey(event: KeyboardEvent) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const pages: ("now-playing" | "library" | "journal")[] = [
      "now-playing",
      ...(this.scope?.library_enabled ? ["library" as const] : []),
      "journal",
    ] as const;
    const current = pages.indexOf(this.activePage);
    const page =
      event.key === "Home"
        ? pages[0]
        : event.key === "End"
          ? pages.at(-1)!
          : pages[
              (current + (event.key === "ArrowRight" ? 1 : -1) + pages.length) %
                pages.length
            ];
    this.selectPage(page);
    void this.updateComplete.then(() =>
      this.renderRoot
        .querySelector<HTMLButtonElement>(`#reader-${page}`)
        ?.focus(),
    );
  }
  private clearJournalSearch() {
    this.query = this.searchText = "";
    this.page = 1;
    this.history = [];
    void this.load();
    this.requestUpdate();
  }
  protected render() {
    const calendarView = this.journalView === "calendar" && !this.query.trim();
    return html`<main>
      <header>
        ${this.hass && this.narrow ? html`<button aria-label="Open sidebar" @click=${() => this.dispatchEvent(new CustomEvent("hass-toggle-menu", { bubbles: true, composed: true }))}>☰</button>` : nothing}
        <img
          class="companion-icon"
          src=${companionIcon}
          alt=""
          aria-hidden="true"
        />
        <div>
          <span class="eyebrow">Kaleidescape Companion</span>
          <h1>Viewing history</h1>
          <p>
            ${this.activePage === "now-playing" ? "Household playback controls" : "Read-only household journal"}
          </p>
        </div>
      </header>
      ${this.error ? html`<p role="alert" class="error">${this.error}</p>` : nothing}
      <div class="page-navigation">
        <nav
          class="page-tabs"
          role="tablist"
          aria-label="Companion pages"
          @keydown=${this.tabKey}
        >
          ${(["now-playing", "library", "journal"] as const).map((page) => html`<button id=${`reader-${page}`} role="tab" aria-controls="reader-content" aria-selected=${this.activePage === page} tabindex=${this.activePage === page ? 0 : -1} ?disabled=${page === "library" && !this.scope?.library_enabled} @click=${() => this.selectPage(page)}>${page === "now-playing" ? "Now Playing" : page === "journal" ? "Journal" : "Library"}</button>`)}
        </nav>
        <span class="view-mode-slot"><slot name="view-mode"></slot></span>
      </div>
      <section
        id="reader-content"
        @control-lock=${(event: CustomEvent<boolean>) => {
          if (this.controlLocked === event.detail) return;
          this.controlLocked = event.detail;
          this.requestUpdate();
        }}
        role="tabpanel"
        aria-labelledby=${`reader-${this.activePage}`}
        @playback-started=${(event: CustomEvent<string>) => {
          this.playbackPlayer = event.detail;
          this.selectPage("now-playing");
        }}
      >
        ${
          this.activePage === "now-playing" && this.scope
            ? html`<kaleidescape-now-playing
                .playerId=${this.playbackPlayer}
                .client=${this.api ?? undefined}
                .scope=${this.scope}
                @access-denied=${() => this.fail(new ApiError("unauthorized"))}
              ></kaleidescape-now-playing>`
            : this.activePage === "library" && this.scope
              ? html`<kaleidescape-library
                  .client=${this.api ?? undefined}
                  .scope=${this.scope}
                  .openTitleId=${this.libraryTitleId}
                  .openCriterion=${this.libraryCriterion}
                  @access-denied=${() => this.fail(new ApiError("unauthorized"))}
                  @library-disabled=${() => {
                    this.activePage = "journal";
                    void this.refresh();
                  }}
                ></kaleidescape-library>`
              : html`<section
                  class=${`card journal${calendarView ? " journal-calendar-mode" : ""}`}
                  aria-label="Viewing history"
                >
                  <div class="entries-header">
                    ${
                      calendarView
                        ? html`<kaleidescape-journal-shortcuts
                            .context=${this.api}
                            .scopeKey=${`${this.scope?.entry_id}:${this.scope?.dataset_id}`}
                            .value=${this.searchText}
                            .status=${this.status}
                            @journal-refresh=${() => this.refresh()}
                            @journal-status=${(event: CustomEvent<string>) => {
                              this.status = this.filterStatus = event.detail;
                              this.page = 1;
                              this.history = [];
                              void this.load();
                            }}
                            .disabled=${this.loading || !this.scope}
                            .allowAdd=${false}
                            .filtered=${!!this.status || !!this.journalMovie}
                            .filterLabel=${this.journalMovie ? `Viewings for ${this.journalMovie.title}` : ""}
                            @journal-search=${(event: CustomEvent<string>) => {
                              this.query = this.searchText =
                                event.detail.trim();
                              this.page = 1;
                              this.history = [];
                              void this.load();
                            }}
                            @journal-open-options=${() => this.renderRoot.querySelector<JournalOptions>("kaleidescape-journal-options")?.open()}
                            @journal-clear-movie=${() => this.selectPage("journal")}
                          ></kaleidescape-journal-shortcuts>`
                        : nothing
                    }
                    ${this.journalMovie ? html`<p class="journal-movie-filter">Viewings for ${this.journalMovie.title} <button @click=${() => this.selectPage("journal")}>Show all viewings</button></p>` : nothing}
                    ${this.query.trim() ? html`<button type="button" class="journal-search-chip" aria-label=${`Clear search: ${this.query}`} ?disabled=${this.loading || !this.scope} @click=${this.clearJournalSearch}><span>${this.query}</span><span aria-hidden="true">×</span></button>` : nothing}
                    <form
                      class="filters journal-filters"
                      @submit=${(event: Event) => {
                        event.preventDefault();
                        this.query = this.searchText = this.searchText.trim();
                        this.status = this.filterStatus;
                        this.history = [];
                        this.page = 1;
                        void this.load();
                      }}
                    >
                      <label
                        >Search titles<span class="journal-search-input"
                          ><input
                            name="search"
                            type="search"
                            maxlength="500"
                            .value=${this.searchText}
                            ?disabled=${this.loading || !this.scope}
                            @input=${(event: Event) => {
                              this.searchText = (
                                event.target as HTMLInputElement
                              ).value;
                              if (!this.searchText && this.query)
                                this.clearJournalSearch();
                            }}
                          />${this.query.trim() ? html`<button type="button" class="journal-clear-search" aria-label="Clear Journal search" title="Clear search" ?disabled=${this.loading || !this.scope} @click=${this.clearJournalSearch}>×</button>` : nothing}</span
                        ></label
                      >
                      <div class="journal-filter-tools">
                        <label
                          >Status<select
                            name="filter_status"
                            .value=${this.status}
                            ?disabled=${this.loading || !this.scope}
                            @change=${(event: Event) => {
                              this.status = this.filterStatus = (
                                event.target as HTMLSelectElement
                              ).value;
                              this.page = 1;
                              this.history = [];
                              void this.load();
                            }}
                          >
                            <option value="">All</option>
                            <option value="partial">Partial</option>
                            <option value="completed">Completed</option>
                          </select></label
                        >
                        <label ?hidden=${calendarView}
                          >Sort by<select
                            name="journal_sort"
                            .value=${this.sort}
                            ?disabled=${this.loading || !this.scope}
                            @change=${(event: Event) => {
                              this.sort = (
                                event.target as HTMLSelectElement
                              ).value;
                              this.page = 1;
                              this.history = [];
                              void this.load();
                            }}
                          >
                            <option value="completed_at">
                              Completed date · partial first
                            </option>
                            <option value="title">Title</option>
                          </select></label
                        >
                        <button
                          type="button"
                          ?hidden=${calendarView}
                          ?disabled=${this.loading || !this.scope}
                          @click=${() => {
                            this.descending = !this.descending;
                            this.page = 1;
                            this.history = [];
                            void this.load();
                          }}
                        >
                          ${this.descending ? "Descending ↓" : "Ascending ↑"}
                        </button>
                      </div>
                      <button
                        class="journal-search-button"
                        ?disabled=${this.loading || !this.scope}
                      >
                        Search
                      </button>
                      <div class="journal-toolbar">
                        <button
                          type="button"
                          ?disabled=${this.loading || !this.api}
                          @click=${this.refresh}
                        >
                          Refresh</button
                        ><kaleidescape-journal-options
                          .mobileCompact=${calendarView}
                          .client=${this.api}
                          .scope=${this.scope}
                          .disabled=${this.loading}
                          @journal-options=${(
                            event: CustomEvent<JournalOptionsValue>,
                          ) => {
                            this.journalView = event.detail.view;
                            this.calendarSize = event.detail.calendar_size;
                            this.calendarFit = event.detail.calendar_fit;
                            this.requestUpdate();
                            const changed =
                              this.fuzzySearch !== event.detail.fuzzy_search;
                            this.fuzzySearch = event.detail.fuzzy_search;
                            if (changed) {
                              this.page = 1;
                              this.history = [];
                              void this.load();
                            }
                          }}
                          @access-denied=${() => this.fail(new ApiError("unauthorized"))}
                        ></kaleidescape-journal-options>
                      </div>
                    </form>
                  </div>
                  ${
                    calendarView
                      ? html`<kaleidescape-journal-calendar
                          @calendar-status=${(
                            event: CustomEvent<CalendarStatus>,
                          ) => {
                            this.calendarStatus = event.detail;
                            this.requestUpdate();
                          }}
                          .client=${this.api ?? undefined}
                          .scope=${this.scope ?? undefined}
                          .query=${this.query}
                          .status=${this.status}
                          .fuzzy=${this.fuzzySearch}
                          .libraryTitleId=${this.journalMovie?.id}
                          .daySize=${this.calendarSize}
                          .fitScreen=${this.calendarFit}
                          @browse-library=${(event: CustomEvent<LibraryCriterion>) => this.selectPage("library", { libraryCriterion: event.detail })}
                          @access-denied=${() => this.fail(new ApiError("unauthorized"))}
                        ></kaleidescape-journal-calendar>`
                      : html`
                          <div class="entries-layout">
                            <section
                              class="entries-list"
                              aria-label="Journal entries"
                            >
                              <div class="card-head">
                                <h2>
                                  Viewings (${this.scope?.viewing_count ?? 0})
                                </h2>
                              </div>
                              ${
                                this.loading
                                  ? html`<div class="empty" role="status">
                                      Loading viewings…
                                    </div>`
                                  : !this.api
                                    ? html`<p>
                                        Sign in to Home Assistant to view the
                                        household journal.
                                      </p>`
                                    : this.rows.length
                                      ? html`<ul
                                          class="entry-list"
                                          tabindex="0"
                                          aria-label="Viewings"
                                        >
                                          ${this.rows.map((row) => viewingListRow(row, this.selected?.id, (id) => void this.selectJournalEntry(id)))}
                                        </ul>`
                                      : html`<div class="empty">
                                          No viewings to display.
                                        </div>`
                              }
                            </section>
                            <section
                              class="entries-detail"
                              aria-label="Viewing details"
                              tabindex="0"
                            >
                              <div class="card-head">
                                <h2>Viewing details</h2>
                              </div>
                              ${
                                this.detailLoading
                                  ? html`<div class="empty" role="status">
                                      Loading entry…
                                    </div>`
                                  : this.selected
                                    ? html`${viewingDetails(
                                          this.selected,
                                          (value) => this.date(value),
                                          this.linkedViewingId ===
                                            this.selected.id
                                            ? () =>
                                                this.renderRoot
                                                  .querySelector<ViewingLibrary>(
                                                    "kaleidescape-viewing-library",
                                                  )
                                                  ?.openLibrary()
                                            : undefined,
                                        )}
                                        <kaleidescape-viewing-library
                                          .client=${this.api ?? undefined}
                                          .scope=${this.scope ?? undefined}
                                          .viewingId=${this.selected.id}
                                          .autoOpen=${unifiedMovieDialog() && this.movieSelectionId === this.selected.id}
                                          @viewing-library-link=${(
                                            event: CustomEvent<{
                                              viewingId: string;
                                              linked: boolean;
                                            }>,
                                          ) => {
                                            if (
                                              this.selected?.id !==
                                              event.detail.viewingId
                                            )
                                              return;
                                            const id = event.detail.linked
                                              ? event.detail.viewingId
                                              : undefined;
                                            if (this.linkedViewingId !== id) {
                                              this.linkedViewingId = id;
                                              this.requestUpdate();
                                            }
                                          }}
                                          @access-denied=${() => this.fail(new ApiError("unauthorized"))}
                                          @browse-library=${(event: CustomEvent<LibraryCriterion>) => this.selectPage("library", { libraryCriterion: event.detail })}
                                        ></kaleidescape-viewing-library> `
                                    : html`<div class="empty">
                                        <strong>Select an entry</strong>
                                        <p>
                                          View its watching history and
                                          duration.
                                        </p>
                                      </div>`
                              }
                            </section>
                          </div>
                        `
                  }
                  <footer class="entries-footer journal-status">
                    <span
                      >${journalTotals(this.scope, calendarView ? this.calendarStatus : undefined, calendarView)}</span
                    >${
                      calendarView
                        ? calendarNotice(this.calendarStatus, () => {
                            void this.renderRoot
                              .querySelector<JournalCalendar>(
                                "kaleidescape-journal-calendar",
                              )
                              ?.refresh();
                          })
                        : nothing
                    }

                    <div class="pagination" ?hidden=${calendarView}>
                      <small>Page ${this.page} · Up to 25 entries</small>
                      <div class="actions">
                        <button
                          ?disabled=${this.loading || this.page === 1}
                          @click=${() => {
                            this.history = [];
                            this.page = 1;
                            void this.load();
                          }}
                        >
                          First
                        </button>
                        <button
                          ?disabled=${this.loading || !this.history.length}
                          @click=${() => {
                            this.page--;
                            void this.load(this.history.pop());
                          }}
                        >
                          Previous
                        </button>
                        <button
                          ?disabled=${this.loading || !this.next}
                          @click=${() => {
                            this.history.push(this.cursor);
                            if (this.history.length > 200) this.history.shift();
                            this.page++;
                            void this.load(this.next!);
                          }}
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  </footer>
                </section>`
        }
      </section>
    </main>`;
  }
}
if (!customElements.get("kaleidescape-reader"))
  customElements.define("kaleidescape-reader", KaleidescapeReader);
