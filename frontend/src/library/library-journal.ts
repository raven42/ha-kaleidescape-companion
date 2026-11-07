/** Grouped viewing history shown within a Library title. */
import { LitElement, css, html, nothing } from "lit";
import type { JournalClient, JournalInfo, ViewingSummary } from "../core/api";
import { errorCode, errorMessage } from "../core/api";
import type { JournalCalendar } from "../ui/journal-calendar";
import { styles } from "../ui/styles";

function viewingLabel(row: ViewingSummary) {
  const date = new Date(row.started_at);
  return `${row.status === "completed" ? "Completed" : "Partial"}: ${date.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "2-digit" })} ${date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
}

export class LibraryJournal extends LitElement {
  static properties = {
    client: { attribute: false },
    scope: { attribute: false },
    titleId: { type: String },
    editable: { type: Boolean },
    unified: { type: Boolean },
  };
  static styles = [
    styles,
    css`
      :host {
        display: flow-root;
        font-size: 11px;
      }
      :host([hidden]) {
        display: none;
      }
      details {
        margin-top: 12px;
      }
      .viewing button {
        font-size: inherit;
      }
      summary {
        cursor: pointer;
        font-weight: 600;
      }
      .summary-edit {
        display: none;
        margin-left: 0.5rem;
        font-size: inherit;
        min-height: 0;
        padding: 0;
        line-height: inherit;
      }
      details[open] .summary-edit {
        display: inline;
      }
      ul {
        padding: 0;
        list-style: none;
      }
      li {
        padding: 0.5rem 0;
        border-bottom: 1px solid var(--line);
      }
      .viewing {
        display: flex;
        align-items: baseline;
        gap: 0.5rem;
        flex-wrap: wrap;
      }
    `,
  ];
  client?: JournalClient;
  scope?: JournalInfo;
  titleId = "";
  editable = false;
  unified = false;
  private bound = "";
  private boundClient?: JournalClient;
  private generation = 0;
  private items: ViewingSummary[] = [];
  private cursor: string | null = null;
  private loading = false;
  private error = "";
  private dialogReady = false;
  private detailRequest = 0;
  private editChooser = false;

  protected updated() {
    this.toggleAttribute("hidden", !this.items.length && !this.error);
  }

  private edit(row: ViewingSummary) {
    this.editChooser = false;
    this.dispatchEvent(
      new CustomEvent("edit-journal", {
        detail: row.id,
        bubbles: true,
        composed: true,
      }),
    );
  }
  private async chooseEdit(event: Event) {
    event.preventDefault();
    event.stopPropagation();
    if (this.items.length === 1 && !this.cursor)
      return this.edit(this.items[0]);
    this.editChooser = true;
    this.requestUpdate();
    await this.updateComplete;
    this.renderRoot
      .querySelector<HTMLDialogElement>(".journal-edit-chooser")
      ?.showModal();
  }

  private scopeKey() {
    return `${this.scope?.entry_id}:${this.scope?.dataset_id}:${this.scope?.library_enabled}:${this.scope?.permissions.edit}:${this.scope?.revision}:${this.titleId}`;
  }
  protected willUpdate() {
    if (!this.isConnected) return;
    const key = this.scopeKey();
    if (key === this.bound && this.client === this.boundClient) return;
    this.clear();
    this.bound = key;
    this.boundClient = this.client;
    if (this.client && this.scope?.library_enabled && this.titleId)
      void this.load(false);
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    this.clear();
    this.bound = "";
    this.boundClient = undefined;
  }
  private clear() {
    this.generation++;
    this.detailRequest++;
    this.items = [];
    this.cursor = null;
    this.loading = false;
    this.error = "";
    this.dialogReady = false;
    this.editChooser = false;
  }
  private async load(more: boolean) {
    if (!this.client || !this.scope || this.loading) return;
    const client = this.client,
      scope = this.scope,
      titleId = this.titleId;
    const generation = this.generation;
    const current = () =>
      this.isConnected &&
      generation === this.generation &&
      this.client === client &&
      this.bound === this.scopeKey() &&
      this.titleId === titleId;
    this.loading = true;
    this.error = "";
    this.requestUpdate();
    try {
      let cursor = more ? this.cursor : null;
      const seen = new Set<string>();
      do {
        if (cursor) {
          if (seen.has(cursor))
            throw new Error("Unable to continue viewing history.");
          seen.add(cursor);
        }
        const page = await client.list(
          scope,
          "",
          "",
          cursor ?? undefined,
          "completed_at",
          true,
          false,
          titleId,
        );
        if (!current()) return;
        this.items = cursor ? [...this.items, ...page.items] : page.items;
        this.cursor = page.next_cursor;
        cursor = this.cursor;
        this.requestUpdate();
      } while (
        cursor &&
        this.renderRoot.querySelector<HTMLDetailsElement>("details")?.open
      );
    } catch (error) {
      if (!current()) return;
      if (
        errorCode(error) === "unauthorized" ||
        errorCode(error) === "library_disabled"
      ) {
        this.clear();
        this.dispatchEvent(
          new CustomEvent("access-denied", { bubbles: true, composed: true }),
        );
      } else if (errorCode(error) === "refresh_required") {
        this.items = [];
        this.cursor = null;
        this.error =
          "Viewing history changed. Refresh to see the latest entries.";
      } else this.error = errorMessage(error);
    } finally {
      if (current()) {
        this.loading = false;
        this.requestUpdate();
      }
    }
  }
  private async openViewing(row: ViewingSummary) {
    const generation = this.generation,
      request = ++this.detailRequest;
    await import("../ui/journal-calendar");
    if (
      generation !== this.generation ||
      request !== this.detailRequest ||
      !this.isConnected
    )
      return;
    this.dialogReady = true;
    this.requestUpdate();
    await this.updateComplete;
    if (
      generation !== this.generation ||
      request !== this.detailRequest ||
      !this.isConnected
    )
      return;
    const dialog = this.renderRoot.querySelector<JournalCalendar>(
      "kaleidescape-journal-calendar",
    );
    if (dialog) {
      await dialog.updateComplete;
      if (generation === this.generation && request === this.detailRequest)
        void dialog.openViewing(row);
    }
  }
  protected render() {
    if (!this.items.length && !this.error) return nothing;
    return html`
      ${
        this.items.length
          ? html`<details
              @toggle=${(event: Event) => {
                if (
                  (event.currentTarget as HTMLDetailsElement).open &&
                  this.cursor &&
                  !this.loading
                )
                  void this.load(true);
              }}
            >
              <summary>
                Journal
                ${this.editable && this.scope?.permissions.edit ? html`<button type="button" class="link summary-edit" @click=${this.chooseEdit}>edit</button>` : nothing}
              </summary>
              <ul>
                ${this.items.map(
                  (row) =>
                    html`<li>
                      <div class="viewing">
                        <time datetime=${row.started_at}
                          >${viewingLabel(row)}</time
                        >
                        ${
                          !this.unified
                            ? html`<button
                                type="button"
                                class="link"
                                @click=${() => void this.openViewing(row)}
                              >
                                Click to view
                              </button>`
                            : nothing
                        }
                      </div>
                    </li>`,
                )}
              </ul>
              ${this.loading ? html`<p role="status">Loading viewings…</p>` : nothing}
            </details>`
          : nothing
      }
      ${this.error ? html`<p class="error" role="alert">${this.error} <button @click=${() => void this.load(!!this.cursor)}>Retry viewing history</button></p>` : nothing}
      ${
        this.editChooser
          ? html`<dialog
              class="journal-edit-chooser"
              aria-label="Edit journal entry"
              @cancel=${() => {
                this.editChooser = false;
                this.requestUpdate();
              }}
            >
              <h2>Edit journal entry</h2>
              <p>Choose a viewing to edit.</p>
              <ul>
                ${this.items.map((row) => html`<li><button type="button" class="link" @click=${() => this.edit(row)}>${viewingLabel(row)}</button></li>`)}
              </ul>
              <button
                type="button"
                @click=${() => {
                  this.editChooser = false;
                  this.requestUpdate();
                }}
              >
                Cancel
              </button>
            </dialog>`
          : nothing
      }
      ${this.dialogReady ? html`<kaleidescape-journal-calendar .client=${this.client} .scope=${this.scope} .detailsOnly=${true}></kaleidescape-journal-calendar>` : nothing}
    `;
  }
}
if (!customElements.get("kaleidescape-library-journal"))
  customElements.define("kaleidescape-library-journal", LibraryJournal);
