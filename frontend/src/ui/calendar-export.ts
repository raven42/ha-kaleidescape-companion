/** Explicit historical export; UUID retries never resubmit a second job. */
import { counted } from "../core/text";
import { LitElement, html, nothing } from "lit";
import type { PropertyValues } from "lit";
import type {
  JournalClient,
  Scope,
  CalendarStatus,
  PreparedMutation,
} from "../core/api";
import { errorCode, errorMessage } from "../core/api";
import { styles } from "./styles";
import { closeButton, dismissBackdrop } from "./dialog";

export class CalendarExport extends LitElement {
  static properties = {
    client: { attribute: false },
    scope: { attribute: false },
    disabled: { type: Boolean },
  };
  static styles = styles;
  client?: JournalClient;
  scope?: Scope;
  disabled = false;
  private status?: CalendarStatus;
  private pending?: PreparedMutation;
  private working = false;
  private error = "";
  private reviewToken = "";
  private generation = 0;
  private bound = "";
  private boundClient?: JournalClient;
  private timer?: ReturnType<typeof setTimeout>;
  protected willUpdate(changed: PropertyValues) {
    if (!changed.has("client") && !changed.has("scope")) return;
    const key = `${this.scope?.entry_id}:${this.scope?.dataset_id}`;
    if (key === this.bound && this.boundClient === this.client) return;
    this.clear();
    this.bound = key;
    this.boundClient = this.client;
    void this.refresh();
  }
  protected updated(changed: PropertyValues) {
    // A saved options flow can reload HA without remounting this Settings view.
    if (
      changed.has("disabled") &&
      changed.get("disabled") === true &&
      !this.disabled
    )
      void this.refresh();
  }
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
  private clear() {
    this.generation++;
    clearTimeout(this.timer);
    this.status = undefined;
    this.pending = undefined;
    this.working = false;
    this.error = "";
    this.reviewToken = "";
    this.renderRoot
      .querySelectorAll("dialog")
      .forEach((dialog) => dialog.close());
  }
  confirmNavigation() {
    return !this.working && !this.pending;
  }
  private fail(error: unknown) {
    if (errorCode(error) === "unauthorized") {
      this.clear();
      this.dispatchEvent(
        new CustomEvent("access-denied", { bubbles: true, composed: true }),
      );
    } else this.error = errorMessage(error);
    this.requestUpdate();
  }
  private async refresh() {
    if (!this.client || !this.scope) return;
    const generation = this.generation;
    clearTimeout(this.timer);
    try {
      const status = await this.client.calendarStatus(this.scope);
      if (generation !== this.generation) return;
      this.status = status;
      this.error = "";
      if (
        status.active ||
        status.maintenance?.enabled ||
        (status.job && !status.job.finished)
      )
        this.timer = setTimeout(() => void this.refresh(), 2000);
      this.requestUpdate();
    } catch (error) {
      if (generation === this.generation) this.fail(error);
    }
  }
  private async open() {
    await this.refresh();
    if (this.disabled || !this.status?.ready || this.status.active) return;
    await this.updateComplete;
    this.renderRoot.querySelector("dialog")?.showModal();
  }
  private close(event?: Event) {
    event?.preventDefault();
    const job = this.status?.job;
    if (job && !job.finished && this.client && this.scope)
      void this.client.calendarCancel(this.scope, job.job_id).catch(() => {});
    this.generation++;
    clearTimeout(this.timer);
    this.pending = undefined;
    this.working = false;
    this.error = "";
    this.requestUpdate();
    this.renderRoot
      .querySelectorAll("dialog")
      .forEach((dialog) => dialog.close());
  }
  private async start() {
    if (
      !this.client ||
      !this.scope ||
      this.working ||
      this.disabled ||
      !this.status?.ready
    )
      return;
    const generation = this.generation;
    this.pending ??= this.client.prepareCalendarSync(
      this.scope,
      this.status.fingerprint,
    );
    this.working = true;
    this.error = "";
    this.requestUpdate();
    try {
      await this.client.calendarSync(this.pending);
      if (generation !== this.generation) return;
      this.pending = undefined;
      this.renderRoot.querySelector("dialog")?.close();
      await this.refresh();
    } catch (error) {
      if (generation !== this.generation) return;
      if (
        [
          "unauthorized",
          "invalid_request",
          "conflict",
          "busy",
          "not_ready",
        ].includes(errorCode(error))
      )
        this.pending = undefined;
      this.fail(error);
    } finally {
      if (generation === this.generation) {
        this.working = false;
        this.requestUpdate();
      }
    }
  }
  private async cancel() {
    if (!this.client || !this.scope || !this.status?.job || this.working)
      return;
    const generation = this.generation;
    this.working = true;
    this.requestUpdate();
    try {
      await this.client.calendarCancel(this.scope, this.status.job.job_id);
      if (generation === this.generation) await this.refresh();
    } catch (error) {
      if (generation === this.generation) this.fail(error);
    } finally {
      if (generation === this.generation) {
        this.working = false;
        this.requestUpdate();
      }
    }
  }
  private async maintain(action: "run" | "acknowledge") {
    if (
      !this.client ||
      !this.scope ||
      !this.status ||
      this.disabled ||
      this.working
    )
      return;
    const generation = this.generation;
    this.working = true;
    this.requestUpdate();
    try {
      await this.client.calendarMaintain(
        this.scope,
        action,
        this.status.fingerprint,
        this.reviewToken,
      );
      if (generation !== this.generation) return;
      this.renderRoot
        .querySelectorAll("dialog")
        .forEach((dialog) => dialog.close());
      await this.refresh();
    } catch (error) {
      if (generation === this.generation) this.fail(error);
    } finally {
      if (generation === this.generation) {
        this.working = false;
        this.requestUpdate();
      }
    }
  }
  private async requestMaintenance() {
    if (this.disabled || this.working) return;
    const generation = this.generation;
    await this.refresh();
    if (
      generation !== this.generation ||
      this.error ||
      this.disabled ||
      this.working
    )
      return;
    const state = this.status?.maintenance;
    if (!state?.ready || state.active) return;
    if (state.quarantined || state.uncertain) {
      await this.updateComplete;
      this.renderRoot
        .querySelector<HTMLDialogElement>("#maintenance-run")
        ?.showModal();
    } else await this.maintain("run");
  }
  private renderMaintenance() {
    const state = this.status!.maintenance!;
    return html`<section aria-label="Full calendar sync">
      <h4>Full Sync</h4>
      <p>
        Uses the saved dedicated calendar and age window. Save settings before
        syncing.
      </p>
      <p role="status">
        ${state.active ? "Syncing…" : "Last successful sync: " + (state.last_success ? new Date(state.last_success).toLocaleString() : "Not yet")}
        · Pending delete: ${state.quarantined} ·
        ${counted(state.uncertain, "unconfirmed write")}
      </p>
      ${state.quarantined ? html`<p class="muted">Replaced and unmatched events remain visible until two unchanged scans at least ten minutes apart confirm cleanup. Changes restart this grace period. A forced sync keeps these safeguards.</p>` : nothing}
      ${
        Object.keys(state.counts).length
          ? html`<p class="muted">
              ${Object.entries(state.counts)
                .map(([name, count]) => `${count} ${name.replaceAll("_", " ")}`)
                .join(" · ")}
            </p>`
          : nothing
      }
      ${state.error ? html`<p class="warning">${state.error} ${state.failure_stage ? `Stage: ${state.failure_stage}. See Logs; enable DEBUG for content-free comparison details.` : ""}</p>` : nothing}
      ${!state.ready ? html`<p class="warning">The calendar must be available and support event reading, creation and deletion.</p>` : nothing}
      <div class="actions">
        <button
          ?disabled=${this.disabled || this.working || state.active || !state.ready}
          @click=${this.requestMaintenance}
        >
          Run Full Sync now
        </button>
        <button ?disabled=${this.working} @click=${this.refresh}>
          Refresh sync status
        </button>
        ${
          state.uncertain
            ? html`<button
                ?disabled=${this.disabled || this.working || state.active || !state.ready}
                @click=${() => {
                  this.reviewToken = state.review_token ?? "";
                  this.renderRoot
                    .querySelector<HTMLDialogElement>("dialog")
                    ?.showModal();
                }}
              >
                Review unconfirmed writes
              </button>`
            : nothing
        }
      </div>
      ${this.error ? html`<p class="error" role="alert">${this.error}</p>` : nothing}
      <dialog
        id="maintenance-review"
        class="database-dialog"
        @click=${dismissBackdrop}
        @cancel=${this.close}
        aria-labelledby="maintenance-review-title"
      >
        <div class="card-head">
          <h2 id="maintenance-review-title">
            Review unconfirmed calendar writes
          </h2>
          ${closeButton((event) => this.close(event))}
        </div>
        <p>
          Inspect the assigned calendar first. A write may already have
          succeeded. Check again uses reads to recover confirmed results without
          replaying them.
        </p>
        <p class="warning">
          Only after inspecting the calendar, acknowledge these attempts to
          permit new writes. A provider that still hides a successful event
          could produce a duplicate. Unmatched events remain subject to Full
          Sync deletion.
        </p>
        <div class="dialog-footer">
          <button
            ?disabled=${this.working}
            @click=${() => {
              this.close();
              void this.maintain("run");
            }}
          >
            Check again</button
          ><button
            class="primary"
            ?disabled=${this.working}
            @click=${() => this.maintain("acknowledge")}
          >
            I inspected the calendar · acknowledge
          </button>
        </div>
      </dialog>
      <dialog
        id="maintenance-run"
        class="database-dialog"
        @click=${dismissBackdrop}
        @cancel=${this.close}
        aria-labelledby="maintenance-run-title"
      >
        <div class="card-head">
          <h2 id="maintenance-run-title">
            Run Full Sync with pending operations?
          </h2>
          ${closeButton((event) => this.close(event))}
        </div>
        <p>
          Pending delete: ${state.quarantined} ·
          ${counted(state.uncertain, "unconfirmed write")}
        </p>
        <p class="warning">
          A forced sync rechecks pending operations. It does not bypass the
          deletion grace period or acknowledge unconfirmed writes. Eligible
          unmatched events on the dedicated calendar may be deleted.
        </p>
        <div class="dialog-footer">
          <button type="button" @click=${() => this.close()}>Cancel</button>
          <button
            type="button"
            class="primary"
            ?disabled=${this.working || this.disabled || state.active || !state.ready}
            @click=${() => this.maintain("run")}
          >
            Continue Full Sync
          </button>
        </div>
      </dialog>
    </section>`;
  }
  protected render() {
    if (this.status?.maintenance?.enabled) return this.renderMaintenance();
    const job = this.status?.job;
    return html`<section aria-label="Journal calendar export">
      <h4>Export Journal to calendar</h4>
      <p class="muted">
        Uses the saved calendar settings. Save any changes before exporting.
        Only completed Journal viewings are included.
      </p>
      <div class="actions">
        <button
          type="button"
          ?disabled=${this.disabled || this.working || !this.status?.ready || this.status.active}
          @click=${this.open}
        >
          Sync all watched movies to calendar</button
        ><button type="button" ?disabled=${this.working} @click=${this.refresh}>
          Refresh export status</button
        >${this.status?.active ? html`<button type="button" ?disabled=${this.working} @click=${this.cancel}>Cancel export</button>` : nothing}
      </div>
      ${
        job
          ? html`<p role="status">
              ${job.finished ? "Export finished" : "Export in progress"} ·
              ${counted(job.total, "viewing")} ·
              ${Object.entries(job.counts)
                .map(([state, count]) => `${count} ${state}`)
                .join(" · ")}
            </p>`
          : nothing
      }
      ${this.error ? html`<p role="alert" class="error">${this.error}</p>` : nothing}
      <dialog
        class="database-dialog"
        aria-labelledby="calendar-export-title"
        aria-describedby="calendar-export-summary"
        @click=${dismissBackdrop}
        @cancel=${this.close}
      >
        <div class="card-head">
          <h2 id="calendar-export-title">Export Journal to calendar</h2>
          ${closeButton((event) => this.close(event))}
        </div>
        <p id="calendar-export-summary">
          Create events for up to
          ${counted(this.status?.completed_viewings ?? 0, "completed viewing")}
          using the saved calendar and templates?
        </p>
        <p>
          Existing events with the same title and start/end times are skipped.
          Changing the title format may result in duplicate events. Descriptions
          on existing events are not updated.
        </p>
        <p class="warning">
          Movie/session details will be shared with the calendar provider and
          anyone who can read the calendar. Failed or uncertain writes require
          review. Cancelling stops unstarted items; created events remain.
        </p>
        ${
          this.pending
            ? html`<p role="alert">
                  The start result is unconfirmed. Retry the same request to
                  inspect or resume that job.
                </p>
                <button
                  type="button"
                  ?disabled=${this.working}
                  @click=${async () => {
                    if (
                      window.confirm(
                        "Discard this retry and inspect export status? The job may already be running.",
                      )
                    ) {
                      this.pending = undefined;
                      this.close();
                      await this.refresh();
                    }
                  }}
                >
                  Discard retry & inspect
                </button>`
            : nothing
        }
        <div class="dialog-footer">
          <button
            class="primary"
            type="button"
            ?disabled=${this.disabled || this.working || !this.status?.ready}
            @click=${this.start}
          >
            ${this.working ? "Starting…" : this.pending ? "Retry same export" : "Export Journal"}
          </button>
        </div>
      </dialog>
    </section>`;
  }
}
if (!customElements.get("kaleidescape-calendar-export"))
  customElements.define("kaleidescape-calendar-export", CalendarExport);
