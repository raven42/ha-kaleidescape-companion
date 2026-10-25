/** Admin journal management, shared by the HA panel and isolated Vite preview. */
import { LitElement, html, nothing } from "lit";
import type { PropertyValues } from "lit";
import { ApiError, JournalClient, errorCode, errorMessage } from "./api";
import type {
  Hass,
  JournalInfo,
  PreparedMutation,
  SessionPage,
  Viewing,
} from "./api";
import { draftData, draftFrom } from "./editor";
import type { Draft } from "./editor";
import { styles } from "./styles";

export class KaleidescapePanel extends LitElement {
  static properties = {
    hass: { attribute: false },
    client: { attribute: false },
    narrow: { type: Boolean },
  };
  static styles = styles;
  hass?: Hass;
  client?: JournalClient;
  narrow = false;
  private api: JournalClient | null = null;
  private haClient?: JournalClient;
  private haConnection?: Hass["connection"];
  private haUser?: string;
  private generation = 0;
  private listRequest = 0;
  private detailRequest = 0;
  private info: JournalInfo | null = null;
  private rows: Viewing[] = [];
  private selected: Viewing | null = null;
  private draft: Draft | null = null;
  private initial: Draft | null = null;
  private sessions: SessionPage | null = null;
  private sessionError = "";
  private query = "";
  private status = "";
  private searchText = "";
  private filterStatus = "";
  private cursor?: string;
  private nextCursor: string | null = null;
  private history: (string | undefined)[] = [];
  private page = 1;
  private loading = false;
  private detailLoading = false;
  private saving = false;
  private pending: PreparedMutation | null = null;
  private confirmDelete = false;
  private exporting = false;
  private exportAbort?: AbortController;
  private error = "";
  private lastError = "";
  private notice = "";

  protected willUpdate(changed: PropertyValues) {
    if (!changed.has("hass") && !changed.has("client")) return;
    if (this.hass) {
      if (!this.hass.user?.is_admin || !this.hass.connection.connected) {
        this.bind(null);
        return;
      }
      if (
        this.haConnection !== this.hass.connection ||
        this.haUser !== this.hass.user.id
      ) {
        this.haConnection = this.hass.connection;
        this.haUser = this.hass.user.id;
        this.haClient = new JournalClient({
          callWS: (message) => this.hass!.callWS(message),
          fetchWithAuth: (path, init) => this.hass!.fetchWithAuth(path, init),
        });
      }
      this.bind(this.haClient!);
    } else {
      this.bind(this.client ?? null);
    }
  }
  connectedCallback() {
    super.connectedCallback();
    this.requestUpdate("hass");
    this.requestUpdate("client");
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    this.bind(null);
  }
  private clearPrivate() {
    this.generation++;
    this.exportAbort?.abort();
    this.exportAbort = undefined;
    this.info = null;
    this.rows = [];
    this.selected = null;
    this.draft = null;
    this.initial = null;
    this.sessions = null;
    this.pending = null;
    this.history = [];
    this.nextCursor = null;
    this.cursor = undefined;
    this.page = 1;
    this.query = "";
    this.status = "";
    this.searchText = "";
    this.filterStatus = "";
    this.confirmDelete = false;
    this.saving = false;
    this.loading = false;
    this.detailLoading = false;
    this.exporting = false;
    this.sessionError = "";
    this.notice = "";
  }
  private bind(api: JournalClient | null) {
    if (this.api === api) return;
    this.clearPrivate();
    this.api = api;
    this.error = "";
    this.requestUpdate();
    if (api) void this.refresh();
  }
  private fail(error: unknown) {
    if (errorCode(error) === "unauthorized") this.clearPrivate();
    this.lastError = errorCode(error);
    this.error = errorMessage(error);
    this.requestUpdate();
  }
  private dirty() {
    return (
      this.draft && JSON.stringify(this.draft) !== JSON.stringify(this.initial)
    );
  }
  private discard() {
    return !this.dirty() || window.confirm("Discard your unsaved changes?");
  }
  private async refresh() {
    if (!this.api || this.pending || !this.discard()) return;
    const api = this.api,
      generation = ++this.generation;
    this.exportAbort?.abort();
    this.exporting = false;
    this.info = null;
    this.rows = [];
    this.closeEditor();
    this.loading = true;
    this.error = "";
    this.requestUpdate();
    try {
      const { entries } = await api.info();
      if (generation !== this.generation) return;
      if (!entries.length) throw new ApiError("not_ready");
      if (entries[0].api_version !== 1) throw new ApiError("not_ready");
      this.info = entries[0];
      this.history = [];
      this.cursor = undefined;
      this.page = 1;
      await this.loadList();
    } catch (error) {
      if (generation === this.generation) this.fail(error);
    } finally {
      if (generation === this.generation) {
        this.loading = false;
        this.requestUpdate();
      }
    }
  }
  private async loadList(cursor?: string) {
    if (!this.api || !this.info) return;
    const api = this.api,
      scope = this.info,
      generation = this.generation,
      request = ++this.listRequest;
    this.loading = true;
    this.error = "";
    this.requestUpdate();
    try {
      const result = await api.list(scope, this.query, this.status, cursor);
      if (generation !== this.generation || request !== this.listRequest)
        return;
      this.rows = result.items;
      this.cursor = cursor;
      this.nextCursor = result.next_cursor;
      this.info = { ...this.info!, revision: result.revision };
    } catch (error) {
      if (generation === this.generation && request === this.listRequest) {
        this.rows = [];
        this.nextCursor = null;
        this.fail(error);
      }
    } finally {
      if (generation === this.generation && request === this.listRequest) {
        this.loading = false;
        this.requestUpdate();
      }
    }
  }
  private async selectRecord(id: string) {
    if (!this.api || !this.info || this.pending || !this.discard()) return;
    this.closeEditor();
    const api = this.api,
      scope = this.info,
      generation = this.generation,
      request = ++this.detailRequest;
    this.detailLoading = true;
    this.error = "";
    this.notice = "";
    this.requestUpdate();
    try {
      const record = await api.get(scope, id);
      if (generation !== this.generation || request !== this.detailRequest)
        return;
      this.selected = record;
      this.draft = draftFrom(record);
      this.initial = { ...this.draft };
      this.detailLoading = false;
      this.requestUpdate();
      try {
        const sessions = await api.sessions(scope, id);
        if (generation === this.generation && request === this.detailRequest)
          this.sessions = sessions;
      } catch (error) {
        if (generation === this.generation && request === this.detailRequest) {
          if (errorCode(error) === "unauthorized") this.fail(error);
          else this.sessionError = "Session details could not be loaded.";
        }
      }
    } catch (error) {
      if (generation === this.generation && request === this.detailRequest)
        this.fail(error);
    } finally {
      if (generation === this.generation && request === this.detailRequest) {
        this.detailLoading = false;
        this.requestUpdate();
      }
    }
  }
  private closeEditor() {
    this.detailRequest++;
    this.selected = null;
    this.draft = null;
    this.initial = null;
    this.sessions = null;
    this.sessionError = "";
    this.confirmDelete = false;
    this.detailLoading = false;
  }
  private newRecord() {
    if (this.pending || !this.discard()) return;
    this.closeEditor();
    this.draft = draftFrom();
    this.initial = { ...this.draft };
    this.error = "";
    this.notice = "";
    this.requestUpdate();
    void this.updateComplete.then(() =>
      this.renderRoot.querySelector<HTMLInputElement>("#title")?.focus(),
    );
  }
  private input(field: keyof Draft, event: Event) {
    if (!this.draft) return;
    this.draft = {
      ...this.draft,
      [field]: (event.target as HTMLInputElement).value,
    };
    this.requestUpdate();
  }
  private async save(event: Event) {
    event.preventDefault();
    if (!this.api || !this.info || !this.draft || this.pending || this.saving)
      return;
    const form = event.target as HTMLFormElement;
    if (!form.reportValidity()) return;
    try {
      const data = draftData(
        this.draft,
        this.selected ? this.initial! : undefined,
      );
      if (this.selected && !Object.keys(data).length) {
        this.notice = "There are no changes to save.";
        this.requestUpdate();
        return;
      }
      if (data.ended_at && data.started_at && data.ended_at < data.started_at) {
        this.error = "The end time must be after the start time.";
        this.requestUpdate();
        return;
      }
      this.pending = this.api.prepare(
        this.info,
        this.selected ? "update" : "create",
        this.selected
          ? {
              viewing_id: this.selected.id,
              expected_revision: this.selected.revision,
              patch: data,
            }
          : { data },
      );
      await this.commit();
    } catch {
      this.error = "Check the dates and numeric fields before saving.";
      this.requestUpdate();
    }
  }
  private async deleteRecord() {
    if (!this.api || !this.info || !this.selected || this.pending) return;
    this.pending = this.api.prepare(this.info, "delete", {
      viewing_id: this.selected.id,
      expected_revision: this.selected.revision,
    });
    this.confirmDelete = false;
    await this.commit();
  }
  private async commit() {
    if (!this.api || !this.pending || this.saving) return;
    const api = this.api,
      pending = this.pending,
      generation = this.generation;
    this.saving = true;
    this.error = "";
    this.notice = "";
    this.requestUpdate();
    try {
      const result = await api.mutate(pending);
      if (generation !== this.generation) return;
      this.pending = null;
      this.closeEditor();
      this.notice = result.viewing.deleted_at
        ? "Entry removed from the journal. Stored history is retained."
        : "Entry saved.";
      if (!result.viewing.deleted_at) {
        this.selected = result.viewing;
        this.draft = draftFrom(result.viewing);
        this.initial = { ...this.draft };
      }
      this.page = 1;
      this.history = [];
      await this.loadList();
      // A failed refresh must not turn a confirmed commit into another write.
      try {
        const { entries } = await api.info();
        if (
          generation === this.generation &&
          entries[0]?.dataset_id === this.info?.dataset_id
        )
          this.info = entries[0];
      } catch (error) {
        if (generation === this.generation) this.fail(error);
      }
    } catch (error) {
      if (generation !== this.generation) return;
      if (
        ["invalid_request", "conflict", "unauthorized"].includes(
          errorCode(error),
        )
      )
        this.pending = null;
      this.fail(error);
    } finally {
      if (generation === this.generation) {
        this.saving = false;
        this.requestUpdate();
      }
    }
  }
  private async inspectJournal() {
    if (this.saving || !this.pending) return;
    if (
      !window.confirm(
        "This change may already have committed. Discard its retry and inspect the journal before adding it again?",
      )
    )
      return;
    this.pending = null;
    this.closeEditor();
    this.notice =
      "Retry discarded. Check the journal before recreating the change.";
    await this.refresh();
  }
  private async exportData(format: "json" | "sqlite") {
    if (!this.api || !this.info || this.exporting) return;
    const api = this.api,
      scope = this.info,
      generation = this.generation;
    const controller = (this.exportAbort = new AbortController());
    const timeout = setTimeout(() => controller.abort(), 65000);
    this.exporting = true;
    this.error = "";
    this.requestUpdate();
    try {
      const blob = await api.download(scope, format, controller.signal);
      if (generation !== this.generation) return;
      const url = URL.createObjectURL(blob),
        anchor = document.createElement("a");
      try {
        anchor.href = url;
        anchor.download = `kaleidescape-journal.${format}`;
        anchor.click();
      } finally {
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
      this.notice =
        "Export downloaded. Keep this private copy in a protected location.";
    } catch (error) {
      if (generation === this.generation) this.fail(error);
    } finally {
      clearTimeout(timeout);
      if (generation === this.generation) {
        this.exporting = false;
        this.exportAbort = undefined;
        this.requestUpdate();
      }
    }
  }
  private date(value: string) {
    return new Date(value).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }
  private bytes(value: number) {
    return `${(value / 1024 / 1024).toFixed(value < 1024 * 1024 ? 2 : 1)} MiB`;
  }
  private field(
    key: keyof Draft,
    label: string,
    type = "text",
    required = false,
    maxLength?: number,
  ) {
    return html`<label
      >${label}<input
        id=${key === "title" ? "title" : key}
        name=${key}
        type=${type}
        .value=${this.draft![key]}
        ?required=${required}
        maxlength=${maxLength ?? nothing}
        min=${type === "number" ? "0" : nothing}
        max=${type === "number" ? String(1e9 / 60) : nothing}
        step=${type === "datetime-local" ? "0.001" : "any"}
        @input=${(event: Event) => this.input(key, event)}
    /></label>`;
  }
  private renderEditor() {
    if (this.detailLoading)
      return html`<div class="empty" role="status">Loading entry…</div>`;
    if (!this.draft)
      return html`<div class="empty">
        <strong>Select an entry</strong>
        <p>Review its details, make corrections, or add a manual viewing.</p>
      </div>`;
    return html`<form class="editor" @submit=${this.save}>
      <fieldset ?disabled=${this.saving || !!this.pending}>
        <div class="grid">
          <div class="full">
            ${this.field("title", "Title", "text", true, 500)}
          </div>
          ${this.field("started_at", "Started · local time", "datetime-local", true)}
          ${this.field("ended_at", "Ended · local time", "datetime-local")}
          ${this.field("watched_seconds", "Watched minutes", "number", true)}
          ${this.field("duration_seconds", "Runtime minutes · optional", "number")}
          <label
            >Status<select
              name="record_status"
              .value=${this.draft.status}
              @change=${(event: Event) => this.input("status", event)}
            >
              <option value="partial">Partial</option>
              <option value="completed">Completed</option>
            </select></label
          >
          <label class="full"
            >Notes<textarea
              name="notes"
              maxlength="10000"
              .value=${this.draft.notes}
              @input=${(event: Event) => this.input("notes", event)}
            ></textarea>
          </label>
        </div>
        ${this.selected?.origin === "observed" ? html`<small>Only fields you change are marked as manual corrections. Session evidence is retained.</small>` : nothing}
        <details>
          <summary>Source identifiers</summary>
          <div class="grid">
            ${this.field("source_id", "Source ID", "text", false, 255)}
            ${this.field("player_id", "Player ID", "text", false, 255)}
            <div class="full">
              ${this.field("raw_content_id", "Raw content ID", "text", false, 255)}
            </div>
          </div>
          <small
            >Keep source identifiers exact. Titles do not establish movie
            identity.</small
          >
        </details>
        <div class="actions">
          <button type="submit" class="primary">
            ${this.saving ? "Saving…" : this.selected ? "Save changes" : "Add entry"}
          </button>
          <button
            type="button"
            @click=${() => {
              if (this.discard()) {
                this.closeEditor();
                this.requestUpdate();
              }
            }}
          >
            Cancel
          </button>
          ${
            this.selected
              ? html`<span class="grow"></span
                  ><button
                    type="button"
                    class="danger"
                    @click=${() => {
                      this.confirmDelete = true;
                      this.requestUpdate();
                    }}
                  >
                    Delete entry
                  </button>`
              : nothing
          }
        </div>
      </fieldset>
      ${
        this.confirmDelete
          ? html`<div class="warning">
              <strong>Remove this entry from the journal?</strong>
              <p>
                Stored history and backup copies are retained. This does not
                permanently erase the data.
              </p>
              <div class="actions">
                <button
                  type="button"
                  class="danger"
                  @click=${this.deleteRecord}
                >
                  Confirm deletion</button
                ><button
                  type="button"
                  @click=${() => {
                    this.confirmDelete = false;
                    this.requestUpdate();
                  }}
                >
                  Keep entry
                </button>
              </div>
            </div>`
          : nothing
      }
      ${
        this.selected
          ? html`<details>
              <summary>Record details & sessions</summary>
              <div class="metadata">
                Record ${this.selected.id}<br />Origin: ${this.selected.origin}
                · Revision ${this.selected.revision}<br />Updated
                ${this.date(this.selected.updated_at)}<br />Completion:
                ${this.selected.completion_reason ?? "Not completed"}
              </div>
              ${
                this.sessionError
                  ? html`<p>${this.sessionError}</p>`
                  : this.sessions
                    ? this.sessions.items.length
                      ? html` ${this.sessions.items.map((session) => html`<div class="session">${this.date(session.started_at)}<br />${(session.watched_seconds / 60).toFixed(1)} min watched · ${session.credits_confirmed ? "Credits confirmed" : "Credits unconfirmed"} · ${session.gap_count} timing gaps<br />${session.end_reason ?? "Open session"}</div>`)}
                        ${this.sessions.has_more ? html`<small>Showing the latest 100 sessions.</small>` : nothing}`
                      : html`<p class="muted">
                          No recorded sessions for this entry.
                        </p>`
                    : html`<p class="muted">
                        Session details have not been loaded. Reopen the entry
                        to load them.
                      </p>`
              }
            </details>`
          : nothing
      }
    </form>`;
  }
  protected render() {
    const blocked = this.loading || this.saving || !!this.pending;
    return html`<main>
      <header>
        ${this.hass && this.narrow ? html`<button class="menu" aria-label="Open sidebar" @click=${() => this.dispatchEvent(new CustomEvent("hass-toggle-menu", { bubbles: true, composed: true }))}>☰</button>` : nothing}
        <div class="grow">
          <span class="eyebrow">Kaleidescape · Administrator</span>
          <h1>Journal management</h1>
          <p>Review recordings and make corrections.</p>
        </div>
        <button
          class="primary"
          ?disabled=${!this.info || blocked}
          @click=${this.newRecord}
        >
          ＋ Add viewing
        </button>
      </header>
      ${this.error ? html`<div class="error" role="alert">${this.error}${this.lastError === "conflict" && this.selected ? html` <button ?disabled=${blocked} @click=${() => this.selectRecord(this.selected!.id)}>Reload entry</button>` : nothing}</div>` : nothing}
      ${this.notice ? html`<div class="notice" role="status">${this.notice}</div>` : nothing}
      ${
        this.pending && !this.saving
          ? html`<div class="warning">
              Retry the same change to confirm its result. The form is locked to
              prevent duplicate writes.
              <div class="actions">
                <button @click=${this.commit}>Retry same change</button>
                <button @click=${this.inspectJournal}>
                  Discard retry & inspect journal
                </button>
              </div>
            </div>`
          : nothing
      }
      ${
        !this.api
          ? html`<div class="empty">
              <strong>Connect through Home Assistant</strong>
              <p>
                Open Kaleidescape in HA with an administrator account, or
                connect the local development preview.
              </p>
            </div>`
          : !this.info
            ? html`<div class="empty" role="status">
                <strong
                  >${this.loading ? "Connecting to the journal…" : "Journal unavailable"}</strong
                >${!this.loading ? html`<button @click=${this.refresh}>Reload connection</button>` : nothing}
              </div>`
            : html`
                <section class="metrics" aria-label="Database overview">
                  <div class="metric">
                    <small>Journal entries</small
                    ><strong>${this.info.viewing_count}</strong>
                  </div>
                  <div class="metric">
                    <small>Database size</small
                    ><strong>${this.bytes(this.info.database_bytes)}</strong
                    ><small
                      >of ${this.bytes(this.info.database_limit_bytes)}</small
                    >
                  </div>
                  <div class="metric">
                    <small>Recording</small
                    ><strong
                      >${this.info.tracking_enabled ? "Enabled" : "Manual only"}</strong
                    >
                  </div>
                  <div class="metric">
                    <small>Storage</small
                    ><strong
                      >${this.info.backup_in_progress ? "Backing up" : "Ready"}</strong
                    ><small
                      >Schema ${this.info.schema_version} · Revision
                      ${this.info.revision}</small
                    >
                  </div>
                </section>
                <div class="layout">
                  <section class="card" aria-label="Journal entries">
                    <div class="card-head">
                      <h2>Viewings</h2>
                      <button ?disabled=${blocked} @click=${this.refresh}>
                        Refresh
                      </button>
                    </div>
                    <form
                      class="filters"
                      @submit=${(event: Event) => {
                        event.preventDefault();
                        this.query = this.searchText;
                        this.status = this.filterStatus;
                        this.page = 1;
                        this.history = [];
                        void this.loadList();
                      }}
                    >
                      <label
                        >Search titles<input
                          name="search"
                          type="search"
                          maxlength="500"
                          .value=${this.searchText}
                          ?disabled=${blocked}
                          @input=${(event: Event) => {
                            this.searchText = (
                              event.target as HTMLInputElement
                            ).value;
                          }}
                      /></label>
                      <label
                        >Status<select
                          name="filter_status"
                          .value=${this.filterStatus}
                          ?disabled=${blocked}
                          @change=${(event: Event) => {
                            this.filterStatus = (
                              event.target as HTMLSelectElement
                            ).value;
                          }}
                        >
                          <option value="">All</option>
                          <option value="partial">Partial</option>
                          <option value="completed">Completed</option>
                        </select></label
                      >
                      <button ?disabled=${blocked}>Search</button>
                    </form>
                    ${
                      this.loading
                        ? html`<div class="empty" role="status">
                            Loading viewings…
                          </div>`
                        : this.rows.length
                          ? html`<div class="table-wrap">
                              <table>
                                <thead>
                                  <tr>
                                    <th>Title</th>
                                    <th>Status</th>
                                    <th>Watched</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  ${this.rows.map(
                                    (record) =>
                                      html` <tr
                                        class=${this.selected?.id === record.id ? "selected" : ""}
                                      >
                                        <td>
                                          <button
                                            class="link"
                                            ?disabled=${this.saving || !!this.pending}
                                            @click=${() => this.selectRecord(record.id)}
                                          >
                                            ${record.title}</button
                                          ><small
                                            >${this.date(record.started_at)} ·
                                            ${record.origin === "observed" ? "Recorded" : "Manual"}</small
                                          >
                                        </td>
                                        <td>
                                          <span
                                            class=${`badge ${record.status === "completed" ? "complete" : ""}`}
                                            >${record.status === "completed" ? "Completed" : "Partial"}</span
                                          >
                                        </td>
                                        <td>
                                          ${(record.watched_seconds / 60).toFixed(1)}
                                          min
                                        </td>
                                      </tr>`,
                                  )}
                                </tbody>
                              </table>
                            </div>`
                          : html`<div class="empty">
                              <strong
                                >${this.query || this.status ? "No matching viewings" : "Your journal is empty"}</strong
                              >
                              <p>
                                ${this.query || this.status ? "Try another title or status." : "Add a manual viewing or enable automatic tracking in the integration settings."}
                              </p>
                            </div>`
                    }
                    <div class="pagination">
                      <small>Page ${this.page} · Up to 25 entries</small>
                      <div class="actions">
                        <button
                          ?disabled=${blocked || this.page === 1}
                          @click=${() => {
                            this.page = 1;
                            this.history = [];
                            void this.loadList();
                          }}
                        >
                          First
                        </button>
                        <button
                          ?disabled=${blocked || !this.history.length}
                          @click=${() => {
                            this.page--;
                            void this.loadList(this.history.pop());
                          }}
                        >
                          Previous
                        </button>
                        <button
                          ?disabled=${blocked || !this.nextCursor}
                          @click=${() => {
                            this.history.push(this.cursor);
                            if (this.history.length > 200) this.history.shift();
                            this.page++;
                            void this.loadList(this.nextCursor!);
                          }}
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  </section>
                  <section class="card" aria-label="Viewing editor">
                    <div class="card-head">
                      <h2>
                        ${this.selected ? "Edit viewing" : this.draft ? "New viewing" : "Viewing details"}
                      </h2>
                      ${this.dirty() ? html`<span class="badge">Unsaved</span>` : nothing}
                    </div>
                    ${this.renderEditor()}
                  </section>
                </div>
                <footer class="exports">
                  <small
                    >Exports include private history and deleted records. Store
                    downloads securely.</small
                  >
                  <button
                    ?disabled=${this.exporting || blocked}
                    @click=${() => this.exportData("json")}
                  >
                    ${this.exporting ? "Exporting…" : "Export JSON"}
                  </button>
                  <button
                    ?disabled=${this.exporting || blocked}
                    @click=${() => this.exportData("sqlite")}
                  >
                    Export SQLite
                  </button>
                </footer>
              `
      }
    </main>`;
  }
}
if (!customElements.get("kaleidescape-panel")) {
  customElements.define("kaleidescape-panel", KaleidescapePanel);
}
