/** Household journal browsing; this component sends no writes or export requests. */
import { LitElement, html, nothing } from "lit";
import type { PropertyValues } from "lit";
import { ApiError, JournalClient, errorCode, errorMessage } from "./api";
import type { Hass, JournalInfo, ViewingSummary } from "./api";
import { styles } from "./styles";

export class KaleidescapeReader extends LitElement {
  static properties = {
    hass: { attribute: false },
    client: { attribute: false },
    narrow: { type: Boolean },
  };
  static styles = styles;
  hass?: Hass;
  client?: JournalClient;
  narrow = false;
  private api: JournalClient | null = null;
  private connection?: Hass["connection"];
  private userKey = "";
  private generation = 0;
  private scope: JournalInfo | null = null;
  private rows: ViewingSummary[] = [];
  private loading = false;
  private error = "";
  private query = "";
  private status = "";
  private searchText = "";
  private filterStatus = "";
  private next: string | null = null;
  private cursor?: string;
  private history: (string | undefined)[] = [];
  private page = 1;

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
    this.rows = [];
    this.next = null;
    this.cursor = undefined;
    this.history = [];
    this.page = 1;
    this.query = this.status = this.searchText = this.filterStatus = "";
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
      this.scope = entries[0];
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
    this.requestUpdate();
    try {
      const result = await this.api.list(
        this.scope,
        this.query,
        this.status,
        cursor,
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
  private date(value: string | null) {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
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
      <section class="card" aria-label="Viewing history">
        <div class="card-head">
          <h2>Viewings</h2>
          <button ?disabled=${this.loading || !this.api} @click=${this.refresh}>
            Refresh
          </button>
        </div>
        <form
          class="filters"
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
                this.searchText = (event.target as HTMLInputElement).value;
              }}
          /></label>
          <label
            >Status<select
              name="filter_status"
              .value=${this.filterStatus}
              ?disabled=${this.loading || !this.scope}
              @change=${(event: Event) => {
                this.filterStatus = (event.target as HTMLSelectElement).value;
              }}
            >
              <option value="">All</option>
              <option value="completed">Completed</option>
              <option value="partial">Partial</option>
            </select></label
          >
          <button ?disabled=${this.loading || !this.scope}>Search</button>
        </form>
        ${
          this.loading
            ? html`<p role="status">Loading viewings…</p>`
            : !this.api
              ? html`<p>
                  Sign in to Home Assistant to view the household journal.
                </p>`
              : !this.rows.length
                ? html`<p>No viewings to display.</p>`
                : html`<div class="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Movie</th>
                          <th>Status</th>
                          <th>Watched</th>
                          <th>Runtime</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${this.rows.map(
                          (row) =>
                            html`<tr>
                              <td>
                                <strong>${row.title}</strong
                                ><small
                                  >Started ${this.date(row.started_at)}<br />Ended
                                  ${this.date(row.ended_at)}</small
                                >
                              </td>
                              <td>
                                ${row.status === "completed" ? "Completed" : "Partial"}
                              </td>
                              <td>
                                ${(row.watched_seconds / 60).toFixed(2)} min
                              </td>
                              <td>
                                ${row.duration_seconds == null ? "—" : `${(row.duration_seconds / 60).toFixed(2)} min`}
                              </td>
                            </tr>`,
                        )}
                      </tbody>
                    </table>
                  </div>`
        }
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
      </section>
    </main>`;
  }
}
if (!customElements.get("kaleidescape-reader"))
  customElements.define("kaleidescape-reader", KaleidescapeReader);
