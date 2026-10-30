/** Per-user Journal search options shared by the reader and administrator views. */
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
    this.ready = false;
    this.fuzzy = true;
    this.error = "";
    this.renderRoot.querySelector("dialog")?.close();
  }
  private notify() {
    this.dispatchEvent(
      new CustomEvent("journal-options", {
        detail: { fuzzy_search: this.fuzzy },
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
    try {
      const values = await this.store.load();
      if (generation !== this.generation) return;
      this.fuzzy = values.fuzzy_search as boolean;
      this.ready = true;
      this.error = "";
      this.notify();
      this.requestUpdate();
    } catch (error) {
      if (generation === this.generation) this.fail(error);
    }
  }
  protected render() {
    return html`<button
        ?disabled=${!this.ready || this.disabled}
        @click=${() => this.renderRoot.querySelector("dialog")?.showModal()}
      >
        Options
      </button>
      ${this.error ? html`<span class="error" role="alert">${this.error}<button @click=${() => (this.ready ? this.store?.retry() : this.load())}>Retry Journal options</button></span>` : nothing}
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
