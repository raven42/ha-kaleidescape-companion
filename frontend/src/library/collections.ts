/** Enqueue one collection change without waiting for the device. */
import { LitElement, css, html, nothing } from "lit";
import type { PropertyValues } from "lit";
import { errorCode, errorMessage } from "../core/api";
import type {
  JournalClient,
  JournalInfo,
  LibraryTitle,
  PreparedMutation,
  CollectionJob,
} from "../core/api";
import { styles } from "../ui/styles";
import { iconAction, iconActionStyles } from "../ui/action-icons";
import { closeButton, dismissBackdrop } from "../ui/dialog";
import { collectionSymbol } from "./badges";

const key = (value: string) => value.toLowerCase().replace(/[\s_-]+/g, "");
const label = (value: string) =>
  (
    ({
      new: "Unwatched",
      played: "Watched",
      paused: "In Progress",
      watchsoon: "Watch Soon",
    }) as Record<string, string>
  )[key(value)] ?? value;
const active = (job: CollectionJob) =>
  ["queued", "working", "syncing"].includes(job.status);

export class LibraryCollectionAdd extends LitElement {
  static properties = {
    client: { attribute: false },
    scope: { attribute: false },
    version: { attribute: false },
    revision: { type: Number },
    enabled: { type: Boolean },
    blocked: { type: Boolean },
    choices: { attribute: false },
    jobs: { attribute: false },
  };
  static styles = [
    styles,
    iconActionStyles,
    css`
      .collection-button {
        border-radius: 999px;
        padding: 9px;
        min-height: 44px;
        line-height: 20px;
      }
      .collection-context {
        color: var(--muted);
        font-size: 13px;
      }
      .collection-list {
        display: grid;
        gap: 10px;
        margin: 18px 0;
      }
      .collection-row {
        display: flex;
        align-items: center;
        gap: 14px;
        padding: 14px;
        border: 1px solid var(--line);
        border-radius: 12px;
        background: var(--primary-background-color, #f5f7f6);
      }
      .collection-icon {
        display: grid;
        place-items: center;
        width: 42px;
        height: 42px;
        flex: 0 0 42px;
        border-radius: 12px;
        background: var(--surface);
        color: var(--accent);
      }
      .collection-icon svg {
        width: 21px;
        height: 21px;
      }
      .collection-copy {
        flex: 1;
        min-width: 0;
      }
      .collection-copy strong,
      .collection-copy small {
        display: block;
      }
      .collection-copy strong {
        font-size: 14px;
      }
      .collection-copy small {
        margin-top: 3px;
      }
      .collection-row button {
        border-radius: 999px;
        white-space: nowrap;
        font-size: 12px;
      }
      .collection-row.member {
        border-color: var(--accent);
      }
      .collection-row.pending {
        opacity: 0.65;
      }
      .collection-kicker {
        font-size: 11px;
        text-transform: uppercase;
        font-weight: 700;
        letter-spacing: 0.09em;
        color: var(--accent);
      }
      @media (max-width: 480px) {
        .collection-row {
          flex-wrap: wrap;
        }
        .collection-row button {
          margin-left: 56px;
        }
      }
      @media (max-width: 600px) {
        .collection-button {
          padding-inline: 9px;
          font-size: 13px;
        }
      }
    `,
  ];
  client?: JournalClient;
  scope?: JournalInfo;
  version?: LibraryTitle;
  revision = 0;
  enabled = false;
  blocked = false;
  choices: string[] = [];
  jobs: CollectionJob[] = [];
  private generation = 0;
  private selected = "";
  private busy = false;
  private refreshing = false;
  private refreshed?: { collections: string[]; revision: number };
  private refreshNotice = "";
  private pending?: PreparedMutation;
  private error = "";
  protected willUpdate(changed: PropertyValues) {
    if (
      changed.has("client") ||
      changed.has("scope") ||
      (changed.has("version") &&
        (changed.get("version") as LibraryTitle | undefined)?.id !==
          this.version?.id) ||
      (changed.has("enabled") && !this.enabled)
    )
      this.clear();
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    this.clear();
  }
  protected updated() {
    this.dispatchEvent(
      new CustomEvent("collection-lock", {
        detail: !this.confirmNavigation(),
        bubbles: true,
        composed: true,
      }),
    );
  }
  private clear() {
    this.generation++;
    this.selected = "";
    this.busy = false;
    this.refreshing = false;
    this.refreshed = undefined;
    this.refreshNotice = "";
    this.pending = undefined;
    this.error = "";
    this.renderRoot.querySelector<HTMLDialogElement>("dialog")?.close();
  }
  confirmNavigation() {
    return !this.busy && !this.pending;
  }
  private close(event?: Event) {
    if (this.busy) {
      event?.preventDefault();
      return;
    }
    if (
      this.pending &&
      !window.confirm(
        "This request may already be queued. Close and inspect the collection status before trying again?",
      )
    ) {
      event?.preventDefault();
      return;
    }
    this.clear();
    this.requestUpdate();
  }
  private fail(error: unknown) {
    this.error = errorMessage(error);
    if (["unauthorized", "library_disabled"].includes(errorCode(error))) {
      this.clear();
      this.dispatchEvent(
        new CustomEvent(
          errorCode(error) === "unauthorized"
            ? "access-denied"
            : "library-disabled",
          { bubbles: true, composed: true },
        ),
      );
    }
  }
  private async open() {
    if (
      !this.client ||
      !this.scope ||
      !this.version ||
      !this.enabled ||
      this.blocked
    )
      return;
    const generation = ++this.generation;
    this.selected = "";
    this.error = "";
    this.requestUpdate();
    await this.updateComplete;
    if (
      generation === this.generation &&
      this.isConnected &&
      this.scope?.permissions.edit
    )
      this.renderRoot.querySelector<HTMLDialogElement>("dialog")?.showModal();
  }
  private get member() {
    return this.isMember(this.selected);
  }
  private isMember(selected: string) {
    return !!(this.refreshed?.collections ?? this.version?.collections)?.some(
      (name) => key(name) === key(selected),
    );
  }
  private get selectedKey() {
    return key(this.selected);
  }
  private get queued() {
    return this.isQueued(this.selected);
  }
  private isQueued(selected: string) {
    const selectedKey = key(selected);
    return this.jobs.some(
      (job) =>
        active(job) &&
        job.title_id === this.version?.id &&
        (key(job.collection) === selectedKey ||
          (["new", "played"].includes(key(job.collection)) &&
            ["new", "played"].includes(selectedKey))),
    );
  }
  private get actionLabel() {
    return this.actionFor(this.selected);
  }
  private actionFor(name: string) {
    const selectedKey = key(name),
      member = this.isMember(name);
    if (selectedKey === "new")
      return member ? "Move to Watched" : "Move to Unwatched";
    if (selectedKey === "played")
      return member ? "Move to Unwatched" : "Move to Watched";
    return `${member ? "Remove from" : "Add to"} ${label(name)}`;
  }
  private rowDisabled(name: string) {
    const selectedKey = key(name),
      member = this.isMember(name);
    return (
      this.busy ||
      this.refreshing ||
      !!this.pending ||
      this.isQueued(name) ||
      this.jobs.filter(active).length >= 10 ||
      (selectedKey === "paused" && !member) ||
      (member &&
        !["favorites", "watchsoon", "new", "played", "paused"].includes(
          selectedKey,
        ))
    );
  }
  private rowHint(name: string) {
    const selectedKey = key(name),
      member = this.isMember(name);
    if (this.isQueued(name)) return "Change queued or being verified";
    if (selectedKey === "paused")
      return member
        ? "Can be removed; playback adds it again"
        : "Start playback to add In Progress";
    if (["new", "played"].includes(selectedKey))
      return member
        ? "Currently in this status · moving changes both"
        : "Watched and Unwatched cannot overlap";
    if (member && !["favorites", "watchsoon"].includes(selectedKey))
      return "Custom collection removal is not yet supported";
    return member ? "Currently in this collection" : "Not in this collection";
  }
  private get disabled() {
    return (
      !this.selected ||
      this.busy ||
      this.refreshing ||
      this.queued ||
      this.jobs.filter(active).length >= 10 ||
      (this.selectedKey === "paused" && !this.member) ||
      (this.member &&
        !["favorites", "watchsoon", "new", "played", "paused"].includes(
          this.selectedKey,
        ))
    );
  }
  private async submit() {
    if (!this.client || !this.scope || !this.version || this.disabled) return;
    try {
      this.pending ??= this.client.prepareCollectionChange(
        this.scope,
        this.version.id,
        this.selected,
        this.member ? "remove" : "add",
        this.refreshed?.revision ?? this.revision,
      );
    } catch (error) {
      this.fail(error);
      this.requestUpdate();
      return;
    }
    const generation = this.generation;
    this.busy = true;
    this.error = "";
    this.requestUpdate();
    try {
      const result = await this.client.queueCollectionChange(this.pending);
      if (generation !== this.generation) return;
      this.pending = undefined;
      this.busy = false;
      this.clear();
      this.dispatchEvent(
        new CustomEvent("collection-changed", {
          detail: result,
          bubbles: true,
          composed: true,
        }),
      );
    } catch (error) {
      if (generation === this.generation) {
        if (
          [
            "invalid_request",
            "refresh_required",
            "busy",
            "conflict",
            "collection_uncertain",
            "collection_disabled",
          ].includes(errorCode(error))
        )
          this.pending = undefined;
        this.fail(error);
      }
    } finally {
      if (generation === this.generation) {
        this.busy = false;
        this.requestUpdate();
      }
    }
  }
  private async refresh() {
    if (
      !this.client ||
      !this.scope ||
      !this.version ||
      this.busy ||
      this.refreshing ||
      this.pending
    )
      return;
    const generation = this.generation;
    this.refreshing = true;
    this.error = "";
    this.refreshNotice = "";
    this.requestUpdate();
    try {
      const result = await this.client.refreshTitleCollections(
        this.scope,
        this.version.id,
        this.refreshed?.revision ?? this.revision,
      );
      if (generation !== this.generation) return;
      this.refreshed = result;
      this.refreshNotice = "Collection status refreshed from the server.";
      this.dispatchEvent(
        new CustomEvent("collection-refreshed", {
          detail: { ...result, title_id: this.version.id },
          bubbles: true,
          composed: true,
        }),
      );
    } catch (error) {
      if (generation === this.generation) this.fail(error);
    } finally {
      if (generation === this.generation) {
        this.refreshing = false;
        this.requestUpdate();
      }
    }
  }
  protected render() {
    if (!this.scope?.permissions.edit || !this.version || !this.enabled)
      return nothing;
    return html`${iconAction("Collection", "collection", this.blocked || this.busy, () => this.open(), "collection-button")}
      <dialog
        data-admin-dialog
        class="database-dialog"
        @click=${dismissBackdrop}
        @cancel=${this.close}
        aria-labelledby="collection-add-title"
      >
        <div class="card-head">
          <h2 id="collection-add-title">Manage collections</h2>
          <div class="actions">
            ${iconAction("Refresh collections", "refresh", this.busy || this.refreshing || !!this.pending || this.jobs.some(active), () => this.refresh(), "refresh-collections")}
            ${closeButton((event) => this.close(event), this.busy)}
          </div>
        </div>
        <div class="collection-kicker">Selected version</div>
        <p>
          <strong>${this.version.title}</strong> ·
          ${this.version.year ?? "Year unknown"} ·
          ${this.version.formats?.join(", ") || this.version.edition || "Format unknown"}
        </p>
        <p class="collection-context">
          Choose a collection. Changes run in the background and are checked
          after the Library refreshes.
        </p>
        ${this.error ? html`<p role="alert" class="error">${this.error}</p>` : nothing}
        ${this.refreshing ? html`<p role="status">Refreshing this version’s collection status…</p>` : this.refreshNotice ? html`<p role="status">${this.refreshNotice}</p>` : nothing}
        ${this.pending ? html`<p class="warning">The queue response was not confirmed. Retry the same request to check safely, or close and inspect the Library status.</p>` : nothing}
        <div class="collection-list" aria-label="Available collections">
          ${[...this.choices]
            .sort((a, b) => {
              const order = [
                "favorites",
                "watchsoon",
                "new",
                "played",
                "paused",
              ];
              const rank = (name: string) => {
                const i = order.indexOf(key(name));
                return i < 0 ? order.length : i;
              };
              return rank(a) - rank(b) || label(a).localeCompare(label(b));
            })
            .map(
              (name) =>
                html`<div
                  class=${`collection-row${this.isMember(name) ? " member" : ""}${this.isQueued(name) ? " pending" : ""}`}
                >
                  <span class="collection-icon" aria-hidden="true"
                    >${collectionSymbol(label(name))}</span
                  >
                  <span class="collection-copy"
                    ><strong>${label(name)}</strong
                    ><small>${this.rowHint(name)}</small></span
                  >
                  <button
                    type="button"
                    ?disabled=${this.rowDisabled(name)}
                    @click=${() => {
                      this.selected = name;
                      void this.submit();
                    }}
                  >
                    ${this.isQueued(name) ? "Updating…" : this.actionFor(name)}
                  </button>
                </div>`,
            )}
        </div>
        ${this.jobs.filter(active).length >= 10 ? html`<p class="warning">The queue holds up to 10 changes. Wait for an item to finish.</p>` : nothing}
        ${!this.choices.length ? html`<p>No cached collection names are available. Run a Library sync first.</p>` : nothing}
        ${
          this.pending
            ? html`<div class="dialog-footer">
                <button
                  type="button"
                  class="primary"
                  ?disabled=${this.disabled}
                  @click=${this.submit}
                >
                  ${this.busy ? "Queueing…" : this.pending ? "Retry queue request" : this.selected ? this.actionLabel : "Choose a collection"}
                </button>
              </div>`
            : nothing
        }
      </dialog>`;
  }
}
if (!customElements.get("kaleidescape-library-collection-add"))
  customElements.define(
    "kaleidescape-library-collection-add",
    LibraryCollectionAdd,
  );
