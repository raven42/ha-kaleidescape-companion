import { counted } from "../core/text";
/** Household journal/library browsing; no management or export requests. */
import { LitElement, html, nothing } from "lit";
import type { PropertyValues } from "lit";
import { ApiError, JournalClient, errorCode, errorMessage } from "../core/api";
import type { Hass, JournalInfo, ViewingSummary } from "../core/api";
import { styles } from "./styles";
import { entryLayoutStyles } from "./entry-layout.styles";
import { journalStyles, viewingDetails, viewingListRow } from "./journal-view";
import { landingPage, rememberPage } from "./navigation";
import "../library/library";
import "./journal-options";

export class KaleidescapeReader extends LitElement {
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
  private next: string | null = null;
  private cursor?: string;
  private history: (string | undefined)[] = [];
  private page = 1;
  private activePage: "journal" | "library" = "journal";
  private navigationReady = false;

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
    this.requestUpdate("hass");
    this.requestUpdate("client");
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    this.bind(null);
  }
  private clear() {
    this.generation++;
    this.scope = null;
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
        this.activePage = page === "library" ? "library" : "journal";
        this.navigationReady = true;
      }
      if (!this.scope.library_enabled) this.activePage = "journal";
      rememberPage(this.activePage);
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
  private async selectRecord(id: string) {
    if (!this.api || !this.scope) return;
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
  private selectPage(page: "journal" | "library") {
    if (page === "library" && !this.scope?.library_enabled) return;
    this.selected = null;
    this.detailLoading = false;
    this.detailRequest++;
    this.activePage = page;
    rememberPage(page);
    this.requestUpdate();
  }
  private tabKey(event: KeyboardEvent) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const page =
      !this.scope?.library_enabled || event.key === "End"
        ? "journal"
        : event.key === "Home"
          ? "library"
          : this.activePage === "journal"
            ? "library"
            : "journal";
    this.selectPage(page);
    void this.updateComplete.then(() =>
      this.renderRoot
        .querySelector<HTMLButtonElement>(`#reader-${page}`)
        ?.focus(),
    );
  }
  protected render() {
    return html`<main>
      <header>
        ${this.hass && this.narrow ? html`<button aria-label="Open sidebar" @click=${() => this.dispatchEvent(new CustomEvent("hass-toggle-menu", { bubbles: true, composed: true }))}>☰</button>` : nothing}
        <div>
          <span class="eyebrow">Kaleidescape Companion</span>
          <h1>Viewing history</h1>
          <p>Read-only household journal</p>
        </div>
      </header>
      ${this.error ? html`<p role="alert" class="error">${this.error}</p>` : nothing}
      <nav
        class="page-tabs"
        role="tablist"
        aria-label="Companion pages"
        @keydown=${this.tabKey}
      >
        ${(["library", "journal"] as const).map((page) => html`<button id=${`reader-${page}`} role="tab" aria-controls="reader-content" aria-selected=${this.activePage === page} tabindex=${this.activePage === page ? 0 : -1} ?disabled=${page === "library" && !this.scope?.library_enabled} @click=${() => this.selectPage(page)}>${page === "journal" ? "Journal" : "Library"}</button>`)}
      </nav>
      <section
        id="reader-content"
        role="tabpanel"
        aria-labelledby=${`reader-${this.activePage}`}
      >
        ${
          this.activePage === "library" && this.scope
            ? html`<kaleidescape-library
                .client=${this.api ?? undefined}
                .scope=${this.scope}
                @access-denied=${() => this.fail(new ApiError("unauthorized"))}
                @library-disabled=${() => {
                  this.activePage = "journal";
                  void this.refresh();
                }}
              ></kaleidescape-library>`
            : html`<section class="card journal" aria-label="Viewing history">
                <div class="entries-header">
                  <div class="journal-toolbar">
                    <button
                      ?disabled=${this.loading || !this.api}
                      @click=${this.refresh}
                    >
                      Refresh</button
                    ><kaleidescape-journal-options
                      .client=${this.api}
                      .scope=${this.scope}
                      .disabled=${this.loading}
                      @journal-options=${(
                        event: CustomEvent<{ fuzzy_search: boolean }>,
                      ) => {
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
                  <form
                    class="filters journal-filters"
                    @submit=${(event: Event) => {
                      event.preventDefault();
                      this.query = this.searchText;
                      this.status = this.filterStatus;
                      this.history = [];
                      this.page = 1;
                      void this.load();
                    }}
                  >
                    <label
                      >Search titles<input
                        name="search"
                        type="search"
                        maxlength="500"
                        .value=${this.searchText}
                        ?disabled=${this.loading || !this.scope}
                        @input=${(event: Event) => {
                          this.searchText = (
                            event.target as HTMLInputElement
                          ).value;
                        }}
                    /></label>
                    <label
                      >Status<select
                        name="filter_status"
                        .value=${this.filterStatus}
                        ?disabled=${this.loading || !this.scope}
                        @change=${(event: Event) => {
                          this.filterStatus = (
                            event.target as HTMLSelectElement
                          ).value;
                        }}
                      >
                        <option value="">All</option>
                        <option value="completed">Completed</option>
                        <option value="partial">Partial</option>
                      </select></label
                    >
                    <label
                      >Sort by<select
                        name="journal_sort"
                        .value=${this.sort}
                        ?disabled=${this.loading || !this.scope}
                        @change=${(event: Event) => {
                          this.sort = (event.target as HTMLSelectElement).value;
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
                    <button ?disabled=${this.loading || !this.scope}>
                      Search
                    </button>
                  </form>
                </div>
                <div class="entries-layout">
                  <section class="entries-list" aria-label="Journal entries">
                    <div class="card-head">
                      <h2>Viewings (${this.scope?.viewing_count ?? 0})</h2>
                    </div>
                    ${
                      this.loading
                        ? html`<div class="empty" role="status">
                            Loading viewings…
                          </div>`
                        : !this.api
                          ? html`<p>
                              Sign in to Home Assistant to view the household
                              journal.
                            </p>`
                          : this.rows.length
                            ? html`<ul
                                class="entry-list"
                                tabindex="0"
                                aria-label="Viewings"
                              >
                                ${this.rows.map((row) => viewingListRow(row, this.selected?.id, (id) => void this.selectRecord(id)))}
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
                    <div class="card-head"><h2>Viewing details</h2></div>
                    ${
                      this.detailLoading
                        ? html`<div class="empty" role="status">
                            Loading entry…
                          </div>`
                        : this.selected
                          ? viewingDetails(this.selected, (value) =>
                              this.date(value),
                            )
                          : html`<div class="empty">
                              <strong>Select an entry</strong>
                              <p>View its watching history and duration.</p>
                            </div>`
                    }
                  </section>
                </div>
                <footer class="entries-footer journal-status">
                  <span
                    >${counted(this.scope?.viewing_count ?? 0, "viewing")} ·
                    Revision ${this.scope?.revision ?? 0}</span
                  >
                  <div class="pagination">
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
