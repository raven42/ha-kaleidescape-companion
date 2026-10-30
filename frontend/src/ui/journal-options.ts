/** Personal Journal layout and global search options for both household roles. */
import { LitElement, html, nothing } from "lit";
import type { PropertyValues } from "lit";
import type { JournalClient, Scope } from "../core/api";
import { errorCode, errorMessage } from "../core/api";
import { PreferenceStore } from "./preference-store";
import { styles } from "./styles";
import { dismissBackdrop } from "./dialog";

export class JournalOptions extends LitElement {
  static properties = {
    client: { attribute: false },
    scope: { attribute: false },
    disabled: { type: Boolean },
  };
  static styles = styles;
  client?: JournalClient;
  scope?: Scope;
  disabled = false;
  private store?: PreferenceStore;
  private viewStore?: PreferenceStore;
  private view: "list" | "calendar" = "list";
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
    this.ready = false;
    this.fuzzy = true;
    this.error = "";
    this.renderRoot.querySelector("dialog")?.close();
  }
  private notify() {
    this.dispatchEvent(
      new CustomEvent("journal-options", {
        detail: { fuzzy_search: this.fuzzy, view: this.view },
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
        <h2 id="journal-options-title">Journal options</h2>
        <p>Changes save automatically for your HA user.</p>
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
          Show a month of viewings on their local start dates. Off restores the
          entry list.
        </p>
        <div class="dialog-footer">
          <button
            @click=${() => this.renderRoot.querySelector("dialog")?.close()}
          >
            Done
          </button>
        </div>
      </dialog>`;
  }
}
if (!customElements.get("kaleidescape-journal-options"))
  customElements.define("kaleidescape-journal-options", JournalOptions);
