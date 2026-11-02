/** Administrator-only test dashboard generation; no arbitrary HA service proxy. */
import { LitElement, html, nothing } from "lit";
import type { PropertyValues } from "lit";
import { errorCode, errorMessage, randomId } from "../core/api";
import type {
  JournalClient,
  JournalInfo,
  TestDashboardPlan,
} from "../core/api";
import {
  DashboardInstaller,
  DashboardSetupError,
} from "../core/test-dashboard";
import { styles } from "./styles";
import { closeButton, dismissBackdrop } from "./dialog";

export class TestDashboard extends LitElement {
  static properties = {
    client: { attribute: false },
    scope: { attribute: false },
    disabled: { type: Boolean },
  };
  static styles = styles;
  client?: JournalClient;
  scope?: JournalInfo;
  disabled = false;
  private name = "Kaleidescape test guide";
  private request = "";
  private plan?: TestDashboardPlan;
  private installer?: DashboardInstaller;
  private generation = 0;
  private busy = false;
  private pending = false;
  private complete = false;
  private error = "";
  private bound = "";
  private boundClient?: JournalClient;
  protected willUpdate(changed: PropertyValues) {
    if (!changed.has("client") && !changed.has("scope")) return;
    const bound = `${this.scope?.entry_id}:${this.scope?.dataset_id}:${this.scope?.permissions.edit}`;
    if (bound === this.bound && this.client === this.boundClient) return;
    this.reset();
    this.bound = bound;
    this.boundClient = this.client;
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    this.reset();
  }
  private reset() {
    this.generation++;
    this.plan = undefined;
    this.installer = undefined;
    this.busy = this.pending = this.complete = false;
    this.error = this.request = "";
    this.renderRoot?.querySelector("dialog")?.close();
    this.signal();
  }
  private signal() {
    this.dispatchEvent(
      new CustomEvent("dashboard-busy", {
        detail: this.busy || this.pending,
        bubbles: true,
        composed: true,
      }),
    );
  }
  confirmNavigation() {
    if (this.busy) return false;
    if (
      this.pending &&
      !window.confirm(
        "Dashboard setup is unconfirmed. It may already exist in HA. Leave setup and inspect Dashboards before creating another?",
      )
    )
      return false;
    return true;
  }
  private close(event?: Event) {
    event?.preventDefault();
    if (this.busy || this.pending) {
      this.reset();
      this.requestUpdate();
    } else this.renderRoot.querySelector("dialog")?.close();
  }
  private async create(event?: Event) {
    event?.preventDefault();
    event?.stopPropagation();
    if (
      !this.client ||
      !this.scope?.permissions.edit ||
      this.busy ||
      this.complete ||
      (this.disabled && !this.plan)
    )
      return;
    const generation = this.generation,
      current = () => generation === this.generation && this.isConnected;
    this.busy = true;
    this.error = "";
    this.signal();
    this.requestUpdate();
    try {
      this.request ||= randomId();
      if (!this.plan) {
        const plan = await this.client.testDashboard(
          this.scope,
          this.request,
          this.name.trim(),
        );
        if (!current()) return;
        this.installer = new DashboardInstaller(this.client, plan);
        this.plan = plan;
      }
      this.pending = true;
      await this.installer!.install(current);
      if (!current()) return;
      await this.client.verifyTestDashboard(this.scope, this.request);
      if (!current()) return;
      this.complete = true;
      this.pending = false;
    } catch (error) {
      if (!current()) return;
      const code = errorCode(error);
      const message = (error as { message?: unknown })?.message;
      this.error =
        typeof message === "string" &&
        (code.startsWith("dashboard_") || error instanceof DashboardSetupError)
          ? message
          : errorMessage(error);
      if (code === "unauthorized") {
        this.reset();
        this.dispatchEvent(
          new CustomEvent("access-denied", { bubbles: true, composed: true }),
        );
      }
    } finally {
      if (current()) {
        this.busy = false;
        this.signal();
        this.requestUpdate();
      }
    }
  }
  private download() {
    if (!this.plan) return;
    const url = URL.createObjectURL(
      new Blob([this.plan.yaml], { type: "application/yaml" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "kaleidescape-test-dashboard.yaml";
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  protected render() {
    if (!this.scope?.permissions.edit) return nothing;
    return html`<section>
        <h3>Test dashboard and usage guide</h3>
        <p>
          Generate seven focused views with card examples and expected behavior,
          using saved Companion settings. Save any settings changes first.
          Requires a synced Library, configured player controls, a Now Playing
          source and Journal data.
        </p>
        <button
          type="button"
          ?disabled=${this.disabled || this.busy}
          @click=${() => this.renderRoot.querySelector<HTMLDialogElement>("dialog")?.showModal()}
        >
          Generate test dashboard
        </button>
      </section>
      <dialog
        data-admin-dialog
        class="database-dialog"
        @click=${dismissBackdrop}
        @cancel=${this.close}
      >
        <div class="card-head">
          <h2>Generate test dashboard</h2>
          ${closeButton((event) => this.close(event))}
        </div>
        <p>
          Creates a separate HA-managed dashboard visible to household users,
          with an editable configuration and downloadable YAML. Existing
          dashboards are never replaced. No player commands, scans or scrapes
          run during creation.
        </p>
        <form @submit=${this.create}>
          <label
            >Dashboard name<input
              name="dashboard_name"
              type="text"
              maxlength="80"
              required
              .value=${this.name}
              ?disabled=${this.busy || !!this.plan}
              @input=${(event: Event) => {
                this.name = (event.target as HTMLInputElement).value;
              }}
          /></label>
          ${this.error ? html`<p class="error" role="alert">${this.error}</p>` : nothing}
          ${this.pending ? html`<p class="warning">Setup is unconfirmed. Retry checks the same unique dashboard before writing. Changed dashboard content is never overwritten; failed setup does not delete anything.</p>` : nothing}
          ${
            this.plan
              ? html`<p>Views: ${this.plan.views.join(" · ")}</p>
                  <div class="actions">
                    <a
                      href=${`/${this.plan.url_path}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      >Open test dashboard</a
                    ><button type="button" @click=${this.download}>
                      Download YAML
                    </button>
                  </div>`
              : nothing
          }
          ${this.complete ? html`<p role="status">Test dashboard created and verified. Open it to follow the test cases.</p>` : nothing}
          <div class="dialog-footer">
            ${
              this.complete
                ? html`<button
                    type="button"
                    @click=${() => {
                      this.reset();
                      this.requestUpdate();
                    }}
                  >
                    Create another guide
                  </button>`
                : html`<button
                    class="primary"
                    type="submit"
                    ?disabled=${this.busy || (this.disabled && !this.plan)}
                  >
                    ${this.busy ? "Creating…" : this.pending ? "Check and finish setup" : "Create test dashboard"}
                  </button>`
            }
          </div>
        </form>
      </dialog>`;
  }
}
if (!customElements.get("kaleidescape-test-dashboard"))
  customElements.define("kaleidescape-test-dashboard", TestDashboard);
