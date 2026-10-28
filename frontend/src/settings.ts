/** Administrator settings page backed by Companion's native HA options flow. */
import { LitElement, html, nothing } from "lit";
import type { PropertyValues } from "lit";
import { errorCode, errorMessage } from "./api";
import type { JournalClient, OptionsForm, Scope } from "./api";
import { styles } from "./styles";

const fields = [
  ["media_player", "Kaleidescape media player", "text", "", ""],
  ["play_status", "Exact play-status sensor", "text", "", ""],
  ["media_location", "Media-location sensor", "text", "", ""],
  [
    "minimum_runtime_minutes",
    "Minimum runtime to record · minutes (0 disables)",
    "number",
    "0",
    "1440",
  ],
  [
    "minimum_seconds",
    "Minimum main-content playback before credits completion · seconds",
    "number",
    "1",
    "3600",
  ],
  [
    "resume_hours",
    "Merge partial viewings within · hours (0 disables)",
    "number",
    "0",
    "168",
  ],
];
const validation: Record<string, string> = {
  missing_entities: "Select all three source entities to enable tracking.",
  invalid_entities: "Choose existing media_player and sensor entity IDs.",
  duplicate_entities:
    "Choose different sensors for play status and media location.",
  invalid_rules: "Check the runtime, completion, and partial-resume values.",
};

export class KaleidescapeSettings extends LitElement {
  static properties = {
    client: { attribute: false },
    scope: { attribute: false },
  };
  static styles = styles;
  client?: JournalClient;
  scope?: Scope;
  private generation = 0;
  private flow?: OptionsForm;
  private draft: Record<string, string | number | boolean> = {};
  private initial: Record<string, string | number | boolean> = {};
  private loading = false;
  private saving = false;
  private uncertain = false;
  private error = "";
  private bound = "";
  private boundClient?: JournalClient;
  private boundScope?: Scope;

  protected willUpdate(changed: PropertyValues) {
    if (!changed.has("client") && !changed.has("scope")) return;
    const key = `${this.scope?.entry_id}:${this.scope?.dataset_id}`;
    if (key === this.bound && this.client === this.boundClient) return;
    this.cancelFlow();
    this.bound = key;
    this.boundClient = this.client;
    this.boundScope = this.scope;
    this.flow = undefined;
    this.draft = {};
    this.initial = {};
    this.uncertain = this.saving = false;
    if (this.client && this.scope) void this.start();
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    this.cancelFlow();
    this.flow = undefined;
    this.draft = {};
    this.initial = {};
    this.bound = "";
    this.boundClient = undefined;
  }
  connectedCallback() {
    super.connectedCallback();
    this.requestUpdate("client");
    this.requestUpdate("scope");
  }
  private cancelFlow() {
    this.generation++;
    if (this.flow?.flow_id && this.boundClient && this.boundScope)
      void this.boundClient
        .settings(this.boundScope, "cancel", { flow_id: this.flow.flow_id })
        .catch(() => {});
  }
  private fail(error: unknown) {
    this.error = errorMessage(error);
    if (errorCode(error) === "unauthorized") {
      this.flow = undefined;
      this.draft = {};
      this.initial = {};
      this.dispatchEvent(
        new CustomEvent("access-denied", { bubbles: true, composed: true }),
      );
    }
  }
  private async start() {
    const client = this.client!,
      scope = this.scope!,
      generation = ++this.generation;
    this.loading = true;
    this.error = "";
    this.requestUpdate();
    try {
      const flow = await client.settings(scope, "start");
      if (generation !== this.generation) {
        if (flow.flow_id)
          void client
            .settings(scope, "cancel", { flow_id: flow.flow_id })
            .catch(() => {});
        return;
      }
      this.flow = flow;
      this.draft = Object.fromEntries(
        (flow.fields ?? []).map((field) => [
          field.name,
          field.name === "tracking_enabled"
            ? !!field.default
            : String(field.default ?? ""),
        ]),
      );
      this.initial = { ...this.draft };
    } catch (error) {
      if (generation === this.generation) this.fail(error);
    } finally {
      if (generation === this.generation) {
        this.loading = false;
        this.requestUpdate();
      }
    }
  }
  confirmNavigation() {
    if (this.saving) return false;
    if (this.uncertain)
      return window.confirm(
        "The settings save may already have committed. Leave this view and inspect saved values before making another change?",
      );
    return (
      JSON.stringify(this.draft) === JSON.stringify(this.initial) ||
      window.confirm("Discard your unsaved settings changes?")
    );
  }
  private busy() {
    this.dispatchEvent(
      new CustomEvent("settings-busy", {
        detail: this.saving,
        bubbles: true,
        composed: true,
      }),
    );
  }
  private reload() {
    if (!this.confirmNavigation()) return;
    this.cancelFlow();
    this.flow = undefined;
    this.draft = this.initial = {};
    this.uncertain = false;
    void this.start();
  }
  private async save(event: Event) {
    event.preventDefault();
    if (
      !this.client ||
      !this.scope ||
      !this.flow?.flow_id ||
      this.saving ||
      this.uncertain
    )
      return;
    if (!(event.target as HTMLFormElement).reportValidity()) return;
    const generation = this.generation;
    this.saving = true;
    this.busy();
    this.error = "";
    this.requestUpdate();
    const data = { ...this.draft };
    for (const [key, , type] of fields) {
      if (type === "number") data[key] = Number(data[key]);
      else if (!data[key]) delete data[key];
    }
    try {
      const result = await this.client.settings(this.scope, "submit", {
        flow_id: this.flow.flow_id,
        data,
      });
      if (generation !== this.generation) return;
      this.flow = result;
      if (result.type === "create_entry") {
        this.initial = { ...this.draft };
        this.saving = false;
        this.busy();
        this.dispatchEvent(
          new CustomEvent("settings-saved", { bubbles: true, composed: true }),
        );
      } else if (result.type === "form") {
        this.error = Object.values(result.errors ?? {})
          .map(
            (code) => validation[code] ?? "Check the settings and try again.",
          )
          .join(" ");
      } else
        this.error = "The settings flow ended. Reload settings to continue.";
    } catch (error) {
      if (generation === this.generation) {
        this.fail(error);
        this.uncertain = ![
          "unauthorized",
          "invalid_request",
          "conflict",
        ].includes(errorCode(error));
      }
    } finally {
      if (generation === this.generation) {
        this.saving = false;
        this.busy();
        this.requestUpdate();
      }
    }
  }
  protected render() {
    return html`<section
      class="card settings-page"
      aria-labelledby="settings-title"
    >
      <div class="card-head">
        <h2 id="settings-title">Companion settings</h2>
        <button ?disabled=${this.saving || this.loading} @click=${this.reload}>
          Reload settings
        </button>
      </div>
      <p>
        These are the same settings as the integration’s Configure options.
        Saving reloads the integration.
      </p>
      ${this.error ? html`<p class="error" role="alert">${this.error}</p>` : nothing}
      ${this.uncertain ? html`<p class="warning">The save result is unconfirmed. Reload settings to inspect the saved values before making another change.</p>` : nothing}
      ${
        this.loading
          ? html`<p role="status">Loading settings…</p>`
          : this.flow?.type === "form"
            ? html`<form @submit=${this.save}>
                <fieldset ?disabled=${this.saving || this.uncertain}>
                  <label class="check"
                    ><input
                      name="tracking_enabled"
                      type="checkbox"
                      .checked=${!!this.draft.tracking_enabled}
                      @change=${(event: Event) => {
                        this.draft = {
                          ...this.draft,
                          tracking_enabled: (event.target as HTMLInputElement)
                            .checked,
                        };
                        this.requestUpdate();
                      }}
                    />Automatically record playback</label
                  >
                  <div class="grid settings-grid">
                    ${fields.map(
                      ([key, label, type, min, max]) =>
                        html`<label class=${type === "text" ? "full" : ""}
                          >${label}<input
                            name=${key}
                            type=${type}
                            min=${min || nothing}
                            max=${max || nothing}
                            step=${type === "number" ? "1" : nothing}
                            maxlength=${type === "text" ? "255" : nothing}
                            ?required=${type === "number" || !!this.draft.tracking_enabled}
                            .value=${String(this.draft[key] ?? "")}
                            @input=${(event: Event) => {
                              this.draft = {
                                ...this.draft,
                                [key]: (event.target as HTMLInputElement).value,
                              };
                            }}
                        /></label>`,
                    )}
                  </div>
                  <p class="muted">
                    Use HA entity IDs for the three sources. The runtime cutoff
                    uses total duration; missing runtime waits for metadata.
                    Completion uses watched time and confirmed credits.
                  </p>
                  <button class="primary" type="submit">
                    ${this.saving ? "Saving…" : "Save settings"}
                  </button>
                </fieldset>
                <button
                  type="button"
                  ?disabled=${this.saving || this.loading}
                  @click=${this.reload}
                >
                  Cancel changes
                </button>
              </form>`
            : nothing
      }
    </section>`;
  }
}
if (!customElements.get("kaleidescape-settings"))
  customElements.define("kaleidescape-settings", KaleidescapeSettings);
