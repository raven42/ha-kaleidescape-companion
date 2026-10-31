/** One explicit device addition; uncertain results are checked, never reposted. */
import { LitElement, css, html, nothing } from "lit";
import type { PropertyValues } from "lit";
import { errorCode, errorMessage } from "../core/api";
import type {
  JournalClient,
  JournalInfo,
  LibraryTitle,
  PreparedMutation,
  CollectionAddResult,
} from "../core/api";
import { styles } from "../ui/styles";
import { closeButton, dismissBackdrop } from "../ui/dialog";

export class LibraryCollectionAdd extends LitElement {
  static properties = {
    client: { attribute: false },
    scope: { attribute: false },
    version: { attribute: false },
    revision: { type: Number },
    enabled: { type: Boolean },
    blocked: { type: Boolean },
  };
  static styles = [
    styles,
    css`
      .collection-button {
        border-radius: 999px;
        padding: 10px 20px;
        min-height: 44px;
        line-height: 20px;
      }
    `,
  ];
  client?: JournalClient;
  scope?: JournalInfo;
  version?: LibraryTitle;
  revision = 0;
  enabled = false;
  blocked = false;
  private generation = 0;
  private choices: string[] = [];
  private selected = "";
  private loading = false;
  private busy = false;
  private pending?: PreparedMutation;
  private error = "";
  private notice = "";
  protected willUpdate(changed: PropertyValues) {
    if (
      changed.has("client") ||
      changed.has("scope") ||
      changed.has("version") ||
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
    this.choices = [];
    this.selected = "";
    this.loading = this.busy = false;
    this.pending = undefined;
    this.error = this.notice = "";
    this.renderRoot.querySelector<HTMLDialogElement>("dialog")?.close();
  }
  confirmNavigation() {
    return !this.busy && !this.pending;
  }
  private close(event?: Event) {
    event?.preventDefault();
    if (!this.confirmNavigation()) return;
    this.generation++;
    this.loading = false;
    this.renderRoot.querySelector<HTMLDialogElement>("dialog")?.close();
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
    this.loading = true;
    this.error = this.notice = this.selected = "";
    this.choices = [];
    this.requestUpdate();
    await this.updateComplete;
    if (generation !== this.generation || !this.isConnected) return;
    this.renderRoot.querySelector<HTMLDialogElement>("dialog")?.showModal();
    try {
      const targets = await this.client.collectionTargets(
        this.scope,
        this.version.id,
        this.revision,
      );
      if (generation === this.generation) this.choices = targets.collections;
    } catch (error) {
      if (generation === this.generation) this.fail(error);
    } finally {
      if (generation === this.generation) {
        this.loading = false;
        this.requestUpdate();
      }
    }
  }
  private changed(result: CollectionAddResult) {
    this.dispatchEvent(
      new CustomEvent("collection-changed", {
        detail: result,
        bubbles: true,
        composed: true,
      }),
    );
  }
  private complete(result: CollectionAddResult) {
    this.pending = undefined;
    this.busy = false;
    this.notice =
      result.status === "confirmed"
        ? "Collection membership confirmed on the device."
        : result.status === "abandoned"
          ? "The request was acknowledged without sending another add."
          : "The add is not confirmed. Close this window and check the pending request on the Library page.";
    this.close();
    this.changed(result);
  }
  private async submit() {
    if (
      !this.client ||
      !this.scope ||
      !this.version ||
      !this.selected ||
      this.busy ||
      this.pending
    )
      return;
    try {
      this.pending = this.client.prepareCollectionAdd(
        this.scope,
        this.version.id,
        this.selected,
        this.revision,
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
      const result = await this.client.collectionAdd(this.pending);
      if (generation === this.generation) this.complete(result);
    } catch (error) {
      if (generation === this.generation) this.fail(error);
    } finally {
      if (generation === this.generation) {
        this.busy = false;
        this.requestUpdate();
      }
    }
  }
  private async check() {
    if (!this.client || !this.scope || !this.pending || this.busy) return;
    const generation = this.generation;
    this.busy = true;
    this.error = "";
    this.requestUpdate();
    try {
      const result = await this.client.collectionCheck(
        this.scope,
        String(this.pending.message.request_id),
      );
      if (generation === this.generation) this.complete(result);
    } catch (error) {
      if (generation === this.generation) {
        if (errorCode(error) === "not_found") {
          this.pending = undefined;
          this.error =
            "No accepted add request was found. Refresh title details before starting another add.";
        } else this.fail(error);
      }
    } finally {
      if (generation === this.generation) {
        this.busy = false;
        this.requestUpdate();
      }
    }
  }
  protected render() {
    if (!this.scope?.permissions.edit || !this.version || !this.enabled)
      return nothing;
    return html`<button
        class="collection-button"
        ?disabled=${this.blocked || this.busy}
        @click=${this.open}
      >
        Collection
      </button>
      ${this.notice ? html`<p role="status">${this.notice}</p>` : nothing}
      <dialog
        class="database-dialog"
        @click=${dismissBackdrop}
        @cancel=${this.close}
        aria-labelledby="collection-add-title"
      >
        <div class="card-head">
          <h2 id="collection-add-title">Add to Collection</h2>
          ${closeButton((event) => this.close(event), this.busy || !!this.pending)}
        </div>
        <p>
          <strong>${this.version.title}</strong> ·
          ${this.version.year ?? "Year unknown"} ·
          ${this.version.formats?.join(", ") || this.version.edition || "Format unknown"}
        </p>
        <p>
          This sends one version to one existing collection on your
          Kaleidescape. Other memberships are preserved. Removal is not
          supported.
        </p>
        ${this.loading ? html`<p role="status">Reading available collections from the device…</p>` : nothing}
        ${this.error ? html`<p role="alert" class="error">${this.error}</p>` : nothing}
        ${
          this.pending
            ? html`<p class="warning">
                  ${this.busy ? "Waiting for the device and read-back verification…" : "The result is unconfirmed. Check its status without sending another add."}
                </p>
                <button ?disabled=${this.busy} @click=${this.check}>
                  Check add result
                </button>`
            : html`<label
                  >Collection<select
                    name="add_collection"
                    ?disabled=${this.loading}
                    .value=${this.selected}
                    @change=${(event: Event) => {
                      this.selected = (event.target as HTMLSelectElement).value;
                      this.requestUpdate();
                    }}
                  >
                    <option value="">Choose a collection</option>
                    ${this.choices.map((name) => html`<option value=${name}>${name}</option>`)}
                  </select></label
                >
                ${!this.loading && !this.choices.length && !this.error ? html`<p>No offered, visible collection targets are available. Sync or check the server’s collections.</p>` : nothing} `
        }
        ${!this.pending ? html`<div class="dialog-footer"><button class="primary" ?disabled=${this.loading || !this.selected} @click=${this.submit}>Add selected version</button></div>` : nothing}
      </dialog>`;
  }
}
if (!customElements.get("kaleidescape-library-collection-add"))
  customElements.define(
    "kaleidescape-library-collection-add",
    LibraryCollectionAdd,
  );
