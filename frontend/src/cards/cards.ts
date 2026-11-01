/** HA dashboard adapters around the household UI; no new privileged API surface. */
import { LitElement, css, html, nothing } from "lit";
import type { PropertyValues } from "lit";
import { ApiError, JournalClient, errorMessage } from "../core/api";
import type { Hass, JournalInfo } from "../core/api";
import { styles } from "../ui/styles";
import { closeButton, dismissBackdrop } from "../ui/dialog";
import { calendarNotice, journalTotals } from "../ui/journal-view";
import type { CalendarStatus } from "../ui/journal-view";
import type { JournalCalendar } from "../ui/journal-calendar";
import type { KaleidescapeLibrary } from "../library/library";
import type { LibraryCriterion } from "../library/criteria";
import "../library/library";
import "../playback/controls";
import "../playback/now-playing";
import "../ui/journal-calendar";
import { CARD_KINDS, cardConfig, cardForm } from "./config";
import type { CardConfig, CardKind } from "./config";

const SEARCH_EVENT = "kaleidescape-companion-card-search";
export class CompanionCard extends LitElement {
  static kind: CardKind = "library";
  static properties = { hass: { attribute: false } };
  static styles = [
    styles,
    css`
      :host {
        display: block;
        min-width: 0;
      }
      ha-card {
        display: block;
        overflow: visible;
      }
      h2.card-title {
        padding: 12px 16px 0;
        margin: 0;
        font-size: 20px;
      }
      .message,
      .calendar-footer {
        padding: 12px 16px;
      }
      .search {
        display: flex;
        align-items: end;
        gap: 8px;
        flex-wrap: wrap;
        padding: 12px;
      }
      .search label {
        flex: 1;
        min-width: min(180px, 100%);
      }
      .search button {
        min-height: 44px;
      }
      .remote {
        max-width: 410px;
        margin: auto;
      }
      .calendar-footer {
        position: sticky;
        bottom: 0;
        z-index: 5;
        background: var(--surface);
        border-top: 1px solid var(--line);
        font-size: 12px;
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      dialog {
        width: min(1120px, calc(100% - 24px));
      }
    `,
  ];
  hass?: Hass;
  private config?: CardConfig;
  private api?: JournalClient;
  private scope?: JournalInfo;
  private boundConnection?: Hass["connection"];
  private identity = "";
  private generation = 0;
  private timer?: ReturnType<typeof setTimeout>;
  private error = "";
  private query = "";
  private criterion?: LibraryCriterion;
  private calendarStatus?: CalendarStatus;
  private popupCriterion?: LibraryCriterion;
  private locked = false;
  private get kind() {
    return (this.constructor as typeof CompanionCard).kind;
  }
  static getStubConfig() {
    return { channel: "main" };
  }
  static getConfigForm() {
    return cardForm(this.kind);
  }
  getCardSize() {
    return this.kind === "library-search" ? 2 : this.kind === "remote" ? 9 : 7;
  }
  getGridOptions() {
    return {
      columns:
        this.kind === "library" || this.kind === "journal-calendar" ? 24 : 12,
      min_columns: 6,
      rows: "auto",
    };
  }
  setConfig(value: Record<string, unknown>) {
    if (this.locked)
      throw new Error(
        "Finish the pending player command before reconfiguring this card.",
      );
    if (!value || typeof value !== "object")
      throw new Error("Card configuration is required");
    this.config = cardConfig(value, this.kind);
    this.reset();
    this.requestUpdate("hass");
  }
  connectedCallback() {
    super.connectedCallback();
    window.addEventListener(SEARCH_EVENT, this.receiveSearch);
    document.addEventListener("visibilitychange", this.visibility);
    this.requestUpdate("hass");
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener(SEARCH_EVENT, this.receiveSearch);
    document.removeEventListener("visibilitychange", this.visibility);
    this.reset();
  }
  private reset() {
    this.generation++;
    clearTimeout(this.timer);
    this.api = undefined;
    this.scope = undefined;
    this.identity = "";
    this.boundConnection = undefined;
    this.criterion = this.popupCriterion = undefined;
    this.calendarStatus = undefined;
    this.query = this.error = "";
    this.locked = false;
    this.renderRoot?.querySelector("dialog")?.close();
  }
  protected willUpdate(changed: PropertyValues) {
    if (!changed.has("hass") || !this.config) return;
    const identity = `${this.hass?.user?.id}:${this.hass?.user?.is_admin}:${this.hass?.connection.connected}`;
    if (
      identity === this.identity &&
      this.hass?.connection === this.boundConnection
    )
      return;
    this.reset();
    this.identity = identity;
    this.boundConnection = this.hass?.connection;
    if (!this.hass?.connection.connected || !this.hass.user) return;
    this.api = new JournalClient({
      callWS: (message) => this.hass!.callWS(message),
      fetchWithAuth: (path, init) => this.hass!.fetchWithAuth(path, init),
    });
    void this.refresh();
  }
  private visibility = () => {
    clearTimeout(this.timer);
    if (!document.hidden && this.api) void this.refresh();
  };
  private async refresh() {
    if (!this.api || !this.config || !this.isConnected || document.hidden)
      return;
    clearTimeout(this.timer);
    const generation = this.generation;
    try {
      const data = await this.api.info();
      if (generation !== this.generation) return;
      const scope = this.config.entry_id
        ? data.entries.find((row) => row.entry_id === this.config!.entry_id)
        : data.entries[0];
      if (!scope?.permissions.read || scope.api_version !== 1)
        throw new ApiError("not_ready");
      // Dashboard presentation is always household-safe, even for administrators.
      this.scope = {
        ...scope,
        permissions: { read: true, edit: false, export: false },
      };
      this.error = "";
    } catch (error) {
      if (generation !== this.generation) return;
      this.scope = undefined;
      this.error = errorMessage(error);
    } finally {
      if (generation === this.generation) {
        this.requestUpdate();
        this.timer = setTimeout(() => void this.refresh(), 30000);
      }
    }
  }
  private deny() {
    this.reset();
    this.error =
      "Access to Companion is unavailable. Check your HA account and integration.";
    this.requestUpdate();
  }
  private receiveSearch = (event: Event) => {
    if (
      !this.scope ||
      !this.config ||
      !["library", "library-covers"].includes(this.kind) ||
      this.locked
    )
      return;
    const data = (event as CustomEvent).detail;
    if (
      data?.entry !== this.scope.entry_id ||
      data?.dataset !== this.scope.dataset_id ||
      data?.channel !== this.config.channel ||
      typeof data?.query !== "string" ||
      data.query.length > 500
    )
      return;
    this.criterion = { key: "query", value: data.query };
    this.requestUpdate();
  };
  private search(event: Event) {
    event.preventDefault();
    if (!this.scope || !this.config) return;
    window.dispatchEvent(
      new CustomEvent(SEARCH_EVENT, {
        detail: {
          entry: this.scope.entry_id,
          dataset: this.scope.dataset_id,
          channel: this.config.channel,
          query: this.query,
        },
      }),
    );
  }
  private async browse(criterion: LibraryCriterion) {
    this.popupCriterion = criterion;
    this.requestUpdate();
    await this.updateComplete;
    this.renderRoot.querySelector<HTMLDialogElement>("dialog")?.showModal();
  }
  private closePopup(event?: Event) {
    const popup = this.renderRoot.querySelector<HTMLDialogElement>("dialog");
    if (
      this.locked ||
      !(
        popup
          ?.querySelector<KaleidescapeLibrary>("kaleidescape-library")
          ?.confirmNavigation() ?? true
      )
    ) {
      event?.preventDefault();
      return;
    }
    popup?.close();
  }
  protected render() {
    if (!this.config) return nothing;
    const c = this.config;
    const library = () =>
      html`<kaleidescape-library
        .client=${this.api}
        .scope=${this.scope}
        .dashboard=${c}
        .openCriterion=${this.criterion}
      ></kaleidescape-library>`;
    return html`<ha-card
      @access-denied=${this.deny}
      @control-lock=${(event: CustomEvent<boolean>) => {
        if (this.locked !== event.detail) {
          this.locked = event.detail;
          this.requestUpdate();
        }
      }}
    >
      ${c.title ? html`<h2 class="card-title">${c.title}</h2>` : nothing}
      ${
        this.error
          ? html`<p class="message error" role="alert">
              ${this.error}
              <button
                @click=${() => {
                  this.identity = "";
                  this.requestUpdate("hass");
                }}
              >
                Retry
              </button>
            </p>`
          : !this.scope
            ? html`<p class="message" role="status">
                ${this.hass?.user ? "Loading Companion…" : "Sign in to Home Assistant to use this card."}
              </p>`
            : this.kind === "remote"
              ? html`<div class="remote">
                  <kaleidescape-device-controls
                    .client=${this.api}
                    .scope=${this.scope}
                    .playerId=${c.player_id}
                    .inlineRemote=${true}
                  ></kaleidescape-device-controls>
                </div>`
              : this.kind === "now-playing"
                ? html`<kaleidescape-now-playing
                    .client=${this.api}
                    .scope=${this.scope}
                    .playerId=${c.player_id}
                    .compact=${true}
                    .showControls=${c.show_controls}
                  ></kaleidescape-now-playing>`
                : this.kind === "library-search"
                  ? html`<form class="search" @submit=${this.search}>
                      <label
                        >Search titles, actors or directors<input
                          type="search"
                          maxlength="500"
                          .value=${this.query}
                          @input=${(event: Event) => {
                            this.query = (
                              event.target as HTMLInputElement
                            ).value;
                          }} /></label
                      ><button type="submit">Search</button
                      ><button
                        type="button"
                        @click=${(event: Event) => {
                          this.query = "";
                          this.search(event);
                          this.requestUpdate();
                        }}
                      >
                        Clear
                      </button>
                    </form>`
                  : this.kind === "journal-calendar"
                    ? html`<kaleidescape-journal-calendar
                          .client=${this.api}
                          .scope=${this.scope}
                          .daySize=${c.calendar_size}
                          .fitScreen=${c.calendar_fit}
                          .rememberUrl=${false}
                          @calendar-status=${(
                            event: CustomEvent<CalendarStatus>,
                          ) => {
                            this.calendarStatus = event.detail;
                            this.requestUpdate();
                          }}
                          @browse-library=${(event: CustomEvent<LibraryCriterion>) => void this.browse(event.detail)}
                        ></kaleidescape-journal-calendar>
                        <footer class="calendar-footer">
                          <span
                            >${journalTotals(this.scope, this.calendarStatus)}</span
                          >${calendarNotice(this.calendarStatus, () => void this.renderRoot.querySelector<JournalCalendar>("kaleidescape-journal-calendar")?.refresh())}
                        </footer>`
                    : this.scope.library_enabled
                      ? library()
                      : html`<p class="message">
                          Library is disabled. An administrator can enable it in
                          Companion settings.
                        </p>`
      }
      ${
        this.popupCriterion && this.scope?.library_enabled
          ? html`<dialog @click=${dismissBackdrop} @cancel=${this.closePopup}>
              <div class="card-head">
                <h2>Library</h2>
                ${closeButton((event) => this.closePopup(event), this.locked)}
              </div>
              <kaleidescape-library
                .client=${this.api}
                .scope=${this.scope}
                .dashboard=${c}
                .openCriterion=${this.popupCriterion}
              ></kaleidescape-library>
            </dialog>`
          : nothing
      }
    </ha-card>`;
  }
}
const descriptions: Record<CardKind, string> = {
  remote: "Theater remote",
  "now-playing": "Now Playing",
  "library-covers": "Library covers",
  "library-search": "Library search",
  library: "Full Library",
  "journal-calendar": "Journal calendar",
};
const registry = window as unknown as {
  customCards?: {
    type: string;
    name: string;
    description: string;
    preview: boolean;
  }[];
};
registry.customCards ??= [];
for (const kind of CARD_KINDS) {
  const name = `kaleidescape-${kind}-card`;
  if (!customElements.get(name)) {
    class Card extends CompanionCard {
      static kind = kind;
    }
    customElements.define(name, Card);
  }
  if (!registry.customCards.some((card) => card.type === name))
    registry.customCards.push({
      type: name,
      name: `Kaleidescape · ${descriptions[kind]}`,
      description: descriptions[kind],
      preview: true,
    });
}
