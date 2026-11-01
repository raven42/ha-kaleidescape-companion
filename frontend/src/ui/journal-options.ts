import { responsivePreferences } from "./profile-controller";
/** Personal Journal layout and global search options for both household roles. */
import { LitElement, html, nothing } from "lit";
import type { PropertyValues } from "lit";
import type { JournalClient, Scope } from "../core/api";
import { errorCode, errorMessage } from "../core/api";
import { PreferenceStore } from "./preference-store";
import { styles } from "./styles";
import { closeButton, dismissBackdrop } from "./dialog";

export interface JournalOptionsValue {
  fuzzy_search: boolean;
  view: "list" | "calendar";
  calendar_size: number;
  calendar_fit: boolean;
}

export class JournalOptions extends LitElement {
  constructor() {
    super();
    responsivePreferences(this, () => {
      if (
        !this.ready ||
        this.store?.unsettled ||
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
    status: { type: String },
  };
  static styles = styles;
  client?: JournalClient;
  scope?: Scope;
  disabled = false;
  status = "";
  private store?: PreferenceStore;
  private viewStore?: PreferenceStore;
  private view: "list" | "calendar" = "list";
  private calendarSize = 180;
  private calendarFit = false;
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
    if (key === this.bound && this.client === this.boundClient) return;
    this.clear();
    this.bound = key;
    this.boundClient = this.client;
    void this.load();
  }
  private clear() {
    this.generation++;
    this.store?.dispose();
    this.store = undefined;
    this.viewStore?.dispose();
    this.viewStore = undefined;
    this.view = "list";
    this.calendarSize = 180;
    this.calendarFit = false;
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
          calendar_size: this.calendarSize,
          calendar_fit: this.calendarFit,
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
    this.store?.dispose();
    this.store = new PreferenceStore(
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
      "search",
    );
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
      const [values, journal] = await Promise.all([
        this.store.load(),
        this.viewStore.load(),
      ]);
      if (generation !== this.generation) return;
      this.fuzzy = values.fuzzy_search as boolean;
      this.view = journal.view as "list" | "calendar";
      this.calendarSize = journal.calendar_size as number;
      this.calendarFit = journal.calendar_fit as boolean;
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
    this.store?.retry();
    this.viewStore?.retry();
  }
  protected render() {
    return html`<button
        ?disabled=${!this.ready || this.disabled}
        @click=${() => this.renderRoot.querySelector("dialog")?.showModal()}
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
        <p>
          Changes save automatically for your HA user’s
          ${this.viewStore?.profile} layout.
        </p>
        <label
          >Status<select
            name="filter_status"
            .value=${this.status}
            @change=${(event: Event) => {
              this.status = (event.target as HTMLSelectElement).value;
              this.dispatchEvent(
                new CustomEvent("journal-status", {
                  detail: this.status,
                  bubbles: true,
                  composed: true,
                }),
              );
            }}
          >
            <option value="">All</option>
            <option value="partial">Partial</option>
            <option value="completed">Completed</option>
          </select></label
        >
        <label class="check"
          ><input
            name="journal_fuzzy_search"
            type="checkbox"
            .checked=${this.fuzzy}
            @change=${(event: Event) => {
              this.fuzzy = (event.target as HTMLInputElement).checked;
              this.store?.set({ fuzzy_search: this.fuzzy });
              this.notify();
              this.requestUpdate();
            }}
          />Fuzzy search</label
        >
        <p class="muted">
          Applies across all views for your HA user, including Library search
          and Movie from Library completion. Off matches literal text, ignoring
          case. On also tolerates small spelling mistakes and word order
          differences.
        </p>
        <label class="check"
          ><input
            name="journal_calendar_view"
            type="checkbox"
            .checked=${this.view === "calendar"}
            @change=${(event: Event) => {
              this.view = (event.target as HTMLInputElement).checked
                ? "calendar"
                : "list";
              this.viewStore?.set({ view: this.view });
              this.notify();
              this.requestUpdate();
            }}
          />Calendar view</label
        >
        <p class="muted">
          Show local start and completion dates, with diagonally cut covers for
          cross-day viewings. Off restores the entry list.
        </p>
        ${
          this.view === "calendar"
            ? html`
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
              `
            : nothing
        }
      </dialog>`;
  }
}
if (!customElements.get("kaleidescape-journal-options"))
  customElements.define("kaleidescape-journal-options", JournalOptions);
