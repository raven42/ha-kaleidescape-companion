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
import { counted } from "../core/text";
import { CoverQueue } from "../library/cover";
import { renderFormatBadges, renderRatingBadge } from "../library/badges";
import { libraryStyles } from "../library/styles";
import { styles } from "./styles";
import { calendarStyles } from "./journal-calendar.styles";
import { dismissBackdrop } from "./dialog";

export function dayKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function monthBounds(month: Date) {
  return [
    new Date(month.getFullYear(), month.getMonth(), 1).toISOString(),
    new Date(month.getFullYear(), month.getMonth() + 1, 1).toISOString(),
  ];
}

export class JournalCalendar extends LitElement {
  static properties = {
    client: { attribute: false },
    scope: { attribute: false },
    query: { type: String },
    status: { type: String },
    fuzzy: { type: Boolean },
    libraryTitleId: { attribute: false },
  };
  static styles = [styles, libraryStyles, calendarStyles];
  client?: JournalClient;
  scope?: JournalInfo;
  query = "";
  status = "";
  fuzzy = true;
  libraryTitleId?: string;
  private month = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  private items: CalendarViewing[] = [];
  private loading = false;
  private error = "";
  private generation = 0;
  private signature = "";
  private privacy = "";
  private boundClient?: JournalClient;
  private queue = new CoverQueue();
  private selected?: ViewingSummary;
  private selectedArtwork: string | null = null;
  private movie: CalendarMovie | null = null;
  private detailRequest = 0;
  private detailLoading = false;
  private detailError = "";
  protected willUpdate() {
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
    this.loading = true;
    this.error = "";
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
      if (generation === this.generation) this.items = result.items;
    } catch (error) {
      if (generation === this.generation) this.fail(error);
    } finally {
      if (generation === this.generation) {
        this.loading = false;
        this.requestUpdate();
      }
    }
  }
  private move(delta: number) {
    this.month = new Date(
      this.month.getFullYear(),
      this.month.getMonth() + delta,
      1,
    );
    this.requestUpdate();
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
  private renderDetails() {
    const viewing = this.selected,
      movie = this.movie;
    const start = viewing ? new Date(viewing.started_at) : null;
    const end = viewing?.ended_at ? new Date(viewing.ended_at) : null;
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
          ${viewing?.title ?? "Viewing details"}
        </h2>
        <button
          @click=${() => {
            this.closeDetails();
            this.requestUpdate();
          }}
        >
          Close
        </button>
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
                    ? html`<div class="movie-badges">
                          ${renderFormatBadges(movie)}${renderRatingBadge(movie.rating ?? "")}
                        </div>
                        ${movie.year ? html`<p><strong>Year:</strong> ${movie.year}</p>` : nothing}
                        ${[
                          ["Cast", movie.actors],
                          ["Directors", movie.directors],
                          ["Genres", movie.genres],
                        ].map(([label, names]) =>
                          (names as string[] | null)?.length
                            ? html`<p>
                                <strong>${label}:</strong>
                                ${(names as string[]).join(", ")}
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
    const byDay = new Map<string, CalendarViewing[]>();
    for (const row of this.items) {
      const key = dayKey(new Date(row.started_at));
      byDay.set(key, [...(byDay.get(key) ?? []), row]);
    }
    return html`<div class="month-bar">
        <button
          aria-label="Previous month"
          ?disabled=${year <= 100 && month === 0}
          @click=${() => this.move(-1)}
        >
          ←
        </button>
        <h2 aria-live="polite">
          ${this.month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
        </h2>
        <button
          aria-label="Next month"
          ?disabled=${year >= 9998 && month === 11}
          @click=${() => this.move(1)}
        >
          →
        </button>
      </div>
      ${this.error ? html`<p class="error" role="alert">${this.error} <button @click=${this.load}>Retry month</button></p>` : nothing}
      ${this.loading ? html`<p class="month-status" role="status">Loading month…</p>` : nothing}
      <div class="calendar-scroll">
        <div
          class="month-grid"
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
                        (row) => row.id,
                        (row, index) =>
                          html`<button
                            class="poster"
                            style=${`--index:${index};--layer:${index + 1}`}
                            aria-label=${`${row.title} · ${row.status === "completed" ? "Completed" : "Partial"}`}
                            title=${row.title}
                            @click=${() => this.select(row, row.artwork_key)}
                          >
                            <kaleidescape-library-cover
                              .client=${this.client}
                              .scope=${this.scope}
                              .queue=${this.queue}
                              .artworkKey=${row.artwork_key}
                              .title=${row.title}
                              @access-denied=${() => this.fail({ code: "unauthorized" })}
                            ></kaleidescape-library-cover>
                            ${!row.artwork_key ? html`<span class="poster-title">${row.title}</span>` : nothing}
                          </button>`,
                      )}
                    </div>`
                  : nothing
              }
            </section>`;
          })}
        </div>
      </div>
      <p class="month-status">
        ${counted(this.items.length, "viewing")} · Local start
        dates${!this.loading && !this.items.length && !this.error ? " · No viewings match this month" : ""}
      </p>
      ${this.renderDetails()}`;
  }
}
if (!customElements.get("kaleidescape-journal-calendar"))
  customElements.define("kaleidescape-journal-calendar", JournalCalendar);
