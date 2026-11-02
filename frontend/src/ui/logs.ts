/** Administrator diagnostics; the server supplies already sanitized structured events. */
import { responsiveViewport } from "./viewport";
import { LitElement, css, html, nothing } from "lit";
import type { PropertyValues } from "lit";
import { live } from "lit/directives/live.js";
import { errorCode, errorMessage } from "../core/api";
import type { JournalClient, JournalInfo, LogPage } from "../core/api";
import { styles } from "./styles";
import { closeButton, dismissBackdrop } from "./dialog";
import { logMessage, logSource, logDetails, logText } from "./log-format";

export class KaleidescapeLogs extends LitElement {
  constructor() {
    super();
    responsiveViewport(this);
  }

  static properties = {
    client: { attribute: false },
    scope: { attribute: false },
  };
  static styles = [
    styles,
    css`
      .log-body {
        padding: 0 20px 20px;
      }
      section.card {
        overflow: visible;
      }
      .log-header {
        position: sticky;
        top: var(--companion-sticky-top, 0px);
        z-index: 15;
        background: var(--surface);
        border-radius: 12px 12px 0 0;
      }
      .log-header .log-body {
        padding-bottom: 0;
      }
      .log-inline-source {
        display: none;
      }
      th {
        position: sticky;
        top: 0;
        z-index: 1;
      }
      .log-scroll {
        overflow: auto;
        max-height: var(--entries-height, 65dvh);
        overscroll-behavior: contain;
      }
      .log-body .filters {
        padding: 0 0 12px;
        gap: 12px;
      }
      td,
      th {
        padding: 8px 10px;
        vertical-align: top;
      }
      .log-time,
      .log-source {
        white-space: nowrap;
        font-size: 12px;
      }
      .log-component {
        min-width: 90px;
      }
      .log-component small {
        display: block;
      }
      .log-message {
        min-width: 250px;
        line-height: 1.45;
        overflow-wrap: anywhere;
      }
      .log-detail {
        margin-top: 4px;
        font-size: 12px;
      }
      .log-detail summary {
        width: fit-content;
        cursor: pointer;
        color: var(--muted);
      }
      .log-detail .link {
        font: inherit;
        min-height: 24px;
        overflow-wrap: anywhere;
      }
      .log-detail dl {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr);
        gap: 6px 12px;
        margin: 10px 0;
      }
      .log-detail dt {
        color: var(--muted);
      }
      .log-detail dd {
        margin: 0;
        overflow-wrap: anywhere;
        white-space: pre-wrap;
      }
      .log-level {
        font-size: 11px;
        font-weight: 650;
      }
      .log-level[data-level="ERROR"],
      .log-level[data-level="CRITICAL"] {
        color: var(--error-color, #db4437);
      }
      .log-level[data-level="WARNING"] {
        color: var(--warning-color, #d68d13);
      }
      .log-options .grid {
        margin-top: 16px;
      }
      .log-status {
        font-size: 12px;
        margin: 12px 0;
      }
      .log-footer {
        position: sticky;
        bottom: 0;
        z-index: 14;
        background: var(--surface);
        padding-block: 6px max(6px, env(safe-area-inset-bottom));
        border-top: 1px solid var(--line);
      }
      .log-footer .actions {
        flex-wrap: nowrap;
        overflow-x: auto;
        padding-bottom: 2px;
      }
      .log-footer button {
        flex-shrink: 0;
      }
      .log-footer .log-status {
        margin: 0 0 6px;
      }
      @media (max-width: 600px) {
        .log-body {
          padding-inline: 10px;
          padding-bottom: 10px;
        }
        .log-body .filters {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
          gap: 6px 10px;
        }
        .log-body .filters > label:first-child,
        .log-body .filters > .check {
          grid-column: 1 / -1;
          min-width: 0;
        }
        .log-body .filters > .check {
          margin-block: 0;
          min-height: 32px;
        }
        table {
          table-layout: fixed;
        }
        td,
        th {
          padding: 8px 5px;
        }
        th:first-child,
        td:first-child {
          min-width: 0;
          width: 76px;
          max-width: none;
        }
        th:nth-child(2) {
          width: 56px;
        }
        .log-component,
        .log-component-heading,
        .log-source,
        .log-source-heading {
          display: none;
        }
        .log-message {
          min-width: 0;
          font-size: 12px;
        }
        .log-time {
          white-space: normal;
          font-size: 11px;
        }
        .log-inline-source {
          display: block;
          font-size: 11px;
          margin-top: 4px;
          overflow-wrap: anywhere;
        }
        .log-detail dl {
          grid-template-columns: minmax(0, 1fr);
          gap: 4px;
        }
        .log-detail dd {
          margin-bottom: 6px;
        }
        .log-footer button {
          font-size: 12px;
          padding-inline: 10px;
        }
      }
    `,
  ];
  client?: JournalClient;
  scope?: JournalInfo;
  private page?: LogPage;
  private level = "";
  private logger = "";
  private includeHidden = false;
  private reference = "";
  private busy = false;
  private error = "";
  private generation = 0;
  private cursors: (number | undefined)[] = [];
  private beforeId?: number;

  protected willUpdate(changed: PropertyValues) {
    if (changed.has("client") || changed.has("scope")) {
      this.generation++;
      this.page = undefined;
      this.cursors = [];
      this.beforeId = undefined;
      this.busy = false;
      this.error = "";
      if (this.client && this.scope?.permissions.edit) void this.load();
    }
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    this.generation++;
    this.page = undefined;
  }
  private fail(error: unknown) {
    this.error = errorMessage(error);
    if (errorCode(error) === "unauthorized") {
      this.page = undefined;
      this.dispatchEvent(
        new CustomEvent("access-denied", { bubbles: true, composed: true }),
      );
    }
  }
  private filters() {
    return {
      level: this.level,
      logger: this.logger,
      hidden: this.includeHidden,
      reference: this.reference,
    };
  }
  private async load(before?: number) {
    if (!this.client || !this.scope || this.busy) return;
    const generation = this.generation;
    this.busy = true;
    this.error = "";
    this.requestUpdate();
    try {
      const page = await this.client.logs(this.scope, "list", {
        filters: { ...this.filters(), before },
      });
      if (generation === this.generation) {
        this.page = page;
        this.beforeId = before;
      }
    } catch (error) {
      if (generation === this.generation) this.fail(error);
    } finally {
      if (generation === this.generation) {
        this.busy = false;
        this.requestUpdate();
      }
    }
  }
  private async change(
    operation: "configure" | "clear",
    data: Record<string, unknown>,
  ) {
    if (!this.client || !this.scope || this.busy) return;
    const generation = this.generation;
    this.busy = true;
    this.requestUpdate();
    try {
      const page = await this.client.logs(
        this.scope,
        operation,
        operation === "configure" ? { data } : data,
      );
      if (generation === this.generation) {
        const filtered =
          this.level || this.logger || this.includeHidden || this.reference
            ? await this.client.logs(this.scope, "list", {
                filters: this.filters(),
              })
            : page;
        if (generation !== this.generation) return;
        this.page = filtered;
        this.cursors = [];
        this.beforeId = undefined;
        this.renderRoot.querySelector<HTMLDialogElement>("#log-clear")?.close();
      }
    } catch (error) {
      if (generation === this.generation) this.fail(error);
    } finally {
      if (generation === this.generation) {
        this.busy = false;
        this.requestUpdate();
      }
    }
  }
  private async download(format: "json" | "text") {
    if (!this.client || !this.scope || this.busy) return;
    const generation = this.generation,
      client = this.client,
      scope = this.scope;
    this.busy = true;
    this.requestUpdate();
    try {
      let before: number | undefined;
      let through: number | undefined;
      const rows: Record<string, unknown>[] = [];
      let banner = "",
        bytes = 0;
      do {
        const page = await client.logs(scope, "export", {
          filters: { ...this.filters(), before, through, limit: 500 },
        });
        if (generation !== this.generation) return;
        through ??= page.through;
        banner = page.banner;
        bytes += new TextEncoder().encode(JSON.stringify(page.items)).length;
        if (bytes > 8 * 1024 * 1024 || rows.length + page.items.length > 50000)
          throw new Error("Export exceeds limit");
        rows.push(...page.items);
        before = page.before ?? undefined;
      } while (before !== undefined);
      const content =
        format === "json"
          ? JSON.stringify({ banner, entries: rows }, null, 2)
          : banner + "\n\n" + rows.map(logText).join("\n\n");
      const url = URL.createObjectURL(
        new Blob([content], {
          type: format === "json" ? "application/json" : "text/plain",
        }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = `companion-logs.${format === "json" ? "json" : "txt"}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      if (generation === this.generation) this.fail(error);
    } finally {
      if (generation === this.generation) {
        this.busy = false;
        this.requestUpdate();
      }
    }
  }
  protected render() {
    if (!this.scope?.permissions.edit) return nothing;
    return html`<section class="card">
        <div class="entries-header log-header">
          <div class="card-head">
            <h2>Operational logs</h2>
            <button
              ?disabled=${this.busy}
              @click=${() => {
                this.cursors = [];
                void this.load();
              }}
            >
              Refresh
            </button>
            <button
              ?disabled=${this.busy}
              @click=${() => this.renderRoot.querySelector<HTMLDialogElement>("#log-options")?.showModal()}
            >
              Options
            </button>
          </div>
          <div class="log-body">
            ${this.error ? html`<p class="error" role="alert">${this.error}</p>` : nothing}
            <div class="filters">
              <label
                >Linked resource / request<input
                  name="filter-reference"
                  maxlength="64"
                  placeholder="Paste an alias from Details"
                  .value=${this.reference}
                  ?disabled=${this.busy}
                  @change=${(e: Event) => {
                    this.reference = (
                      e.target as HTMLInputElement
                    ).value.trim();
                    this.cursors = [];
                    void this.load();
                  }}
              /></label>
              <label
                >Minimum level<select
                  name="filter-level"
                  .value=${this.level}
                  ?disabled=${this.busy}
                  @change=${(e: Event) => {
                    this.level = (e.target as HTMLSelectElement).value;
                    this.cursors = [];
                    void this.load();
                  }}
                >
                  <option value="">All</option>
                  ${["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"].map((l) => html`<option>${l}</option>`)}
                </select></label
              >
              <label
                >Subsystem<select
                  name="filter-logger"
                  .value=${this.logger}
                  ?disabled=${this.busy}
                  @change=${(e: Event) => {
                    this.logger = (e.target as HTMLSelectElement).value;
                    this.cursors = [];
                    void this.load();
                  }}
                >
                  <option value="">All</option>
                  ${this.page?.loggers.map((l) => html`<option>${l}</option>`)}
                </select></label
              >
              <label class="check"
                ><input
                  name="show-hidden"
                  type="checkbox"
                  .checked=${this.includeHidden}
                  ?disabled=${this.busy}
                  @change=${(e: Event) => {
                    this.includeHidden = (e.target as HTMLInputElement).checked;
                    this.cursors = [];
                    void this.load();
                  }}
                />Include cleared logs</label
              >
            </div>
          </div>
        </div>
        <div class="log-body">
          <div class="log-scroll">
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Level</th>
                  <th class="log-component-heading">Subsystem</th>
                  <th>Message</th>
                  <th class="log-source-heading">Source</th>
                </tr>
              </thead>
              <tbody>
                ${this.page?.items.map(
                  (row) =>
                    html`<tr>
                      <td class="log-time" title=${String(row.timestamp)}>
                        ${new Date(String(row.timestamp)).toLocaleDateString()}<br />${new Date(String(row.timestamp)).toLocaleTimeString()}
                      </td>
                      <td class="log-level" data-level=${String(row.level)}>
                        ${row.level}
                      </td>
                      <td class="log-component">
                        <strong>${row.logger}</strong
                        ><small>${row.operation}</small>
                      </td>
                      <td class="log-message">
                        ${logMessage(row)}
                        <small
                          class="log-inline-source"
                          title=${logSource(row, true)}
                          >${logSource(row)}</small
                        >
                        ${
                          logDetails(row).length
                            ? html`<details class="log-detail">
                                <summary>Details</summary>
                                <dl>
                                  ${logDetails(row).map(
                                    ([label, value]) =>
                                      html`<dt>${label}</dt>
                                        <dd>
                                          ${
                                            /^[a-z_]+-[0-9a-f]{24}$/.test(value)
                                              ? html`<button
                                                  class="link"
                                                  type="button"
                                                  ?disabled=${this.busy}
                                                  @click=${() => {
                                                    this.reference = value;
                                                    this.cursors = [];
                                                    void this.load();
                                                  }}
                                                >
                                                  ${value}
                                                </button>`
                                              : value
                                          }
                                        </dd>`,
                                  )}
                                </dl>
                              </details>`
                            : nothing
                        }
                      </td>
                      <td class="log-source">
                        <code title=${logSource(row, true)}
                          >${logSource(row)}</code
                        >
                      </td>
                    </tr>`,
                )}
              </tbody>
            </table>
          </div>
          <footer class="entries-footer log-footer">
            <p class="muted log-status">
              ${this.page?.retained ?? 0} retained ·
              ${((this.page?.bytes ?? 0) / 1048576).toFixed(2)} / 5 MiB ·
              Dropped: ${this.page?.dropped ?? 0} · Storage/sink failures:
              ${(this.page?.storage_failures ?? 0) + (this.page?.sink_failures ?? 0)}
            </p>

            <div class="actions">
              <button
                ?disabled=${this.busy || !this.cursors.length}
                @click=${() => this.load(this.cursors.pop())}
              >
                Previous</button
              ><button
                ?disabled=${this.busy || !this.page?.before}
                @click=${() => {
                  this.cursors.push(this.beforeId);
                  void this.load(this.page!.before!);
                }}
              >
                Next</button
              ><button
                ?disabled=${this.busy || !this.page}
                @click=${() => this.download("text")}
              >
                Export text</button
              ><button
                ?disabled=${this.busy || !this.page}
                @click=${() => this.download("json")}
              >
                Export JSON</button
              ><button
                ?disabled=${this.busy || !this.page}
                @click=${() => this.renderRoot.querySelector<HTMLDialogElement>("#log-clear")?.showModal()}
              >
                Clear logs
              </button>
            </div>
          </footer>
        </div>
      </section>
      <dialog id="log-clear" class="database-dialog" @click=${dismissBackdrop}>
        <div class="card-head">
          <h2>Clear logs?</h2>
          ${closeButton(() => this.renderRoot.querySelector<HTMLDialogElement>("#log-clear")?.close())}
        </div>
        <p>
          This hides retained entries through the last refresh. Include cleared
          logs to see them again. Oldest entries are evicted when the 5 MiB
          retention limit is reached.
        </p>
        <div class="dialog-footer">
          <button
            class="primary"
            ?disabled=${this.busy}
            @click=${() => this.change("clear", { through: this.page!.through })}
          >
            Clear logs
          </button>
        </div>
      </dialog>
      <dialog
        id="log-options"
        class="database-dialog log-options"
        @click=${dismissBackdrop}
      >
        <div class="card-head">
          <h2>Logging options</h2>
          ${closeButton(() => this.renderRoot.querySelector<HTMLDialogElement>("#log-options")?.close())}
        </div>
        <p class="notice">
          ${this.page?.banner ?? "Logs contain structured events and opaque resource IDs. No credentials or network identities."}
        </p>
        ${this.error ? html`<p class="error" role="alert">${this.error}</p>` : nothing}
        <div class="grid">
          <label
            >Logging level · applies immediately<select
              name="log-level"
              .value=${live(this.page?.config.level ?? "INFO")}
              ?disabled=${this.busy || !this.page}
              @change=${(e: Event) => this.change("configure", { level: (e.target as HTMLSelectElement).value })}
            >
              ${["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"].map((l) => html`<option value=${l} ?selected=${l === (this.page?.config.level ?? "INFO")}>${l}</option>`)}
            </select></label
          >
          <label class="check"
            ><input
              name="log-values"
              type="checkbox"
              .checked=${this.page?.config.log_values ?? false}
              ?disabled=${this.busy || !this.page}
              @change=${(e: Event) => this.change("configure", { log_values: (e.target as HTMLInputElement).checked })}
            />Log database values · movie metadata only</label
          >
        </div>
        <p class="muted">
          Value logging can retain movie titles/person metadata in logs and
          exports. It never enables credentials, notes, account or network
          values. Disabling does not erase prior logs.
        </p>

        <p class="muted">
          Changes apply immediately. Exports use the active filters. Source
          paths are package-relative; older entries may have no recorded source.
        </p>
      </dialog>`;
  }
}
customElements.define("kaleidescape-logs", KaleidescapeLogs);
