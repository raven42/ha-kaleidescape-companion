import { responsivePreferences } from "./profile-controller";
/** Personal Journal layout options for both household roles. */
import { LitElement, css, html, nothing } from "lit";
import type { PropertyValues } from "lit";
import type { JournalClient, JournalInfo, JournalPageSize } from "../core/api";
import { errorCode, errorMessage } from "../core/api";
import { PreferenceStore } from "./preference-store";
import { styles } from "./styles";
import { closeButton, dismissBackdrop } from "./dialog";
import { setUnifiedMovieDialog } from "./movie-dialog-mode";

export interface JournalOptionsValue {
  fuzzy_search: boolean;
  view: "list" | "calendar";
  page_size: JournalPageSize;
  calendar_size: number;
  calendar_fit: boolean;
  calendar_hover_preview: boolean;
  calendar_show_month: boolean;
  calendar_show_year: boolean;
  calendar_show_total: boolean;
  movie_details: "full" | "compact";
}

export class JournalOptions extends LitElement {
  constructor() {
    super();
    responsivePreferences(this, () => {
      if (
        !this.ready ||
        this.viewStore?.unsettled ||
        this.disabled ||
        this.renderRoot.querySelector("dialog[open]")
      )
        return false;
      this.clear();
      void this.load();
      return true;
    });
  }
  static properties = {
    client: { attribute: false },
    scope: { attribute: false },
    disabled: { type: Boolean },
    mobileCompact: { type: Boolean },
    listStatus: {},
    listSort: {},
    listDescending: { type: Boolean },
    showListFilters: { type: Boolean },
  };
  static styles = [
    styles,
    css`
      .view-options {
        display: flex;
        gap: 24px;
        border: 0;
        padding: 0;
        margin: 0 0 16px;
      }
      .view-options .check {
        margin: 0;
      }
      .mobile-list-filters {
        display: none;
      }
      @media (min-width: 701px) {
        dialog:modal {
          --journal-options-top-gap: max(
            calc(var(--companion-viewport-height, 100dvh) * 0.1),
            calc(env(safe-area-inset-top) + 12px)
          );
          inset-block-start: calc(
            var(--companion-viewport-top, 0px) + var(--journal-options-top-gap)
          );
          inset-block-end: auto;
          margin-block: 0;
          max-height: calc(
            var(--companion-viewport-height, 100dvh) - var(
                --journal-options-top-gap
              ) - env(safe-area-inset-bottom) -
              12px
          );
        }
      }
      @media (max-width: 700px) {
        .mobile-list-filters {
          display: grid;
          gap: 10px;
          margin-bottom: 16px;
        }
        .desktop-options {
          display: none;
        }
      }
    `,
  ];
  client?: JournalClient;
  scope?: JournalInfo;
  disabled = false;
  mobileCompact = false;
  listStatus = "";
  listSort = "completed_at";
  listDescending = true;
  showListFilters = false;
  private updateListFilters(
    change: Partial<{ status: string; sort: string; descending: boolean }>,
  ) {
    this.dispatchEvent(
      new CustomEvent("journal-list-filters", {
        detail: {
          status: this.listStatus,
          sort: this.listSort,
          descending: this.listDescending,
          ...change,
        },
        bubbles: true,
        composed: true,
      }),
    );
  }
  private viewStore?: PreferenceStore;
  private view: "list" | "calendar" = "list";
  private pageSize: JournalPageSize = 25;
  private calendarSize = 180;
  private calendarFit = false;
  private hoverPreview = false;
  private calendarTotals = {
    calendar_show_month: true,
    calendar_show_year: true,
    calendar_show_total: true,
  };
  private movieDetails: "full" | "compact" = "full";
  private bound = "";
  private boundClient?: JournalClient;
  private generation = 0;
  private ready = false;
  private fuzzy = true;
  private error = "";
  connectedCallback() {
    super.connectedCallback();
    this.requestUpdate("client");
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    this.clear();
    this.bound = "";
    this.boundClient = undefined;
  }
  protected willUpdate(changed: PropertyValues) {
    if (!changed.has("client") && !changed.has("scope")) return;
    const key = `${this.scope?.entry_id}:${this.scope?.dataset_id}`;
    if (key === this.bound && this.client === this.boundClient) {
      const fuzzy = this.scope?.ui_defaults?.fuzzy_search !== false;
      if (this.ready && this.fuzzy !== fuzzy) {
        this.fuzzy = fuzzy;
        this.notify();
      }
      return;
    }
    this.clear();
    this.bound = key;
    this.boundClient = this.client;
    void this.load();
  }
  private clear() {
    this.generation++;
    this.viewStore?.dispose();
    this.viewStore = undefined;
    this.view = "list";
    this.pageSize = 25;
    this.calendarSize = 180;
    this.calendarFit = false;
    this.hoverPreview = false;
    this.calendarTotals = {
      calendar_show_month: true,
      calendar_show_year: true,
      calendar_show_total: true,
    };
    this.movieDetails = "full";
    this.ready = false;
    this.fuzzy = true;
    this.error = "";
    this.renderRoot.querySelector("dialog")?.close();
  }
  private notify() {
    this.dispatchEvent(
      new CustomEvent("journal-options", {
        detail: {
          fuzzy_search: this.fuzzy,
          view: this.view,
          page_size: this.pageSize,
          calendar_size: this.calendarSize,
          calendar_fit: this.calendarFit,
          calendar_hover_preview: this.hoverPreview,
          ...this.calendarTotals,
          movie_details: this.movieDetails,
        },
        bubbles: true,
        composed: true,
      }),
    );
  }
  private fail(error: unknown) {
    this.error = errorMessage(error);
    if (errorCode(error) === "unauthorized") {
      this.clear();
      this.dispatchEvent(
        new CustomEvent("access-denied", { bubbles: true, composed: true }),
      );
    }
    this.requestUpdate();
  }
  private async load() {
    if (!this.client || !this.scope) return;
    const generation = ++this.generation;
    this.viewStore?.dispose();
    this.viewStore = new PreferenceStore(
      this.client,
      this.scope,
      false,
      (error) => {
        if (generation !== this.generation) return;
        if (error) this.fail(error);
        else {
          this.error = "";
          this.requestUpdate();
        }
      },
      "journal",
    );
    try {
      const journal = await this.viewStore.load();
      if (generation !== this.generation) return;
      this.fuzzy = this.scope.ui_defaults?.fuzzy_search !== false;
      this.view = journal.view as "list" | "calendar";
      this.pageSize = (journal.page_size ?? 25) as JournalPageSize;
      this.calendarSize = journal.calendar_size as number;
      this.calendarFit = journal.calendar_fit as boolean;
      this.hoverPreview = journal.calendar_hover_preview === true;
      this.calendarTotals = {
        calendar_show_month: journal.calendar_show_month !== false,
        calendar_show_year: journal.calendar_show_year !== false,
        calendar_show_total: journal.calendar_show_total !== false,
      };
      this.movieDetails =
        journal.movie_details === "compact" ? "compact" : "full";
      setUnifiedMovieDialog(this.movieDetails === "full");
      this.ready = true;
      this.error = "";
      this.notify();
      this.requestUpdate();
    } catch (error) {
      if (generation === this.generation) this.fail(error);
    }
  }
  private retry() {
    if (!this.ready) return this.load();
    this.viewStore?.retry();
  }
  open() {
    if (this.ready && !this.disabled)
      this.renderRoot.querySelector("dialog")?.showModal();
  }
  protected render() {
    return html`<button
        type="button"
        class=${this.mobileCompact ? "desktop-options" : ""}
        ?disabled=${!this.ready || this.disabled}
        @click=${this.open}
      >
        Options
      </button>
      ${this.error ? html`<span class="error" role="alert">${this.error}<button @click=${this.retry}>Retry Journal options</button></span>` : nothing}
      <dialog
        class="database-dialog"
        aria-labelledby="journal-options-title"
        @click=${dismissBackdrop}
      >
        <div class="card-head">
          <h2 id="journal-options-title">Journal options</h2>
          ${closeButton(() => this.renderRoot.querySelector<HTMLDialogElement>("dialog")?.close())}
        </div>
        <fieldset class="view-options">
          <legend>View type</legend>
          ${(["list", "calendar"] as const).map(
            (view) =>
              html`<label class="check"
                ><input
                  type="radio"
                  name="journal_view"
                  value=${view}
                  .checked=${this.view === view}
                  @change=${() => {
                    this.view = view;
                    this.viewStore?.set({ view });
                    this.notify();
                    this.requestUpdate();
                  }}
                />${view === "list" ? "List" : "Calendar"}</label
              >`,
          )}
        </fieldset>
        <p>
          Changes save automatically for your HA user’s
          ${this.viewStore?.profile} layout.
        </p>
        ${
          this.showListFilters
            ? html`<div class="mobile-list-filters">
                <label
                  >Status<select
                    name="mobile_filter_status"
                    .value=${this.listStatus}
                    @change=${(event: Event) => this.updateListFilters({ status: (event.target as HTMLSelectElement).value })}
                  >
                    <option value="">All</option>
                    <option value="partial">Partial</option>
                    <option value="completed">Completed</option>
                  </select></label
                >
                <label
                  >Sort by<select
                    name="mobile_journal_sort"
                    .value=${this.listSort}
                    @change=${(event: Event) => this.updateListFilters({ sort: (event.target as HTMLSelectElement).value })}
                  >
                    <option value="completed_at">
                      Completed date · partial first
                    </option>
                    <option value="title">Title</option>
                  </select></label
                >
                <button
                  type="button"
                  @click=${() => this.updateListFilters({ descending: !this.listDescending })}
                >
                  ${this.listDescending ? "Descending ↓" : "Ascending ↑"}
                </button>
              </div>`
            : nothing
        }
        ${
          this.view === "list"
            ? html`<label
                >Entries per page<select
                  name="journal_page_size"
                  .value=${String(this.pageSize)}
                  @change=${(event: Event) => {
                    const raw = (event.target as HTMLSelectElement).value;
                    this.pageSize = (
                      raw === "all" ? "all" : Number(raw)
                    ) as JournalPageSize;
                    this.viewStore?.set({ page_size: this.pageSize });
                    this.notify();
                    this.requestUpdate();
                  }}
                >
                  ${([10, 25, 100, 500, "all"] as const).map((value) => html`<option value=${value} ?selected=${value === this.pageSize}>${value === "all" ? "All" : value}</option>`)}
                </select></label
              >`
            : nothing
        }
        ${
          this.view === "calendar"
            ? html`
                <label
                  >Movie details<select
                    name="journal_movie_details"
                    .value=${this.movieDetails}
                    @change=${(event: Event) => {
                      this.movieDetails =
                        (event.target as HTMLSelectElement).value === "compact"
                          ? "compact"
                          : "full";
                      this.viewStore?.set({ movie_details: this.movieDetails });
                      setUnifiedMovieDialog(this.movieDetails === "full");
                      this.notify();
                      this.requestUpdate();
                    }}
                  >
                    <option
                      value="full"
                      ?selected=${this.movieDetails === "full"}
                    >
                      Full movie details
                    </option>
                    <option
                      value="compact"
                      ?selected=${this.movieDetails === "compact"}
                    >
                      Compact movie details
                    </option>
                  </select></label
                >
                <p class="muted">
                  Show local start and completion dates, with diagonally cut
                  covers for cross-day viewings.
                </p>
                <label
                  >Calendar size · ${this.calendarSize} px
                  <input
                    name="journal_calendar_size"
                    type="range"
                    min="60"
                    max="320"
                    step="1"
                    .value=${String(this.calendarSize)}
                    ?disabled=${this.calendarFit}
                    @input=${(event: Event) => {
                      this.calendarSize = Number(
                        (event.target as HTMLInputElement).value,
                      );
                      this.notify();
                      this.requestUpdate();
                    }}
                    @change=${() => this.viewStore?.set({ calendar_size: this.calendarSize })}
                  />
                </label>
                <label class="check"
                  ><input
                    name="journal_calendar_fit"
                    type="checkbox"
                    .checked=${this.calendarFit}
                    @change=${(event: Event) => {
                      this.calendarFit = (
                        event.target as HTMLInputElement
                      ).checked;
                      this.viewStore?.set({ calendar_fit: this.calendarFit });
                      this.notify();
                      this.requestUpdate();
                    }}
                  />Fit month to screen</label
                >
                <p class="muted">
                  Size controls the day rows and covers. Fit uses the available
                  screen height; very small screens may still need scrolling.
                </p>
                <label class="check"
                  ><input
                    name="calendar_hover_preview"
                    type="checkbox"
                    .checked=${this.hoverPreview}
                    @change=${(event: Event) => {
                      this.hoverPreview = (
                        event.target as HTMLInputElement
                      ).checked;
                      this.viewStore?.set({
                        calendar_hover_preview: this.hoverPreview,
                      });
                      this.notify();
                      this.requestUpdate();
                    }}
                  />Show movie preview on hover or focus</label
                >
                <p>Calendar viewing totals</p>
                ${(
                  [
                    ["calendar_show_month", "Month viewings"],
                    ["calendar_show_year", "Yearly viewings"],
                    ["calendar_show_total", "Total viewings"],
                  ] as const
                ).map(
                  ([key, label]) =>
                    html`<label class="check"
                      ><input
                        name=${key}
                        type="checkbox"
                        .checked=${this.calendarTotals[key]}
                        @change=${(event: Event) => {
                          const value = (event.target as HTMLInputElement)
                            .checked;
                          this.calendarTotals = {
                            ...this.calendarTotals,
                            [key]: value,
                          };
                          this.viewStore?.set({ [key]: value });
                          this.notify();
                          this.requestUpdate();
                        }}
                      />${label}</label
                    >`,
                )}
              `
            : nothing
        }
      </dialog>`;
  }
}
if (!customElements.get("kaleidescape-journal-options"))
  customElements.define("kaleidescape-journal-options", JournalOptions);
