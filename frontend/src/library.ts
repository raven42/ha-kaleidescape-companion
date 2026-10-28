/** Read-only, locally cached library browsing; networking to devices stays in HA. */
import { LitElement, css, html, nothing } from "lit";
import type { PropertyValues } from "lit";
import { ApiError, errorCode, errorMessage } from "./api";
import type {
  JournalClient,
  JournalInfo,
  LibraryInfo,
  LibraryPage,
  LibraryTitle,
} from "./api";
import { styles } from "./styles";

const FILTERS = [
  ["collection", "Collection", "collections"],
  ["actor", "Actor", "actors"],
  ["director", "Director", "directors"],
  ["writer", "Writer", "writers"],
  ["studio", "Studio", "studios"],
  ["rating", "Rating", "rating"],
];
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
  static styles = [
    styles,
    css`
      :host {
        min-height: 0;
      }
    `,
  ];
  client?: JournalClient;
  scope?: JournalInfo;
  private boundClient?: JournalClient;
  private bound = "";
  private generation = 0;
  private listRequest = 0;
  private statusRequest = 0;
  private page?: LibraryPage;
  private info?: LibraryInfo;
  private selected?: LibraryTitle;
  private filters: Record<string, string | boolean> = {
    query: "",
    sort: "name",
    descending: false,
  };
  private applied: Record<string, string | boolean> = { ...this.filters };
  private loading = false;
  private requesting = false;
  private error = "";
  private notice = "";
  private timer?: ReturnType<typeof setTimeout>;
  private cover?: string;
  private coverController?: AbortController;
  private coverRequest = 0;
  private visibility = () => {
    clearTimeout(this.timer);
    if (document.hidden) this.clearCover();
    else {
      void this.refreshStatus();
      if (this.selected) void this.loadCover(this.selected);
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
    const key = `${this.scope?.entry_id}:${this.scope?.dataset_id}:${this.scope?.library_enabled}`;
    if (this.boundClient === this.client && this.bound === key) return;
    this.clear();
    this.boundClient = this.client;
    this.bound = key;
    if (this.client && this.scope?.library_enabled) {
      void this.load();
      void this.refreshStatus();
    }
  }
  private clearCover() {
    this.coverRequest++;
    this.coverController?.abort();
    this.coverController = undefined;
    if (this.cover) URL.revokeObjectURL(this.cover);
    this.cover = undefined;
  }
  private clear() {
    this.generation++;
    this.listRequest++;
    clearTimeout(this.timer);
    this.clearCover();
    this.page = this.info = this.selected = undefined;
    this.filters = { query: "", sort: "name", descending: false };
    this.applied = { ...this.filters };
    this.loading = this.requesting = false;
    this.error = this.notice = "";
    this.requestUpdate();
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
  private async load(offset = 0) {
    if (!this.client || !this.scope?.library_enabled) return;
    const generation = this.generation,
      request = ++this.listRequest;
    this.loading = true;
    this.error = "";
    this.requestUpdate();
    try {
      const page = await this.client.libraryList(this.scope, {
        ...this.applied,
        offset,
        ...(offset && this.page ? { revision: this.page.revision } : {}),
      });
      if (generation !== this.generation || request !== this.listRequest)
        return;
      this.page = page;
      const selected =
        page.items.find((row) => row.id === this.selected?.id) ?? page.items[0];
      this.selected = selected;
      if (selected) void this.loadCover(selected);
      else this.clearCover();
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
      if (this.page && this.page.revision !== info.revision && !this.loading)
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
          this.info?.phase === "idle" ? 30000 : 5000,
        );
        this.requestUpdate();
      }
    }
  }
  private async sync() {
    if (!this.client || !this.scope || this.requesting) return;
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
  private async loadCover(row: LibraryTitle) {
    this.clearCover();
    this.requestUpdate();
    if (!this.client || !this.scope || !row.artwork_key || document.hidden)
      return;
    const generation = this.generation,
      request = this.coverRequest;
    const controller = (this.coverController = new AbortController());
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const blob = await this.client.libraryArtwork(
        this.scope,
        row.artwork_key,
        controller.signal,
      );
      if (
        generation !== this.generation ||
        request !== this.coverRequest ||
        document.hidden ||
        !this.isConnected
      )
        return;
      this.cover = URL.createObjectURL(blob);
      this.requestUpdate();
    } catch (error) {
      if (
        generation === this.generation &&
        request === this.coverRequest &&
        errorCode(error) === "unauthorized"
      )
        this.fail(error);
    } finally {
      clearTimeout(timeout);
      if (request === this.coverRequest) this.coverController = undefined;
    }
  }
  private date(value: string | null | undefined) {
    return value
      ? new Date(value).toLocaleString(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
        })
      : "Not yet synced";
  }
  protected render() {
    const row = this.selected;
    return html`<section class="library-page">
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
          <button
            class="primary"
            ?disabled=${this.requesting || (!!this.info && this.info.phase !== "idle")}
            @click=${this.sync}
          >
            Sync now
          </button>
        </div>
      </div>
      ${
        this.info
          ? html`<p class="muted">
                ${this.info.group_count} titles · ${this.info.title_count}
                versions · ${this.info.collection_count} collections · Last
                catalog sync: ${this.date(this.info.last_synced_at)}
                ${this.info.phase !== "idle" ? html`<br />${({ catalog: "Reading titles", collections: "Reading collections", details: "Fetching title data" } as Record<string, string>)[this.info.phase] ?? "Syncing"}… ${this.info.total ? `${this.info.processed}/${this.info.total}` : ""}` : nothing}
              </p>
              <p class="muted">
                Played means watched; Paused takes priority. Collections last
                synced: ${this.date(this.info.collections_synced_at)}.
                ${!this.info.collections_enabled ? "Collection sync is disabled; retained statuses may be stale." : ""}
              </p>
              ${this.info.artwork_enabled ? html`<p class="muted">Artwork cache: ${(this.info.artwork_bytes / 1048576).toFixed(1)} / ${(this.info.artwork_limit_bytes / 1048576).toFixed(0)} MiB</p>` : nothing}
              ${this.info.error ? html`<p class="warning" role="status">${errorMessage(new ApiError(this.info.error))}</p>` : nothing}`
          : nothing
      }
      ${this.error ? html`<p class="error" role="alert">${this.error}<button @click=${() => this.load()}>Refresh results</button></p>` : nothing}
      ${this.notice ? html`<p class="notice" role="status">${this.notice}</p>` : nothing}
      <section class="card">
        <form
          class="library-filters"
          @submit=${(event: Event) => {
            event.preventDefault();
            this.applied = { ...this.filters };
            void this.load();
          }}
        >
          <label class="full"
            >Search titles<input
              name="library_query"
              type="search"
              maxlength="500"
              .value=${String(this.filters.query ?? "")}
              @input=${(event: Event) => {
                this.filters.query = (event.target as HTMLInputElement).value;
              }}
          /></label>
          ${FILTERS.map(
            ([key, label, facet]) =>
              html`<label
                >${label}
                ${
                  ["actor", "director", "writer", "studio"].includes(key)
                    ? html`<input
                          name=${key}
                          list=${`facet-${key}`}
                          maxlength="500"
                          .value=${String(this.filters[key] ?? "")}
                          placeholder=${this.page?.facets[facet]?.length ? "All · choose or type a name" : "No metadata available"}
                          ?disabled=${!this.page?.facets[facet]?.length}
                          @input=${(event: Event) => {
                            this.filters[key] = (
                              event.target as HTMLInputElement
                            ).value;
                          }}
                        />
                        <datalist id=${`facet-${key}`}>
                          ${(this.page?.facets[facet] ?? []).map((value) => html`<option .value=${value}></option>`)}
                        </datalist>`
                    : html`<select
                        name=${key}
                        .value=${String(this.filters[key] ?? "")}
                        ?disabled=${!this.page?.facets[facet]?.length}
                        @change=${(event: Event) => {
                          this.filters[key] = (
                            event.target as HTMLSelectElement
                          ).value;
                        }}
                      >
                        <option value="">
                          ${this.page?.facets[facet]?.length ? "All" : "No metadata available"}
                        </option>
                        ${(this.page?.facets[facet] ?? []).map((value) => html`<option .value=${value}>${value}</option>`)}
                      </select>`
                }
              </label>`,
          )}
          <label
            >Watched status<select
              name="library_status"
              .value=${String(this.filters.status ?? "")}
              @change=${(event: Event) => {
                this.filters.status = (event.target as HTMLSelectElement).value;
              }}
            >
              <option value="">All</option>
              ${Object.entries(STATUS).map(([value, label]) => html`<option value=${value}>${label}</option>`)}
            </select></label
          >
          <label
            >Sort by<select
              name="library_sort"
              .value=${String(this.filters.sort)}
              @change=${(event: Event) => {
                this.filters.sort = (event.target as HTMLSelectElement).value;
              }}
            >
              <option value="name">Name</option>
              <option value="length">Length</option>
              <option value="watched">Watched status</option>
            </select></label
          >
          <label
            >Order<select
              name="library_order"
              .value=${this.filters.descending ? "desc" : "asc"}
              @change=${(event: Event) => {
                this.filters.descending =
                  (event.target as HTMLSelectElement).value === "desc";
              }}
            >
              <option value="asc">Ascending</option>
              <option value="desc">Descending</option>
            </select></label
          >
          <button type="submit" ?disabled=${this.loading}>
            Search & filter
          </button>
        </form>
        ${this.page?.truncated_facets.length ? html`<p class="library-note muted">Suggestions show the first 500 names; additional known names can be typed.</p>` : nothing}
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Length</th>
                <th>Status</th>
                <th>Added on</th>
              </tr>
            </thead>
            <tbody>
              ${(this.page?.items ?? []).map(
                (item) =>
                  html`<tr class=${item.id === row?.id ? "selected" : ""}>
                    <td>
                      <button
                        class="link"
                        @click=${() => {
                          this.selected = item;
                          void this.loadCover(item);
                          this.requestUpdate();
                        }}
                      >
                        ${item.title}</button
                      ><small>${item.year ?? ""} ${item.edition}</small>
                    </td>
                    <td>
                      ${item.duration_seconds === null ? "Unknown" : `${(item.duration_seconds / 60).toFixed(2)} min`}
                    </td>
                    <td>${STATUS[item.watched_status]}</td>
                    <td>${this.date(item.first_seen)}</td>
                  </tr>`,
              )}
            </tbody>
          </table>
        </div>
        ${!this.page?.items.length ? html`<p class="empty" role="status">${this.loading ? "Loading library…" : "No cached titles match. Sync the library or adjust your filters."}</p>` : nothing}
        <div class="pagination">
          <small
            >${this.page?.total ?? 0} matching versions · Up to 50 per
            page</small
          >
          <div class="actions">
            <button
              ?disabled=${this.loading || !this.page?.offset}
              @click=${() => this.load()}
            >
              First
            </button>
            <button
              ?disabled=${this.loading || !this.page?.offset}
              @click=${() => this.load(Math.max(0, (this.page?.offset ?? 0) - 50))}
            >
              Previous
            </button>
            <button
              ?disabled=${this.loading || !this.page?.has_more}
              @click=${() => this.load((this.page?.offset ?? 0) + 50)}
            >
              Next
            </button>
          </div>
        </div>
      </section>
      ${
        row
          ? html`<section
              class="card library-title"
              aria-label="Selected library title"
            >
              <div class="playback-layout">
                <div class="cover">
                  ${
                    this.cover
                      ? html`<img
                          src=${this.cover}
                          alt=${`Cover for ${row.title}`}
                          @error=${() => {
                            this.clearCover();
                            this.requestUpdate();
                          }}
                        />`
                      : html`<span>No cached artwork</span>`
                  }
                </div>
                <div>
                  <h2>${row.title}</h2>
                  <p>${row.synopsis || "No synopsis available."}</p>
                  <p class="metadata">
                    ${row.year ?? ""} · ${row.rating || "Unrated"} ·
                    ${row.edition}
                  </p>
                  ${[
                    ["Collections", row.collections],
                    ["Cast", row.actors],
                    ["Directors", row.directors],
                    ["Writers", row.writers],
                    ["Studios", row.studios],
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
                    Added on ${this.date(row.first_seen)} · First detected by
                    Companion; purchase/download date is unknown.
                  </p>
                </div>
              </div>
            </section>`
          : nothing
      }
    </section>`;
  }
}
if (!customElements.get("kaleidescape-library"))
  customElements.define("kaleidescape-library", KaleidescapeLibrary);
