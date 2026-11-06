/** Local month browsing and compact viewing/movie details; no calendar provider writes. */
import { LitElement, html, nothing } from "lit";
import { repeat } from "lit/directives/repeat.js";
import type {
  JournalClient,
  JournalInfo,
  CalendarViewing,
  CalendarMovie,
  ViewingSummary,
} from "../core/api";
import { errorCode, errorMessage } from "../core/api";
import { CoverQueue } from "../library/cover";
import { renderFormatBadges, renderRatingBadge } from "../library/badges";
import { libraryStyles } from "../library/styles";
import type { LibraryCriterion } from "../library/criteria";
import { styles } from "./styles";
import type { CalendarStatus } from "./journal-view";
import { calendarStyles } from "./journal-calendar.styles";
import { closeButton, dismissBackdrop } from "./dialog";

export function dayKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function calendarMonth(
  search = location.search,
  now = new Date(),
): Date {
  const value = new URLSearchParams(search).get("companion_month") ?? "";
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) {
    const [year, month] = value.split("-").map(Number);
    if (year >= 100 && year <= 9998) return new Date(year, month - 1, 1);
  }
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

export function monthBounds(month: Date) {
  return [
    new Date(month.getFullYear(), month.getMonth(), 1).toISOString(),
    new Date(month.getFullYear(), month.getMonth() + 1, 1).toISOString(),
  ];
}

/** Endpoint markers use local dates, including viewings crossing month boundaries. */
export function calendarDays(
  row: Pick<
    CalendarViewing,
    "started_at" | "ended_at" | "completed_at" | "status"
  >,
) {
  const start = dayKey(new Date(row.started_at));
  const endpoint = row.ended_at ?? row.completed_at;
  const end = endpoint ? dayKey(new Date(endpoint)) : start;
  return row.status === "completed" &&
    end !== start &&
    endpoint &&
    new Date(endpoint) > new Date(row.started_at)
    ? [
        { day: start, phase: "start" },
        { day: end, phase: "completion" },
      ]
    : [{ day: start, phase: "single" }];
}

export class JournalCalendar extends LitElement {
  static properties = {
    client: { attribute: false },
    scope: { attribute: false },
    query: { type: String },
    status: { type: String },
    fuzzy: { type: Boolean },
    libraryTitleId: { attribute: false },
    daySize: { type: Number },
    fitScreen: { type: Boolean },
    disabled: { type: Boolean },
    editable: { type: Boolean },
    rememberUrl: { type: Boolean },
  };
  static styles = [styles, libraryStyles, calendarStyles];
  client?: JournalClient;
  scope?: JournalInfo;
  query = "";
  status = "";
  fuzzy = true;
  libraryTitleId?: string;
  daySize = 180;
  fitScreen = false;
  disabled = false;
  // Only the administrator host connects the shared Journal editor.
  editable = false;
  rememberUrl = true;
  private fittedSize = 180;
  private resizeObserver?: ResizeObserver;
  private layoutFrame?: number;
  private month = calendarMonth();
  private items: CalendarViewing[] = [];
  private totals?: { viewing_count: number; watched_seconds: number };
  private loading = false;
  private error = "";
  private generation = 0;
  private signature = "";
  private privacy = "";
  private boundClient?: JournalClient;
  private queue = new CoverQueue();
  private selected?: ViewingSummary & { completed_at?: string | null };
  private selectedArtwork: string | null = null;
  private movie: CalendarMovie | null = null;
  private detailRequest = 0;
  private detailLoading = false;
  private detailError = "";
  connectedCallback() {
    super.connectedCallback();
    window.addEventListener("resize", this.scheduleLayout);
    window.visualViewport?.addEventListener("resize", this.scheduleLayout);
    this.rememberMonth();
    this.requestUpdate();
  }
  protected updated() {
    if (!this.isConnected) return;
    if (!this.resizeObserver) {
      this.resizeObserver = new ResizeObserver(this.scheduleLayout);
      this.resizeObserver.observe(this);
      // The surrounding sticky search/header and footer consume viewport space.
      if (this.previousElementSibling)
        this.resizeObserver.observe(this.previousElementSibling);
      if (this.nextElementSibling)
        this.resizeObserver.observe(this.nextElementSibling);
    }
    this.scheduleLayout();
  }
  private scheduleLayout = () => {
    if (!this.fitScreen || !this.isConnected || this.layoutFrame !== undefined)
      return;
    this.layoutFrame = requestAnimationFrame(() => {
      this.layoutFrame = undefined;
      if (!this.fitScreen || !this.isConnected) return;
      const viewport = window.visualViewport?.height ?? window.innerHeight;
      const top = Math.max(
        0,
        this.getBoundingClientRect().top,
        this.previousElementSibling?.getBoundingClientRect().bottom ?? 0,
      );
      const main = this.closest("main");
      const reserve =
        [".month-bar", ".weekday"].reduce(
          (height, selector) =>
            height +
            (this.renderRoot.querySelector(selector)?.getBoundingClientRect()
              .height ?? 0),
          0,
        ) +
        (this.nextElementSibling?.getBoundingClientRect().height ?? 0) +
        (main ? parseFloat(getComputedStyle(main).paddingBottom) || 0 : 0) +
        16;
      const first = new Date(
        this.month.getFullYear(),
        this.month.getMonth(),
        1,
      );
      const days = new Date(
        this.month.getFullYear(),
        this.month.getMonth() + 1,
        0,
      ).getDate();
      const weeks = Math.ceil((first.getDay() + days) / 7);
      const size = Math.max(48, Math.floor((viewport - top - reserve) / weeks));
      if (size !== this.fittedSize) {
        this.fittedSize = size;
        this.requestUpdate();
      }
    });
  };
  protected willUpdate() {
    if (!this.isConnected) return;
    const privacy = `${this.scope?.entry_id}:${this.scope?.dataset_id}:${this.scope?.library_enabled}:${this.scope?.permissions.edit}`;
    if (privacy !== this.privacy || this.client !== this.boundClient) {
      this.clear();
      this.privacy = privacy;
      this.boundClient = this.client;
    }
    const signature = JSON.stringify([
      privacy,
      this.scope?.revision,
      this.query,
      this.status,
      this.fuzzy,
      this.libraryTitleId,
      this.month.getTime(),
    ]);
    if (signature === this.signature) return;
    this.signature = signature;
    void this.load();
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener("resize", this.scheduleLayout);
    window.visualViewport?.removeEventListener("resize", this.scheduleLayout);
    this.resizeObserver?.disconnect();
    this.resizeObserver = undefined;
    if (this.layoutFrame !== undefined) cancelAnimationFrame(this.layoutFrame);
    this.layoutFrame = undefined;
    this.clear();
    this.signature = this.privacy = "";
    this.boundClient = undefined;
  }
  private clear() {
    this.generation++;
    this.closeDetails();
    this.items = [];
    this.error = "";
    this.loading = false;
    this.queue.cache.dispose();
    this.queue = new CoverQueue();
  }
  private fail(error: unknown) {
    if (errorCode(error) === "unauthorized") {
      this.clear();
      this.dispatchEvent(
        new CustomEvent("access-denied", { bubbles: true, composed: true }),
      );
    }
    this.error = errorMessage(error);
    this.requestUpdate();
  }
  private async load() {
    if (!this.client || !this.scope) return;
    const generation = ++this.generation;
    this.closeDetails();
    this.items = [];
    this.totals = undefined;
    this.loading = true;
    this.error = "";
    this.notifyStatus();
    this.requestUpdate();
    try {
      const [start, end] = monthBounds(this.month);
      const result = await this.client.calendarMonth(
        this.scope,
        start,
        end,
        this.query,
        this.status,
        this.fuzzy,
        this.libraryTitleId,
      );
      if (generation === this.generation) {
        this.items = result.items;
        this.totals = result.summary;
      }
    } catch (error) {
      if (generation === this.generation) this.fail(error);
    } finally {
      if (generation === this.generation) {
        this.loading = false;
        this.notifyStatus();
        this.requestUpdate();
      }
    }
  }
  /** Footer status is owned by the enclosing Journal, not a second calendar bar. */
  private notifyStatus() {
    if (!this.isConnected) return;
    const detail: CalendarStatus = {
      month: this.month.toLocaleDateString(undefined, {
        month: "long",
        year: "numeric",
      }),
      count: this.totals?.viewing_count,
      watchedSeconds: this.totals?.watched_seconds,
      loading: this.loading,
      error: this.error,
      empty: !this.items.length,
    };
    this.dispatchEvent(
      new CustomEvent("calendar-status", {
        detail,
        bubbles: true,
        composed: true,
      }),
    );
  }
  refresh() {
    return this.load();
  }
  private move(delta: number) {
    this.month = new Date(
      this.month.getFullYear(),
      this.month.getMonth() + delta,
      1,
    );
    this.rememberMonth();
    this.requestUpdate();
  }
  private today() {
    const now = new Date();
    this.month = new Date(now.getFullYear(), now.getMonth(), 1);
    this.rememberMonth();
    this.requestUpdate();
  }
  private rememberMonth() {
    if (!this.rememberUrl) return;
    const url = new URL(location.href);
    url.searchParams.set(
      "companion_month",
      `${String(this.month.getFullYear()).padStart(4, "0")}-${String(this.month.getMonth() + 1).padStart(2, "0")}`,
    );
    history.replaceState(history.state, "", url);
  }
  private closeDetails() {
    this.detailRequest++;
    this.selected = undefined;
    this.movie = null;
    this.selectedArtwork = null;
    this.detailLoading = false;
    this.detailError = "";
    this.renderRoot.querySelector("dialog")?.close();
  }
  private async select(row: ViewingSummary, artwork: string | null = null) {
    if (!this.client || !this.scope) return;
    const generation = this.generation,
      request = ++this.detailRequest;
    this.selected = row;
    this.selectedArtwork = artwork;
    this.movie = null;
    this.detailLoading = true;
    this.detailError = "";
    this.requestUpdate();
    await this.updateComplete;
    if (
      generation !== this.generation ||
      request !== this.detailRequest ||
      !this.isConnected
    )
      return;
    this.renderRoot.querySelector<HTMLDialogElement>("dialog")?.showModal();
    try {
      const result = await this.client.calendarDetails(this.scope, row.id);
      if (generation === this.generation && request === this.detailRequest) {
        this.selected = result.viewing;
        this.movie = result.movie;
        this.selectedArtwork = result.movie?.artwork_key ?? artwork;
      }
    } catch (error) {
      if (generation === this.generation && request === this.detailRequest) {
        if (errorCode(error) === "unauthorized") this.fail(error);
        else this.detailError = errorMessage(error);
      }
    } finally {
      if (generation === this.generation && request === this.detailRequest) {
        this.detailLoading = false;
        this.requestUpdate();
      }
    }
  }
  private browse(key: LibraryCriterion["key"], value: string) {
    if (!this.scope?.library_enabled || !this.movie) return;
    this.closeDetails();
    this.dispatchEvent(
      new CustomEvent<LibraryCriterion>("browse-library", {
        detail: { key, value },
        bubbles: true,
        composed: true,
      }),
    );
    this.requestUpdate();
  }
  private editViewing() {
    if (
      !this.selected ||
      !this.editable ||
      !this.scope?.permissions.edit ||
      this.disabled ||
      this.detailLoading
    )
      return;
    const id = this.selected.id;
    this.closeDetails();
    this.dispatchEvent(
      new CustomEvent<string>("edit-viewing", {
        detail: id,
        bubbles: true,
        composed: true,
      }),
    );
    this.requestUpdate();
  }
  private detailLink(key: LibraryCriterion["key"], value: string) {
    return html`<button
      type="button"
      class="link detail-link"
      @click=${() => this.browse(key, key === "query" ? JSON.stringify(value) : value)}
    >
      ${value}
    </button>`;
  }
  private renderDetails() {
    const viewing = this.selected,
      movie = this.movie;
    const start = viewing ? new Date(viewing.started_at) : null;
    const endpoint = viewing?.ended_at ?? viewing?.completed_at;
    const end = endpoint ? new Date(endpoint) : null;
    const different = start && end && dayKey(start) !== dayKey(end);
    const runtime = movie?.duration_seconds ?? viewing?.duration_seconds;
    return html`<dialog
      class="database-dialog calendar-dialog"
      aria-labelledby="calendar-movie-title"
      @click=${dismissBackdrop}
      @close=${(event: Event) => {
        if (!(event.target as HTMLDialogElement).open) {
          this.closeDetails();
          this.requestUpdate();
        }
      }}
    >
      <div class="card-head">
        <h2 id="calendar-movie-title">
          ${viewing && movie ? this.detailLink("query", viewing.title) : (viewing?.title ?? "Viewing details")}
        </h2>
        ${closeButton(() => {
          this.closeDetails();
          this.requestUpdate();
        })}
      </div>
      ${
        viewing
          ? html`<div class="movie-detail">
              <kaleidescape-library-cover
                .client=${this.client}
                .scope=${this.scope}
                .queue=${this.queue}
                .artworkKey=${this.selectedArtwork}
                .title=${viewing.title}
                @access-denied=${() => this.fail({ code: "unauthorized" })}
              ></kaleidescape-library-cover>
              <div>
                ${this.detailLoading ? html`<p role="status">Loading movie details…</p>` : nothing}
                ${this.detailError ? html`<p class="error" role="alert">${this.detailError} <button @click=${() => this.select(viewing, this.selectedArtwork)}>Retry details</button></p>` : nothing}
                ${
                  movie
                    ? html`<div class="detail-badges">
                          ${renderFormatBadges(movie, false, (value) => this.browse("format", value))}${renderRatingBadge(movie.rating ?? "", (value) => this.browse("rating", value))}
                        </div>
                        ${movie.year ? html`<p><strong>Year:</strong> ${this.detailLink("year", String(movie.year))}</p>` : nothing}
                        ${[
                          ["Cast", movie.actors],
                          ["Directors", movie.directors],
                          ["Genres", movie.genres],
                        ].map(([label, names]) =>
                          (names as string[] | null)?.length
                            ? html`<p>
                                <strong>${label}:</strong>
                                ${(names as string[]).map((name, index) => html`${index ? ", " : ""}${this.detailLink(label === "Genres" ? "genre" : "query", name)}`)}
                              </p>`
                            : nothing,
                        )}`
                    : !this.detailLoading && !this.detailError
                      ? html`<p class="muted">
                          No linked Library metadata is available.
                        </p>`
                      : nothing
                }
                ${runtime != null ? html`<p><strong>Runtime:</strong> ${(runtime / 60).toFixed(2)} min</p>` : nothing}
                <p>
                  <strong
                    >${different ? "Viewing dates" : "Viewing date"}:</strong
                  >
                  ${start?.toLocaleDateString()}${different ? ` – ${end!.toLocaleDateString()}` : ""}
                </p>
                <p>
                  <strong>Watched:</strong>
                  ${(viewing.watched_seconds / 60).toFixed(2)} min ·
                  ${viewing.status === "completed" ? "Completed" : "Partial"}
                </p>
              </div>
            </div>`
          : nothing
      }
      ${
        viewing && this.editable && this.scope?.permissions.edit
          ? html`<div class="dialog-footer">
              <button
                class="primary"
                ?disabled=${this.disabled || this.detailLoading}
                @click=${this.editViewing}
              >
                Edit viewing
              </button>
            </div>`
          : nothing
      }
    </dialog>`;
  }
  protected render() {
    const year = this.month.getFullYear(),
      month = this.month.getMonth();
    const first = new Date(year, month, 1),
      days = new Date(year, month + 1, 0).getDate();
    const count = Math.ceil((first.getDay() + days) / 7) * 7;
    const cells = Array.from(
      { length: count },
      (_, index) => new Date(year, month, index - first.getDay() + 1),
    );
    const byDay = new Map<string, { row: CalendarViewing; phase: string }[]>();
    for (const row of this.items) {
      for (const { day, phase } of calendarDays(row))
        byDay.set(day, [...(byDay.get(day) ?? []), { row, phase }]);
    }
    return html`<div class="month-bar">
        <button
          aria-label="Previous month"
          ?disabled=${this.disabled || (year <= 100 && month === 0)}
          @click=${() => this.move(-1)}
        >
          ←
        </button>
        <h2 aria-live="polite">
          ${this.month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
        </h2>
        <button
          aria-label="Next month"
          ?disabled=${this.disabled || (year >= 9998 && month === 11)}
          @click=${() => this.move(1)}
        >
          →
        </button>
        <button
          type="button"
          aria-label="Go to current month"
          ?disabled=${this.disabled}
          @click=${this.today}
        >
          Today
        </button>
      </div>
      <div class="calendar-scroll">
        <div
          class="month-grid"
          style=${`--calendar-day-size:${this.fitScreen ? this.fittedSize : this.daySize}px`}
          aria-label="Viewing calendar"
          aria-busy=${this.loading}
        >
          ${Array.from({ length: 7 }, (_, i) => html`<div class="weekday">${new Date(2023, 0, 1 + i).toLocaleDateString(undefined, { weekday: "short" })}</div>`)}
          ${cells.map((date) => {
            const key = dayKey(date),
              rows = byDay.get(key) ?? [];
            return html`<section
              class=${`day${date.getMonth() !== month ? " other-month" : ""}${key === dayKey(new Date()) ? " today" : ""}`}
              aria-label=${date.toLocaleDateString()}
            >
              <time datetime=${key}>${date.getDate()}</time>
              ${
                rows.length
                  ? html`<div
                      class="cover-stack"
                      style=${`--spread:${1 + (rows.length - 1) * 0.15}`}
                    >
                      ${repeat(
                        rows,
                        ({ row }) => row.id,
                        ({ row, phase }, index) =>
                          html`<button
                            class=${`poster poster-${phase}`}
                            style=${`--index:${index};--layer:${index + 1}`}
                            aria-label=${`${row.title} · ${phase === "start" ? "Started; completed on another day" : phase === "completion" ? "Completed; started on another day" : row.status === "completed" ? "Completed" : "Partial"}`}
                            title=${row.title}
                            ?disabled=${this.disabled}
                            @click=${() => this.select(row, row.artwork_key)}
                          >
                            <span class="poster-art"
                              ><kaleidescape-library-cover
                                .client=${this.client}
                                .scope=${this.scope}
                                .queue=${this.queue}
                                .artworkKey=${row.artwork_key}
                                .title=${row.title}
                                @access-denied=${() => this.fail({ code: "unauthorized" })}
                              ></kaleidescape-library-cover>
                              ${!row.artwork_key ? html`<span class="poster-title">${row.title}</span>` : nothing}</span
                            >
                          </button>`,
                      )}
                    </div>`
                  : nothing
              }
            </section>`;
          })}
        </div>
      </div>
      ${this.renderDetails()}`;
  }
}
if (!customElements.get("kaleidescape-journal-calendar"))
  customElements.define("kaleidescape-journal-calendar", JournalCalendar);
