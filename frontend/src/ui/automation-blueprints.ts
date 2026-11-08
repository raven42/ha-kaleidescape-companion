/** One blueprint inventory with visible history and revision-bound updates. */
import { LitElement, css, html, nothing } from "lit";
import type { PropertyValues } from "lit";
import type { JournalClient, JournalInfo } from "../core/api";
import { errorCode, errorMessage } from "../core/api";
import { closeButton, dismissBackdrop } from "./dialog";
import { styles } from "./styles";
import { settingsStyles } from "./settings-styles";

const OPTIONS = [
  [
    "purchase_email",
    "Purchase receipt email",
    "Import receipt HTML from a selected IMAP mailbox.",
    "Choose the IMAP entry, sender filter and fields to import in Home Assistant.",
  ],
  [
    "library_schedule",
    "Library sync",
    "Keep the local movie catalog up to date.",
    "Enable and save Library sync, then choose a daily local time in Home Assistant.",
  ],
  [
    "metadata_schedule",
    "Metadata refresh",
    "Refresh information from enabled movie providers.",
    "Enable and save your providers, then choose the schedule, providers and Only missing option.",
  ],
  [
    "calendar_schedule",
    "Calendar Full Sync",
    "Maintain a dedicated calendar from completed viewings.",
    "Save a dedicated calendar and enable Full Sync first. Unmatched events can be deleted; the schedule includes a later safeguard check.",
  ],
] as const;
type BlueprintState =
  "current" | "outdated" | "modified" | "missing" | "unavailable";
type Statuses = Awaited<ReturnType<JournalClient["automationStatuses"]>>;
const STATUS_LABELS: Record<BlueprintState, string> = {
  current: "Up to date",
  outdated: "Update available",
  modified: "Modified or unrecognized",
  missing: "Not installed",
  unavailable: "Unable to check",
};
function versionHistory(yaml: string): string[] {
  const lines = yaml.split(/\r?\n/),
    start = lines.indexOf("# Version history:");
  const end = lines.indexOf("# End version history", start + 1);
  return start < 0 || end < 0
    ? []
    : lines
        .slice(start + 1, end)
        .filter((line) => /^# v\d+: /.test(line))
        .map((line) => line.slice(2));
}
interface BlueprintReview {
  kind: string;
  label: string;
  mode: "history" | "install" | "update";
  revision: string | null;
  installed: number | null;
  bundled?: number;
  modified: boolean;
  loading: boolean;
  entries: string[];
  template?: { path: string; yaml: string };
  error?: string;
}
export class AutomationBlueprints extends LitElement {
  static properties = {
    client: { attribute: false },
    scope: { attribute: false },
    versionsOnly: { type: Boolean },
    disabled: { type: Boolean },
  };
  static styles = [
    styles,
    settingsStyles,
    css`
      .blueprint-table-wrap {
        overflow-x: auto;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        font-size: 13px;
      }
      th {
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--muted);
        text-align: left;
        padding: 10px 12px;
        border-bottom: 1px solid var(--line);
      }
      td {
        vertical-align: top;
        padding: 18px 12px;
        border-bottom: 1px solid var(--line);
      }
      td:first-child {
        min-width: 180px;
      }
      td small {
        display: block;
        margin-top: 5px;
        max-width: 30ch;
      }
      .row-actions {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 8px;
        min-width: 145px;
      }
      .row-actions button {
        font-size: 12px;
      }
      .status {
        font-size: 12px;
        display: inline-block;
        border: 1px solid var(--line);
        border-radius: 8px;
        padding: 4px 7px;
      }
      .status.current {
        color: var(--accent);
      }
      .status.outdated,
      .status.modified {
        color: var(--warning-color, #8b5c00);
      }
      .workflow {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 16px;
        padding-left: 20px;
        margin: 18px 0 0;
      }
      .workflow li {
        padding-inline-end: 10px;
        font-size: 14px;
      }
      .workflow small {
        display: block;
        margin-top: 5px;
      }
      .blueprint-review {
        width: min(680px, calc(100% - 24px));
      }
      .review-versions {
        display: flex;
        gap: 16px;
        padding: 14px 0;
        flex-wrap: wrap;
      }
      .review-versions span {
        padding: 8px 12px;
        border: 1px solid var(--line);
        border-radius: 8px;
      }
      .history-list {
        padding-left: 22px;
        font-size: 14px;
        line-height: 1.6;
      }
      .history-list li {
        padding: 7px 0;
      }
      @media (max-width: 600px) {
        .workflow {
          grid-template-columns: minmax(0, 1fr);
          gap: 12px;
        }
      }
    `,
  ];
  client?: JournalClient;
  scope?: JournalInfo;
  versionsOnly = false;
  disabled = false;
  private busy = false;
  private message = "";
  private error = "";
  private statuses?: Statuses;
  private checking = false;
  private generation = 0;
  private reviewRequest = 0;
  private review?: BlueprintReview;
  private opener?: HTMLElement;
  protected willUpdate(changed: PropertyValues) {
    if (changed.has("client") || changed.has("scope")) {
      this.reset();
      if (this.client && this.scope?.permissions.edit) void this.refresh();
    }
  }
  disconnectedCallback() {
    this.reset();
    super.disconnectedCallback();
  }
  private reset() {
    this.generation++;
    this.setBusy(false);
    this.message = this.error = "";
    this.checking = false;
    this.statuses = undefined;
    this.closeReview();
  }
  confirmNavigation() {
    return !this.busy;
  }
  private setBusy(value: boolean) {
    if (value === this.busy) return;
    this.busy = value;
    this.dispatchEvent(
      new CustomEvent("blueprint-busy", {
        detail: value,
        bubbles: true,
        composed: true,
      }),
    );
  }
  private closeReview(event?: Event) {
    if (this.busy) {
      event?.preventDefault();
      return;
    }
    this.reviewRequest++;
    this.review = undefined;
    this.renderRoot.querySelector<HTMLDialogElement>("dialog")?.close();
    this.opener?.focus();
    this.opener = undefined;
    this.requestUpdate();
  }
  private fail(error: unknown) {
    if (errorCode(error) === "unauthorized") {
      this.reset();
      this.dispatchEvent(
        new CustomEvent("access-denied", { bubbles: true, composed: true }),
      );
    } else this.error = errorMessage(error);
  }
  private async refresh() {
    if (!this.client || !this.scope?.permissions.edit || this.checking) return;
    const generation = this.generation;
    this.checking = true;
    this.requestUpdate();
    try {
      const statuses = await this.client.automationStatuses(this.scope);
      if (generation === this.generation) this.statuses = statuses;
    } catch (error) {
      if (generation === this.generation) this.fail(error);
    } finally {
      if (generation === this.generation) {
        this.checking = false;
        this.requestUpdate();
      }
    }
  }
  private async openReview(
    kind: string,
    label: string,
    mode: BlueprintReview["mode"],
    event?: Event,
  ) {
    if (
      !this.client ||
      !this.scope?.permissions.edit ||
      this.busy ||
      (this.disabled && mode !== "history")
    )
      return;
    const client = this.client,
      scope = this.scope,
      generation = this.generation;
    const request = ++this.reviewRequest;
    const status = this.statuses?.[kind];
    this.opener =
      (event?.currentTarget as HTMLElement | undefined) ?? this.opener;
    this.review = {
      kind,
      label,
      mode,
      revision: status?.revision ?? null,
      installed: status?.installed_version ?? null,
      bundled: status?.latest_version,
      modified: status?.status === "modified",
      loading: true,
      entries: [],
    };
    this.error = this.message = "";
    this.requestUpdate();
    await this.updateComplete;
    const current = () =>
      this.isConnected &&
      request === this.reviewRequest &&
      generation === this.generation &&
      this.client === client &&
      this.scope === scope &&
      !!scope.permissions.edit;
    if (!current()) return;
    const dialog = this.renderRoot.querySelector<HTMLDialogElement>("dialog");
    if (dialog && !dialog.open) dialog.showModal();
    try {
      const template = await client.automationTemplate(scope, kind);
      if (!current()) return;
      this.review = {
        ...this.review!,
        loading: false,
        entries: versionHistory(template.yaml),
        template,
      };
    } catch (error) {
      if (!current()) return;
      if (errorCode(error) === "unauthorized") this.fail(error);
      else
        this.review = {
          ...this.review!,
          loading: false,
          error: errorMessage(error),
        };
    }
    this.requestUpdate();
  }
  private async applyReview() {
    const pending = this.review;
    if (
      !this.client ||
      !this.scope?.permissions.edit ||
      this.disabled ||
      this.busy ||
      !pending?.template ||
      pending.loading ||
      pending.error ||
      pending.mode === "history" ||
      (pending.mode === "update" && !pending.revision)
    )
      return;
    const client = this.client,
      scope = this.scope,
      generation = this.generation;
    const current = () =>
      this.isConnected &&
      generation === this.generation &&
      this.client === client &&
      this.scope === scope &&
      !!scope.permissions.edit;
    this.setBusy(true);
    this.message = this.error = "";
    this.requestUpdate();
    try {
      if (pending.mode === "update")
        await client.updateAutomationBlueprint(
          scope,
          pending.kind,
          pending.revision!,
        );
      else
        await client.installAutomationBlueprint(
          pending.template.path,
          pending.template.yaml,
        );
      if (!current()) return;
      this.message = `${pending.label} blueprint ${pending.mode === "update" ? "updated" : "installed"}. Open Home Assistant Blueprints to create or review its automations.`;
    } catch (error) {
      if (!current()) return;
      if (errorCode(error) === "already_exists")
        this.message = `${pending.label} was installed while you were reviewing. Existing contents were preserved; check its refreshed status.`;
      else this.fail(error);
    } finally {
      if (current()) {
        this.setBusy(false);
        this.closeReview();
        await this.refresh();
        this.requestUpdate();
      }
    }
  }
  private renderReview() {
    const review = this.review;
    const entries =
      review?.mode === "update" && !review.modified && review.installed != null
        ? review.entries.filter(
            (entry) => Number(/^v(\d+):/.exec(entry)?.[1]) > review.installed!,
          )
        : (review?.entries ?? []);
    return html`<dialog
      class="blueprint-review"
      aria-labelledby="blueprint-review-title"
      @click=${dismissBackdrop}
      @cancel=${(event: Event) => {
        if (this.busy) event.preventDefault();
      }}
      @close=${this.closeReview}
    >
      <div class="card-head">
        <h2 id="blueprint-review-title">
          ${review?.label} ·
          ${review?.mode === "history" ? "change log" : review?.mode === "install" ? "Install blueprint" : "Review update"}
        </h2>
        ${closeButton((event) => this.closeReview(event), this.busy)}
      </div>
      <p>${OPTIONS.find(([kind]) => kind === review?.kind)?.[3]}</p>
      <div class="review-versions">
        <span
          >Installed:
          <strong
            >${review?.mode === "install" ? "Not installed" : review?.installed != null ? `v${review.installed}` : "Unversioned"}</strong
          ></span
        ><span
          >Bundled:
          <strong
            >${review?.bundled != null ? `v${review.bundled}` : "Unknown"}</strong
          ></span
        >
      </div>
      ${review?.mode === "update" ? html`<p class=${review.modified ? "warning" : "settings-note"}>${review.modified ? "This file is modified or unrecognized. Replacing it may discard local edits." : "This update replaces the installed blueprint."} Dependent automations are reloaded. Your automation inputs remain managed in Home Assistant.</p>` : review?.mode === "install" ? html`<p class="settings-note">Installing adds the blueprint template. It does not create or enable an automation. Existing blueprint files are preserved.</p>` : html`<p class="muted">History bundled with Companion; this does not describe local edits.</p>`}
      <h3>
        ${review?.mode === "update" && !review.modified && review.installed != null ? `Changes since v${review.installed}` : "Version history"}
      </h3>
      ${
        review?.loading
          ? html`<p role="status">Loading change log…</p>`
          : review?.error
            ? html`<p role="alert" class="error">${review.error}</p>
                <button
                  type="button"
                  @click=${() => this.openReview(review.kind, review.label, review.mode)}
                >
                  Retry change log
                </button>`
            : entries.length
              ? html`<ul class="history-list">
                  ${entries.map((entry) => html`<li>${entry}</li>`)}
                </ul>`
              : html`<p>
                  No change log entries are available for this version.
                </p>`
      }
      ${
        review && entries.length !== review.entries.length && !review.loading
          ? html`<details class="setting-help">
              <summary>Full bundled history</summary>
              <ul class="history-list">
                ${review.entries.map((entry) => html`<li>${entry}</li>`)}
              </ul>
            </details>`
          : nothing
      }
      <div class="dialog-footer">
        <button type="button" ?disabled=${this.busy} @click=${this.closeReview}>
          ${review?.mode === "history" ? "Close" : "Cancel"}</button
        >${review && review.mode !== "history" ? html`<button type="button" class="primary" ?disabled=${this.disabled || this.busy || review.loading || !!review.error || !review.template || (review.mode === "update" && !review.revision)} @click=${this.applyReview}>${this.busy ? "Applying…" : review.mode === "install" ? "Install blueprint" : "Update installed blueprint"}</button>` : nothing}
      </div>
    </dialog>`;
  }
  protected render() {
    if (!this.scope?.permissions.edit) return nothing;
    return html`<section aria-label="Optional automations">
      ${
        !this.versionsOnly
          ? html`<div class="settings-card">
              <div class="section-heading">
                <div>
                  <h3>Optional automations</h3>
                  <p>
                    Blueprints are reusable templates. Installation and running
                    an automation are separate steps.
                  </p>
                </div>
                <span class="scope-tag">Explicit actions</span>
              </div>
              <ol class="workflow">
                <li>
                  <strong>Install or update</strong
                  ><small>Review the version and change log here.</small>
                </li>
                <li>
                  <strong>Create in Home Assistant</strong
                  ><small>Choose the blueprint and its inputs.</small>
                </li>
                <li>
                  <strong>Enable & verify</strong
                  ><small>Review the schedule and automation trace.</small>
                </li>
              </ol>
            </div>`
          : nothing
      }
      <div class="settings-card">
        <div class="section-heading">
          <div>
            <h3>Automation blueprint versions</h3>
            <p>
              Compare installed templates with this Companion build. Bundled
              versions are not a remote release check.
            </p>
          </div>
          <button
            type="button"
            ?disabled=${this.checking || this.busy || !!this.review}
            @click=${this.refresh}
          >
            ${this.checking ? "Checking…" : "Check again"}
          </button>
        </div>
        ${this.checking && !this.statuses ? html`<p role="status">Checking blueprints…</p>` : nothing}
        ${
          this.statuses
            ? html`<div
                class="blueprint-table-wrap"
                tabindex="0"
                role="region"
                aria-label="Blueprint versions and actions"
              >
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Blueprint</th>
                      <th scope="col">Installed</th>
                      <th scope="col">Bundled</th>
                      <th scope="col">Status</th>
                      <th scope="col">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${OPTIONS.map(([kind, label, description]) => {
                      const item = this.statuses?.[kind],
                        state = item?.status ?? "unavailable";
                      return html`<tr data-blueprint=${kind}>
                        <td>
                          <strong>${label}</strong><small>${description}</small>
                        </td>
                        <td>
                          ${state === "missing" ? "Not installed" : state === "unavailable" ? "Unknown" : item?.installed_version != null ? `v${item.installed_version}` : "Unversioned"}
                        </td>
                        <td>
                          ${item?.latest_version != null ? `v${item.latest_version}` : "Unknown"}
                        </td>
                        <td>
                          <span class=${`status ${state}`}
                            >${STATUS_LABELS[state]}</span
                          >
                        </td>
                        <td>
                          <div class="row-actions">
                            ${!this.versionsOnly && (state === "outdated" || state === "modified" || state === "missing") ? html`<button type="button" class=${state === "outdated" ? "primary" : ""} ?disabled=${this.disabled || this.busy} @click=${(event: Event) => this.openReview(kind, label, state === "missing" ? "install" : "update", event)}>${state === "missing" ? "Install" : state === "modified" ? "Review replacement" : "Update"}</button>` : nothing}
                            <button
                              type="button"
                              class="link"
                              ?disabled=${this.busy}
                              aria-label=${`View ${label} change log`}
                              @click=${(event: Event) => this.openReview(kind, label, "history", event)}
                            >
                              View change log
                            </button>
                            ${!this.versionsOnly && state === "current" ? html`<a href="/config/blueprint/dashboard">Create automation ↗</a>` : nothing}
                          </div>
                        </td>
                      </tr>`;
                    })}
                  </tbody>
                </table>
              </div>`
            : nothing
        }
        ${this.message ? html`<p class="settings-note" role="status">${this.message}</p>` : nothing}${this.error ? html`<p class="error" role="alert">${this.error}</p>` : nothing}
        <details class="setting-help">
          <summary>Installation, local changes & troubleshooting</summary>
          <p>
            Companion installs missing blueprints automatically when Home
            Assistant's automation integration is available. Existing files are
            never replaced automatically. Versions on modified files are
            self-reported. If status is unavailable, check that automations are
            enabled and the file is readable. After an unconfirmed update,
            inspect the installed file and automation state before retrying.
          </p>
          <a href="/config/blueprint/dashboard"
            >Open Home Assistant Blueprints</a
          >
        </details>
      </div>
      ${this.renderReview()}
    </section>`;
  }
}
if (!customElements.get("kaleidescape-automation-blueprints"))
  customElements.define(
    "kaleidescape-automation-blueprints",
    AutomationBlueprints,
  );
