import "./journal-calendar";
import "./viewing-library";
/** Admin journal management, shared by the HA panel and isolated Vite preview. */
import { counted } from "../core/text";
import { LitElement, html, nothing } from "lit";
import type { PropertyValues } from "lit";
import { ApiError, JournalClient, errorCode, errorMessage } from "../core/api";
import type {
  Hass,
  JournalInfo,
  PreparedMutation,
  SessionPage,
  Viewing,
} from "../core/api";
import { draftData, draftFrom, renderDraftFields } from "./editor";
import type { Draft } from "./editor";
import { manualDraft, manualData } from "./manual-viewing";
import type { ManualDraft } from "./manual-viewing";
import type { TitleSelection } from "./library-title-picker";
import { styles } from "./styles";
import { entryLayoutStyles } from "./entry-layout.styles";
import { journalStyles, viewingDetails, viewingListRow } from "./journal-view";
import { dismissBackdrop } from "./dialog";
import { landingPage, rememberPage } from "./navigation";
import "./reader";
import "./journal-options";
import type { JournalOptionsValue } from "./journal-options";
import type { LibraryCriterion } from "../library/criteria";
import "../playback/now-playing";
import "./settings";
import "./database";
import "../library/library";
import type { KaleidescapeSettings } from "./settings";
import type { KaleidescapeDatabase } from "./database";
import type { KaleidescapeLibrary } from "../library/library";
import type { ViewingSummary } from "../core/api";

const PAGES = [
  {
    id: "now-playing",
    label: "Now Playing",
    description: "Live playback and recording context.",
  },
  {
    id: "library",
    label: "Library",
    description: "Browse cached titles, collections, and source metadata.",
  },
  {
    id: "journal",
    label: "Journal",
    description: "Review recordings and make corrections.",
  },
  {
    id: "database",
    label: "Database",
    description: "Inspect entries and manage stored history.",
  },
  {
    id: "settings",
    label: "Settings",
    description: "Configure playback recording and journal rules.",
  },
] as const;
type Page = (typeof PAGES)[number]["id"];

export class KaleidescapePanel extends LitElement {
  static properties = {
    hass: { attribute: false },
    client: { attribute: false },
    narrow: { type: Boolean },
  };
  static styles = [styles, entryLayoutStyles, journalStyles];
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
  private rows: ViewingSummary[] = [];
  private selected: Viewing | null = null;
  private editMovieId: string | null = null;
  private editTitleTouched = false;
  private draft: Draft | null = null;
  private initial: Draft | null = null;
  private manual: ManualDraft | null = null;
  private manualInitial = "";
  private sort = "completed_at";
  private descending = true;
  private fuzzySearch = true;
  private journalView: "list" | "calendar" = "list";
  private calendarSize = 180;
  private calendarFit = false;
  private journalMovie?: { id: string; title: string };
  private libraryTitleId?: string;
  private libraryCriterion?: LibraryCriterion;
  private journalReady = false;
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
  private error = "";
  private lastError = "";
  private notice = "";
  private activePage: Page = "journal";
  private navigationReady = false;
  private settingsBusy = false;
  private maintenanceBusy = false;

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
    this.manual = null;
    this.manualInitial = "";
    this.sort = "completed_at";
    this.descending = true;
    this.generation++;
    this.info = null;
    this.rows = [];
    this.selected = null;
    this.editMovieId = null;
    this.editTitleTouched = false;
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
    this.sessionError = "";
    this.notice = "";
    this.activePage = "journal";
    this.navigationReady = false;
    this.settingsBusy = this.maintenanceBusy = false;
    this.fuzzySearch = true;
    this.journalView = "list";
    this.calendarSize = 180;
    this.calendarFit = false;
    this.journalMovie = undefined;
    this.libraryTitleId = undefined;
    this.libraryCriterion = undefined;
    this.journalReady = false;
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
    return this.manual
      ? JSON.stringify(this.manual) !== this.manualInitial
      : this.draft &&
          (this.editTitleTouched ||
            JSON.stringify(this.draft) !== JSON.stringify(this.initial));
  }
  private discard() {
    return (
      (!this.dirty() || window.confirm("Discard your unsaved changes?")) &&
      (this.activePage !== "library" ||
        (this.renderRoot
          .querySelector<KaleidescapeLibrary>("kaleidescape-library")
          ?.confirmNavigation() ??
          true)) &&
      (this.activePage !== "database" ||
        (this.renderRoot
          .querySelector<KaleidescapeDatabase>("kaleidescape-database")
          ?.confirmNavigation() ??
          true)) &&
      (this.activePage !== "settings" ||
        (this.renderRoot
          .querySelector<KaleidescapeSettings>("kaleidescape-settings")
          ?.confirmNavigation() ??
          true))
    );
  }
  private async switchPage(
    page: Page,
    target?: {
      movie?: { id: string; title: string };
      libraryTitleId?: string;
      libraryCriterion?: LibraryCriterion;
    },
  ) {
    if (
      (page === "library" && !this.info?.library_enabled) ||
      (page === this.activePage &&
        !(page === "journal" && this.journalMovie)) ||
      this.loading ||
      this.saving ||
      this.pending ||
      this.maintenanceBusy ||
      this.settingsBusy ||
      !this.discard()
    )
      return;
    this.closeEditor();
    this.libraryTitleId = target?.libraryTitleId;
    this.libraryCriterion = target?.libraryCriterion;
    if (page === "journal") {
      this.journalMovie = target?.movie;
      this.query = this.searchText = "";
      this.status = this.filterStatus = "";
    }
    this.activePage = page;
    rememberPage(page);
    this.error = this.notice = "";
    this.requestUpdate();
    if (page === "journal") {
      this.page = 1;
      this.history = [];
      await this.loadList();
    }
  }
  private pageKey(event: KeyboardEvent) {
    const pages = PAGES.filter(
      (page) => page.id !== "library" || this.info?.library_enabled,
    );
    const current = pages.findIndex((page) => page.id === this.activePage);
    const index =
      event.key === "ArrowRight"
        ? (current + 1) % pages.length
        : event.key === "ArrowLeft"
          ? (current + pages.length - 1) % pages.length
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? pages.length - 1
              : -1;
    if (index < 0) return;
    event.preventDefault();
    const switching = this.switchPage(pages[index].id);
    // A Journal refresh may disable tabs while it runs; focus after it completes.
    void switching
      .then(() => this.updateComplete)
      .then(() =>
        this.renderRoot
          .querySelector<HTMLButtonElement>(`#page-${this.activePage}`)
          ?.focus(),
      );
  }
  private async refresh(waitForReload = false) {
    if (!this.api || this.pending || !this.discard()) return;
    const api = this.api,
      generation = ++this.generation;
    this.info = null;
    this.rows = [];
    this.closeEditor();
    this.loading = true;
    this.error = "";
    this.requestUpdate();
    try {
      let { entries } = await api.info();
      for (
        let attempt = 0;
        waitForReload && !entries.length && attempt < 20;
        attempt++
      ) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        if (generation !== this.generation) return;
        ({ entries } = await api.info());
      }
      if (generation !== this.generation) return;
      if (!entries.length) throw new ApiError("not_ready");
      if (entries[0].api_version !== 1) throw new ApiError("not_ready");
      this.info = entries[0];
      if (!this.info.permissions.edit) return;
      if (!this.navigationReady) {
        this.activePage = landingPage(
          this.info.ui_defaults?.default_landing_page,
          true,
          !!this.info.library_enabled,
        );
        this.navigationReady = true;
        rememberPage(this.activePage);
      }
      if (this.activePage === "library" && !this.info.library_enabled) {
        this.activePage = "journal";
        rememberPage(this.activePage);
      }
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
      const result = await api.list(
        scope,
        this.query,
        this.status,
        cursor,
        this.sort,
        this.descending,
        this.fuzzySearch,
        this.journalMovie?.id,
      );
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
      this.draft = this.initial = null;
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
    this.renderRoot
      .querySelectorAll<HTMLDialogElement>("dialog")
      .forEach((dialog) => dialog.close());
    this.manual = null;
    this.manualInitial = "";
    this.detailRequest++;
    this.selected = null;
    this.editMovieId = null;
    this.editTitleTouched = false;
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
    this.manual = manualDraft();
    this.manualInitial = JSON.stringify(this.manual);
    this.error = "";
    this.notice = "";
    this.requestUpdate();
    void this.updateComplete.then(async () => {
      this.renderRoot
        .querySelector<HTMLDialogElement>("#journal-editor")
        ?.showModal();
      const fields = this.renderRoot.querySelector<LitElement>(
        "kaleidescape-manual-viewing",
      );
      await fields?.updateComplete;
      const picker = fields?.shadowRoot?.querySelector<LitElement>(
        "kaleidescape-library-title-picker",
      );
      await picker?.updateComplete;
      picker?.shadowRoot?.querySelector<HTMLInputElement>("input")?.focus();
    });
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
    if (!this.manual && this.editTitleTouched && !this.editMovieId) {
      this.error = "Select a Library movie from the suggestions.";
      this.requestUpdate();
      return;
    }
    try {
      const data = this.manual
        ? manualData(this.manual)
        : {
            ...draftData(this.draft, this.selected ? this.initial! : undefined),
            ...(this.editTitleTouched
              ? { library_title_id: this.editMovieId! }
              : {}),
          };
      if (!this.manual) delete (data as { title?: string }).title;
      if (this.selected && !Object.keys(data).length) {
        this.notice = "There are no changes to save.";
        this.requestUpdate();
        return;
      }
      if (
        "ended_at" in data &&
        data.ended_at &&
        data.started_at &&
        data.ended_at < data.started_at
      ) {
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
    } catch (error) {
      if (errorCode(error) === "request_id_unavailable") this.fail(error);
      else {
        this.error =
          this.manual && error instanceof Error
            ? error.message
            : "Check the dates and numeric fields before saving.";
        this.requestUpdate();
      }
    }
  }
  private async deleteRecord() {
    if (!this.api || !this.info || !this.selected || this.pending) return;
    try {
      this.pending = this.api.prepare(this.info, "delete", {
        viewing_id: this.selected.id,
        expected_revision: this.selected.revision,
      });
      await this.commit();
    } catch (error) {
      this.fail(error);
    }
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
        this.manual = null;
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
  private date(value: string | null) {
    if (!value) return "—";
    return new Date(value).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }
  private bytes(value: number) {
    return `${(value / 1024 / 1024).toFixed(value < 1024 * 1024 ? 2 : 1)} MiB`;
  }
  private async refreshInfo() {
    if (!this.api) return;
    const generation = this.generation;
    try {
      const { entries } = await this.api.info();
      if (
        generation === this.generation &&
        entries[0]?.dataset_id === this.info?.dataset_id
      ) {
        this.info = entries[0];
        this.requestUpdate();
      }
    } catch (error) {
      if (generation === this.generation) this.fail(error);
    }
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
        ${
          this.manual
            ? html`<kaleidescape-manual-viewing
                .client=${this.api}
                .scope=${this.info}
                .draft=${this.manual}
                .fuzzySearch=${this.fuzzySearch}
                .disabled=${this.saving || !!this.pending}
                @draft-change=${(event: CustomEvent<ManualDraft>) => {
                  this.manual = event.detail;
                  this.requestUpdate();
                }}
                @access-denied=${() => this.fail(new ApiError("unauthorized"))}
              ></kaleidescape-manual-viewing>`
            : renderDraftFields(
                this.draft,
                (key, event) => this.input(key, event),
                html`<kaleidescape-library-title-picker
                    .client=${this.api}
                    .scope=${this.info}
                    .initialTitle=${this.initial?.title ?? ""}
                    .value=${this.editMovieId ?? ""}
                    .requireRuntime=${false}
                    .fuzzySearch=${this.fuzzySearch}
                    .disabled=${this.saving || !!this.pending || !this.info?.library_enabled}
                    @title-selection=${(event: CustomEvent<TitleSelection>) => {
                      if (!this.draft) return;
                      this.editTitleTouched = true;
                      this.editMovieId = event.detail.movie?.id ?? null;
                      this.draft = { ...this.draft, title: event.detail.query };
                      this.requestUpdate();
                    }}
                    @access-denied=${() => this.fail(new ApiError("unauthorized"))}
                  ></kaleidescape-library-title-picker>
                  <small
                    >Selecting a different movie keeps the recorded times and
                    watched minutes. Adjust those fields separately if
                    needed.</small
                  >
                  ${!this.info?.library_enabled ? html`<small>Enable Library to change the movie. Existing timing and notes can still be corrected.</small>` : nothing}`,
              )
        }
        ${this.selected?.origin === "observed" ? html`<small>Only fields you change are marked as manual corrections. Session evidence is retained.</small>` : nothing}
        <div class="actions dialog-footer">
          ${this.selected && !this.manual ? html`<button type="button" class="danger delete-viewing" @click=${this.openDelete}>Delete entry</button>` : nothing}
          <button type="button" @click=${this.cancelEdit}>Cancel</button>
          <button type="submit" class="primary">
            ${this.saving ? "Saving…" : this.selected ? "Save changes" : "Add entry"}
          </button>
        </div>
      </fieldset>
    </form>`;
  }
  private async editCalendarViewing(id: string) {
    if (
      !this.info?.permissions.edit ||
      this.activePage !== "journal" ||
      this.journalView !== "calendar" ||
      this.loading ||
      this.saving ||
      this.pending ||
      this.detailLoading
    )
      return;
    const generation = this.generation;
    // Refetch the administrator record: the compact calendar has no edit revision.
    const selection = this.selectRecord(id);
    const request = this.detailRequest;
    await selection;
    if (
      generation === this.generation &&
      request === this.detailRequest &&
      this.selected?.id === id &&
      !this.draft &&
      this.info?.permissions.edit
    )
      this.editRecord();
  }
  private editRecord() {
    if (!this.selected || this.pending || this.saving) return;
    this.draft = draftFrom(this.selected);
    this.editMovieId = null;
    this.editTitleTouched = false;
    this.initial = { ...this.draft };
    this.error = this.notice = "";
    this.requestUpdate();
    void this.updateComplete.then(() =>
      this.renderRoot
        .querySelector<HTMLDialogElement>("#journal-editor")
        ?.showModal(),
    );
  }
  private async reloadSelected() {
    if (!this.selected) return;
    const id = this.selected.id,
      editing = !!this.draft;
    await this.selectRecord(id);
    if (editing && this.selected?.id === id && !this.draft) this.editRecord();
  }
  private cancelEdit(event?: Event) {
    event?.preventDefault();
    if (this.saving || this.pending || !this.discard()) return;
    this.draft = this.initial = null;
    this.editMovieId = null;
    this.editTitleTouched = false;
    this.manual = null;
    this.manualInitial = "";
    this.renderRoot
      .querySelector<HTMLDialogElement>("#journal-editor")
      ?.close();
    this.requestUpdate();
  }
  private openDelete() {
    if (!this.selected || this.saving || this.pending || !this.discard())
      return;
    this.confirmDelete = true;
    this.requestUpdate();
    void this.updateComplete.then(() =>
      this.renderRoot
        .querySelector<HTMLDialogElement>("#journal-delete")
        ?.showModal(),
    );
  }
  private cancelDelete(event?: Event) {
    event?.preventDefault();
    if (this.saving || this.pending) return;
    this.confirmDelete = false;
    this.renderRoot
      .querySelector<HTMLDialogElement>("#journal-delete")
      ?.close();
    this.requestUpdate();
  }
  private renderEvidence() {
    return html`
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
                      ? html` ${this.sessions.items.map((session) => html`<div class="session">${this.date(session.started_at)}<br />${(session.watched_seconds / 60).toFixed(2)} min watched · ${session.credits_confirmed ? "Credits confirmed" : "Credits unconfirmed"} · ${counted(session.gap_count, "timing gap")}<br />${session.end_reason ?? "Open session"}</div>`)}
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
    `;
  }
  private renderJournal() {
    const blocked = this.loading || this.saving || !!this.pending;
    const retry =
      this.pending && !this.saving
        ? html`<p class="warning">
              The result is unconfirmed. Retry the same change before making
              another change.
            </p>
            <div class="actions">
              <button @click=${this.commit}>Retry same change</button
              ><button @click=${this.inspectJournal}>
                Discard retry & inspect journal
              </button>
            </div>`
        : nothing;
    return html`<section class="card journal" aria-label="Journal">
        <div class="entries-header">
          <div class="journal-toolbar">
            <button
              class="primary"
              ?disabled=${blocked || !this.journalReady}
              @click=${this.newRecord}
            >
              ＋ Add viewing
            </button>
            <button ?disabled=${blocked} @click=${() => this.refresh()}>
              Refresh
            </button>
            <kaleidescape-journal-options
              .client=${this.api}
              .scope=${this.info}
              .disabled=${blocked}
              @access-denied=${() => this.fail(new ApiError("unauthorized"))}
              @journal-options=${(event: CustomEvent<JournalOptionsValue>) => {
                this.journalReady = true;
                this.journalView = event.detail.view;
                this.calendarSize = event.detail.calendar_size;
                this.calendarFit = event.detail.calendar_fit;
                const changed = this.fuzzySearch !== event.detail.fuzzy_search;
                this.fuzzySearch = event.detail.fuzzy_search;
                if (changed) {
                  this.history = [];
                  this.page = 1;
                  void this.loadList();
                }
                this.requestUpdate();
              }}
            ></kaleidescape-journal-options>
          </div>
          ${this.journalMovie ? html`<p class="journal-movie-filter">Viewings for ${this.journalMovie.title} <button ?disabled=${blocked} @click=${() => this.switchPage("journal")}>Show all viewings</button></p>` : nothing}
          <form
            class="filters journal-filters"
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
                  this.searchText = (event.target as HTMLInputElement).value;
                }}
            /></label>
            <label
              >Status<select
                name="filter_status"
                .value=${this.filterStatus}
                ?disabled=${blocked}
                @change=${(event: Event) => {
                  this.filterStatus = (event.target as HTMLSelectElement).value;
                }}
              >
                <option value="">All</option>
                <option value="partial">Partial</option>
                <option value="completed">Completed</option>
              </select></label
            >
            <label ?hidden=${this.journalView === "calendar"}
              >Sort by<select
                name="journal_sort"
                .value=${this.sort}
                ?disabled=${blocked}
                @change=${(event: Event) => {
                  this.sort = (event.target as HTMLSelectElement).value;
                  this.page = 1;
                  this.history = [];
                  void this.loadList();
                }}
              >
                <option value="completed_at">
                  Completed date · partial first
                </option>
                <option value="title">Title</option>
              </select></label
            >
            <button
              type="button"
              ?hidden=${this.journalView === "calendar"}
              ?disabled=${blocked}
              @click=${() => {
                this.descending = !this.descending;
                this.page = 1;
                this.history = [];
                void this.loadList();
              }}
            >
              ${this.descending ? "Descending ↓" : "Ascending ↑"}
            </button>
            <button ?disabled=${blocked}>Search</button>
          </form>
        </div>
        ${
          this.journalView === "calendar"
            ? html`<kaleidescape-journal-calendar
                .client=${this.api ?? undefined}
                .scope=${this.info ?? undefined}
                .query=${this.query}
                .status=${this.status}
                .fuzzy=${this.fuzzySearch}
                .libraryTitleId=${this.journalMovie?.id}
                .daySize=${this.calendarSize}
                .fitScreen=${this.calendarFit}
                .disabled=${blocked || this.detailLoading}
                .editable=${true}
                @edit-viewing=${(event: CustomEvent<string>) => this.editCalendarViewing(event.detail)}
                @browse-library=${(event: CustomEvent<LibraryCriterion>) => this.switchPage("library", { libraryCriterion: event.detail })}
                @access-denied=${() => this.fail(new ApiError("unauthorized"))}
              ></kaleidescape-journal-calendar>`
            : html`
                <div class="entries-layout">
                  <section class="entries-list" aria-label="Journal entries">
                    <div class="card-head">
                      <h2>Viewings (${this.info?.viewing_count ?? 0})</h2>
                    </div>
                    ${
                      this.loading
                        ? html`<div class="empty" role="status">
                            Loading viewings…
                          </div>`
                        : this.rows.length
                          ? html`<ul
                              class="entry-list"
                              tabindex="0"
                              aria-label="Viewings"
                            >
                              ${this.rows.map((record) => viewingListRow(record, this.selected?.id, (id) => void this.selectRecord(id), this.saving || !!this.pending))}
                            </ul>`
                          : html`<div class="empty">
                              <strong
                                >${this.query || this.status ? "No matching viewings" : "Your journal is empty"}</strong
                              >
                              <p>
                                ${this.query || this.status ? "Try another title or status." : "Add a manual viewing or enable automatic tracking in the integration settings."}
                              </p>
                            </div>`
                    }
                  </section>
                  <section
                    class="entries-detail"
                    aria-label="Viewing details"
                    tabindex="0"
                  >
                    <div class="card-head">
                      <h2>Viewing details</h2>
                      ${this.selected ? html`<button ?disabled=${blocked} @click=${this.editRecord}>Edit viewing</button><button class="danger" ?disabled=${blocked} @click=${this.openDelete}>Delete entry</button>` : nothing}
                    </div>
                    ${
                      this.detailLoading
                        ? html`<div class="empty" role="status">
                            Loading entry…
                          </div>`
                        : this.selected
                          ? html`${viewingDetails(this.selected, (value) => this.date(value))}
                              <kaleidescape-viewing-library
                                .client=${this.api}
                                .scope=${this.info}
                                .viewingId=${this.selected.id}
                                .disabled=${blocked}
                                @access-denied=${() => this.fail(new ApiError("unauthorized"))}
                                @open-library-title=${(event: CustomEvent<string>) => this.switchPage("library", { libraryTitleId: event.detail })}
                              ></kaleidescape-viewing-library>
                              ${
                                this.selected.notes
                                  ? html`<h3>Notes</h3>
                                      <p class="journal-notes">
                                        ${this.selected.notes}
                                      </p>`
                                  : nothing
                              }
                              ${this.renderEvidence()}`
                          : html`<div class="empty">
                              <strong>Select an entry</strong>
                              <p>Review its details or add a manual viewing.</p>
                            </div>`
                    }
                  </section>
                </div>
              `
        }
        <footer class="entries-footer journal-status">
          <span>
            ${counted(this.info?.viewing_count ?? 0, "entry", "entries")} ·
            ${this.bytes(this.info?.database_bytes ?? 0)} /
            ${this.bytes(this.info?.database_limit_bytes ?? 0)} database ·
            Recording:
            ${this.info?.tracking_enabled ? "Enabled" : "Manual only"} ·
            ${this.info?.backup_in_progress ? "Backing up" : "Storage ready"} ·
            Schema ${this.info?.schema_version} · Revision
            ${this.info?.revision}
          </span>
          <div class="pagination" ?hidden=${this.journalView === "calendar"}>
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
        </footer>
      </section>
      <dialog
        id="journal-editor"
        class="database-dialog journal-dialog"
        aria-labelledby="journal-editor-title"
        @click=${dismissBackdrop}
        @cancel=${this.cancelEdit}
      >
        <h2 id="journal-editor-title">
          ${this.manual ? "New viewing" : "Edit viewing"}
        </h2>
        ${this.notice ? html`<p class="notice" role="status">${this.notice}</p>` : nothing}
        ${this.error ? html`<p class="error" role="alert">${this.error}</p>` : nothing}
        ${this.lastError === "conflict" && this.selected ? html`<button @click=${this.reloadSelected}>Reload entry</button>` : nothing}
        ${this.draft ? retry : nothing}${this.draft ? this.renderEditor() : nothing}
      </dialog>
      <dialog
        id="journal-delete"
        class="database-dialog"
        aria-labelledby="journal-delete-title"
        @click=${dismissBackdrop}
        @cancel=${this.cancelDelete}
      >
        <h2 id="journal-delete-title">Remove this entry from the journal?</h2>
        <p>${this.selected?.title}</p>
        <p>
          Stored history and backup copies are retained. This does not
          permanently erase the data.
        </p>
        ${this.error ? html`<p class="error" role="alert">${this.error}</p>` : nothing}${this.confirmDelete ? retry : nothing}
        <div class="dialog-footer">
          <button
            ?disabled=${this.saving || !!this.pending}
            @click=${this.cancelDelete}
          >
            Keep entry</button
          ><button
            class="danger"
            ?disabled=${this.saving || !!this.pending || !this.confirmDelete}
            @click=${this.deleteRecord}
          >
            Confirm deletion
          </button>
        </div>
      </dialog>`;
  }
  protected render() {
    if (
      (this.hass?.user && !this.hass.user.is_admin) ||
      (this.info && !this.info.permissions.edit)
    ) {
      return html`<kaleidescape-reader
        .hass=${this.hass}
        .client=${this.hass ? undefined : this.client}
        .narrow=${this.narrow}
      ></kaleidescape-reader>`;
    }
    const blocked =
      this.loading ||
      this.saving ||
      !!this.pending ||
      this.maintenanceBusy ||
      this.settingsBusy;
    return html`<main>
      <header>
        ${this.hass && this.narrow ? html`<button class="menu" aria-label="Open sidebar" @click=${() => this.dispatchEvent(new CustomEvent("hass-toggle-menu", { bubbles: true, composed: true }))}>☰</button>` : nothing}
        <div class="grow">
          <span class="eyebrow">Kaleidescape Companion · Administrator</span>
          <h1>Kaleidescape Companion</h1>
          <p>
            ${PAGES.find((page) => page.id === this.activePage)!.description}
          </p>
        </div>
      </header>
      ${
        this.info?.permissions.edit
          ? html`<div
              class="page-tabs"
              role="tablist"
              aria-label="Companion pages"
              @keydown=${(event: KeyboardEvent) => this.pageKey(event)}
            >
              ${PAGES.map((page) => html`<button id=${`page-${page.id}`} role="tab" aria-selected=${this.activePage === page.id} aria-controls="companion-page" tabindex=${this.activePage === page.id ? "0" : "-1"} ?disabled=${blocked || (page.id === "library" && !this.info?.library_enabled)} title=${page.id === "library" && !this.info?.library_enabled ? "Enable library sync in Settings" : nothing} @click=${() => this.switchPage(page.id)}>${page.label}</button>`)}
            </div>`
          : nothing
      }
      ${this.error ? html`<div class="error" role="alert">${this.error}${this.lastError === "conflict" && this.selected ? html` <button ?disabled=${blocked} @click=${this.reloadSelected}>Reload entry</button>` : nothing}</div>` : nothing}
      ${this.notice ? html`<div class="notice" role="status">${this.notice}</div>` : nothing}
      ${
        !this.api
          ? html`<div class="empty">
              <strong>Connect through Home Assistant</strong>
              <p>
                Open Kaleidescape Companion in HA with an administrator account,
                or connect the local development preview.
              </p>
            </div>`
          : !this.info
            ? html`<div class="empty" role="status">
                <strong
                  >${this.loading ? "Connecting to the journal…" : "Journal unavailable"}</strong
                >${!this.loading ? html`<button @click=${() => this.refresh()}>Reload connection</button>` : nothing}
              </div>`
            : html`<section
                id="companion-page"
                role="tabpanel"
                aria-labelledby=${`page-${this.activePage}`}
              >
                ${
                  this.activePage === "library"
                    ? html`<kaleidescape-library
                        .client=${this.api}
                        .scope=${this.info}
                        .openTitleId=${this.libraryTitleId}
                        .openCriterion=${this.libraryCriterion}
                        @open-title-journal=${(event: CustomEvent<{ id: string; title: string }>) => this.switchPage("journal", { movie: event.detail })}
                        @access-denied=${() => this.fail(new ApiError("unauthorized"))}
                        @library-disabled=${() => {
                          this.activePage = "journal";
                          void this.refresh();
                        }}
                      ></kaleidescape-library>`
                    : this.activePage === "database"
                      ? html`<kaleidescape-database
                          .client=${this.api}
                          .scope=${this.info}
                          @access-denied=${() => this.fail(new ApiError("unauthorized"))}
                          @maintenance-busy=${(event: CustomEvent<boolean>) => {
                            if (this.maintenanceBusy === event.detail) return;
                            this.maintenanceBusy = event.detail;
                            this.requestUpdate();
                          }}
                          @database-changed=${() => this.refreshInfo()}
                        ></kaleidescape-database>`
                      : this.activePage === "settings"
                        ? html`<kaleidescape-settings
                            .client=${this.api}
                            .scope=${this.info}
                            @access-denied=${() => this.fail(new ApiError("unauthorized"))}
                            @settings-busy=${(event: CustomEvent<boolean>) => {
                              if (this.settingsBusy === event.detail) return;
                              this.settingsBusy = event.detail;
                              this.requestUpdate();
                            }}
                            @settings-saved=${() => {
                              this.activePage = "settings";
                              rememberPage("settings");
                              this.notice =
                                "Settings saved. Reloading the integration…";
                              const api = this.api;
                              void this.refresh(true).then(() => {
                                if (this.api === api && this.info) {
                                  this.notice = "Settings saved.";
                                  this.requestUpdate();
                                }
                              });
                            }}
                          ></kaleidescape-settings>`
                        : this.activePage === "now-playing"
                          ? html`<kaleidescape-now-playing
                              .client=${this.api}
                              .scope=${this.info}
                            ></kaleidescape-now-playing>`
                          : this.renderJournal()
                }
              </section>`
      }
    </main>`;
  }
}
if (!customElements.get("kaleidescape-panel")) {
  customElements.define("kaleidescape-panel", KaleidescapePanel);
}
