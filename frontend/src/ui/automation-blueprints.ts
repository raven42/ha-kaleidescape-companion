/** Informative, opt-in blueprint updates through Home Assistant's API. */
import { LitElement, html, nothing } from "lit";
import type { PropertyValues } from "lit";
import type { JournalClient, JournalInfo } from "../core/api";
import { errorCode, errorMessage } from "../core/api";
import { styles } from "./styles";

const OPTIONS = [
  ["purchase_email", "Purchase receipt email"],
  ["library_schedule", "Schedule library sync"],
  ["metadata_schedule", "Schedule metadata refresh"],
  ["calendar_schedule", "Schedule calendar full sync"],
] as const;
type BlueprintState =
  "current" | "outdated" | "modified" | "missing" | "unavailable";
type Statuses = Record<
  string,
  {
    status: BlueprintState;
    label: string;
    revision: string | null;
    installed_version?: number | null;
    latest_version?: number;
  }
>;
const STATUS_LABELS: Record<BlueprintState, string> = {
  current: "Up to date",
  outdated: "Update available",
  modified: "Modified or unrecognized",
  missing: "Not installed",
  unavailable: "Unable to check",
};

export class AutomationBlueprints extends LitElement {
  static properties = {
    client: { attribute: false },
    scope: { attribute: false },
    versionsOnly: { type: Boolean },
  };
  static styles = [styles];
  client?: JournalClient;
  scope?: JournalInfo;
  versionsOnly = false;
  private busy = "";
  private message = "";
  private error = "";
  private statuses?: Statuses;
  private checking = false;
  private generation = 0;
  private pendingUpdate?: {
    kind: string;
    label: string;
    revision: string;
  };

  protected willUpdate(changed: PropertyValues) {
    if (changed.has("client") || changed.has("scope")) {
      this.generation++;
      this.statuses = undefined;
      this.pendingUpdate = undefined;
      if (this.client && this.scope?.permissions.edit) void this.refresh();
    }
  }
  disconnectedCallback() {
    this.generation++;
    super.disconnectedCallback();
  }
  private async refresh() {
    if (!this.client || !this.scope?.permissions.edit) return;
    const generation = this.generation;
    this.checking = true;
    this.requestUpdate();
    try {
      const statuses = await this.client.automationStatuses(this.scope);
      if (generation === this.generation) this.statuses = statuses;
    } catch (error) {
      if (generation === this.generation) this.error = errorMessage(error);
    } finally {
      if (generation === this.generation) {
        this.checking = false;
        this.requestUpdate();
      }
    }
  }
  private async install(kind: string, label: string, update: boolean) {
    if (!this.client || !this.scope?.permissions.edit || this.busy) return;
    this.busy = kind;
    this.message = this.error = "";
    this.pendingUpdate = undefined;
    this.requestUpdate();
    try {
      if (update) {
        const revision = this.statuses?.[kind]?.revision;
        if (!revision)
          throw new Error("Blueprint status changed; check again.");
        this.pendingUpdate = { kind, label, revision };
        this.message = `${label}: replacing this blueprint reloads its automations and may discard local edits.`;
      } else {
        const template = await this.client.automationTemplate(this.scope, kind);
        await this.client.installAutomationBlueprint(
          template.path,
          template.yaml,
        );
        this.message = `${label} blueprint installed. Create an automation in Home Assistant Blueprints.`;
        await this.refresh();
      }
    } catch (error) {
      if (errorCode(error) === "already_exists") {
        this.message = `${label} was installed while checking. Its status has been refreshed.`;
        await this.refresh();
      } else this.error = errorMessage(error);
    } finally {
      this.busy = "";
      this.requestUpdate();
    }
  }

  private async updateInstalled() {
    if (
      !this.client ||
      !this.scope?.permissions.edit ||
      this.busy ||
      !this.pendingUpdate
    )
      return;
    const pending = this.pendingUpdate;
    this.busy = pending.kind;
    this.message = this.error = "";
    this.requestUpdate();
    try {
      await this.client.updateAutomationBlueprint(
        this.scope,
        pending.kind,
        pending.revision,
      );
      this.message = `${pending.label} blueprint updated. Review its automations in Home Assistant.`;
      this.pendingUpdate = undefined;
      await this.refresh();
    } catch (error) {
      this.error = errorMessage(error);
      this.pendingUpdate = undefined;
      await this.refresh();
    } finally {
      this.busy = "";
      this.requestUpdate();
    }
  }
  protected render() {
    if (!this.scope?.permissions.edit) return nothing;
    if (this.versionsOnly)
      return html`<section aria-label="Blueprint versions">
        <h3>Automation blueprint versions</h3>
        ${this.checking && !this.statuses ? html`<p>Checking blueprints…</p>` : nothing}
        ${
          this.statuses
            ? html`<table>
                  <thead>
                    <tr>
                      <th>Blueprint</th>
                      <th>Installed</th>
                      <th>Latest</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${OPTIONS.map(([kind, label]) => {
                      const item = this.statuses?.[kind];
                      const installed =
                        item?.status === "missing"
                          ? "Not installed"
                          : item?.status === "unavailable"
                            ? "Unknown"
                            : item?.installed_version != null
                              ? `v${item.installed_version}`
                              : "Unversioned";
                      return html`<tr>
                        <td>${label}</td>
                        <td>${installed}</td>
                        <td>
                          ${item?.latest_version != null ? `v${item.latest_version}` : "Unknown"}
                        </td>
                        <td>${STATUS_LABELS[item?.status ?? "unavailable"]}</td>
                      </tr>`;
                    })}
                  </tbody>
                </table>
                <p class="muted">
                  Versions on modified blueprints are self-reported. Review
                  updates under Home Assistant → Optional automations.
                </p>`
            : nothing
        }
        ${this.error ? html`<p class="error" role="alert">${this.error}</p>` : nothing}
        <button type="button" ?disabled=${this.checking} @click=${this.refresh}>
          Check again
        </button>
      </section>`;
    return html`<section aria-label="Optional automations">
      <h3>Optional automations</h3>
      <p>
        Companion installs missing blueprints automatically when Home
        Assistant's automation integration is available. Create and enable an
        automation in Home Assistant to use one.
      </p>
      ${this.checking && !this.statuses ? html`<p role="status">Checking blueprints…</p>` : nothing}
      ${
        this.statuses
          ? html`<div class="blueprint-statuses">
              ${OPTIONS.map(([kind, label]) => {
                const state = this.statuses?.[kind]?.status ?? "unavailable";
                return html`<div class="actions" data-blueprint=${kind}>
                  <strong>${label}</strong>
                  <span
                    class=${state === "outdated" || state === "modified" ? "warning" : "muted"}
                    >${STATUS_LABELS[state]}</span
                  >
                  ${state === "missing" ? html`<button type="button" ?disabled=${!!this.busy} @click=${() => this.install(kind, label, false)}>Install</button>` : nothing}
                  ${state === "outdated" || state === "modified" ? html`<button type="button" ?disabled=${!!this.busy} @click=${() => this.install(kind, label, true)}>Review update</button>` : nothing}
                </div>`;
              })}
            </div>`
          : nothing
      }
      ${this.message ? html`<p role="status">${this.message}</p>` : nothing}
      ${this.pendingUpdate ? html`<button type="button" ?disabled=${!!this.busy} @click=${this.updateInstalled}>Update installed blueprint</button>` : nothing}
      ${this.error ? html`<p class="error" role="alert">${this.error}</p>` : nothing}
      <div class="actions">
        <button
          type="button"
          ?disabled=${this.checking || !!this.busy}
          @click=${this.refresh}
        >
          Check again</button
        ><a href="/config/blueprint/dashboard"
          >Open Home Assistant Blueprints</a
        >
      </div>
      <p>
        If a status cannot be checked, ensure Home Assistant automations are
        enabled and the blueprint file is readable. Modified or unrecognized
        blueprints are never replaced automatically. Calendar Full Sync requires
        a dedicated calendar and can delete unmatched events.
      </p>
    </section>`;
  }
}
if (!customElements.get("kaleidescape-automation-blueprints"))
  customElements.define(
    "kaleidescape-automation-blueprints",
    AutomationBlueprints,
  );
