/** Reviewed local repair; no calendar or device writes. */
import { LitElement, html, nothing } from "lit";
import type { PropertyValues } from "lit";
import { errorCode, errorMessage } from "../core/api";
import type {
  JournalClient,
  Scope,
  MetadataReview,
  MetadataRepairResult,
  PreparedMutation,
} from "../core/api";
import { counted } from "../core/text";
import { dismissBackdrop } from "./dialog";
import { styles } from "./styles";

export class MetadataRepair extends LitElement {
  static properties = {
    client: { attribute: false },
    scope: { attribute: false },
    disabled: { type: Boolean },
  };
  static styles = styles;
  client?: JournalClient;
  scope?: Scope;
  disabled = false;
  private review?: MetadataReview;
  private result?: MetadataRepairResult;
  private pending?: PreparedMutation;
  private working = false;
  private error = "";
  private generation = 0;
  private bound = "";
  private boundClient?: JournalClient;

  protected willUpdate(changed: PropertyValues) {
    if (!changed.has("scope") && !changed.has("client")) return;
    const key = `${this.scope?.entry_id}:${this.scope?.dataset_id}`;
    if (key === this.bound && this.boundClient === this.client) return;
    this.clear();
    this.bound = key;
    this.boundClient = this.client;
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    this.clear();
  }
  private clear() {
    this.generation++;
    this.review = this.result = this.pending = undefined;
    this.working = false;
    this.error = "";
    this.renderRoot.querySelector("dialog")?.close();
  }
  confirmNavigation() {
    return !this.working && !this.pending;
  }
  private close(event?: Event) {
    event?.preventDefault();
    if (this.confirmNavigation())
      this.renderRoot.querySelector("dialog")?.close();
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
  private async open() {
    if (!this.client || !this.scope || this.disabled || this.working) return;
    if (this.pending) {
      this.renderRoot.querySelector("dialog")?.showModal();
      return;
    }
    const generation = this.generation;
    this.working = true;
    this.error = "";
    this.requestUpdate();
    try {
      const review = await this.client.metadataPreview(this.scope);
      if (generation !== this.generation) return;
      this.review = review;
      this.requestUpdate();
      await this.updateComplete;
      if (generation === this.generation)
        this.renderRoot.querySelector("dialog")?.showModal();
    } catch (error) {
      if (generation === this.generation) this.fail(error);
    } finally {
      if (generation === this.generation) {
        this.working = false;
        this.requestUpdate();
      }
    }
  }
  private async repair() {
    if (
      !this.client ||
      !this.scope ||
      !this.review ||
      this.disabled ||
      this.working
    )
      return;
    const generation = this.generation;
    this.working = true;
    this.error = "";
    this.requestUpdate();
    try {
      this.pending ??= this.client.prepareMetadataRepair(
        this.scope,
        this.review.token,
      );
      const result = await this.client.repairMetadata(this.pending);
      if (generation !== this.generation) return;
      this.result = result;
      this.pending = undefined;
      this.renderRoot.querySelector("dialog")?.close();
    } catch (error) {
      if (generation !== this.generation) return;
      if (
        [
          "conflict",
          "invalid_request",
          "busy",
          "not_ready",
          "backup_in_progress",
          "library_disabled",
          "repair_limit",
        ].includes(errorCode(error))
      ) {
        this.pending = undefined;
        this.review = undefined;
      }
      this.fail(error);
    } finally {
      if (generation === this.generation) {
        this.working = false;
        this.requestUpdate();
      }
    }
  }
  protected render() {
    const review = this.review;
    return html`<section aria-label="Journal metadata repair">
      <h4>Journal Library metadata</h4>
      <p class="muted">
        Fill missing movie details in existing Journal entries from the saved
        Library cache. Existing values, viewing times and calendar events stay
        unchanged.
      </p>
      <button
        type="button"
        ?disabled=${this.disabled || this.working}
        @click=${this.open}
      >
        ${this.working ? "Checking…" : "Repair Journal Library metadata"}
      </button>
      ${this.result ? html`<p role="status">Updated ${counted(this.result.updated_count, "entry", "entries")} · ${this.result.unmatched_count} unmatched · ${this.result.active_count} active and skipped.</p>` : nothing}
      ${this.error ? html`<p role="alert" class="error">${this.error}</p>` : nothing}
      <dialog
        class="database-dialog"
        aria-labelledby="metadata-repair-title"
        @click=${dismissBackdrop}
        @cancel=${this.close}
      >
        <h2 id="metadata-repair-title">Repair Journal Library metadata</h2>
        ${review ? html`<p>${counted(review.updated_count, "entry", "entries")} with missing details can be updated. ${review.unchanged_count} already up to date · ${review.unmatched_count} unmatched · ${review.active_count} active and skipped.</p>` : nothing}
        <p>
          Matches use version identifiers in the configured Library, including
          recognized playback handles. Movie names are never guessed. Existing
          metadata is preserved. Entries with open sessions are skipped.
        </p>
        <p>
          Existing calendar events are not edited or recreated. Sync the Library
          first if its details need refreshing.
        </p>
        ${this.error ? html`<p role="alert" class="error">${this.error}</p>` : nothing}
        ${
          this.pending
            ? html`<p role="alert">
                  The result is unconfirmed. Retry the same repair to retrieve
                  its result.
                </p>
                <button
                  type="button"
                  ?disabled=${this.working}
                  @click=${() => {
                    if (
                      window.confirm(
                        "Discard this retry? The repair may already have committed. Review again to check current metadata.",
                      )
                    ) {
                      this.pending = undefined;
                      this.close();
                      this.requestUpdate();
                    }
                  }}
                >
                  Discard retry & review again
                </button>`
            : nothing
        }
        <div class="dialog-footer">
          <button
            type="button"
            ?disabled=${!this.confirmNavigation()}
            @click=${this.close}
          >
            Cancel
          </button>
          <button
            class="primary"
            type="button"
            ?disabled=${this.disabled || this.working || !review?.updated_count}
            @click=${this.repair}
          >
            ${this.working ? "Repairing…" : this.pending ? "Retry same repair" : "Repair missing metadata"}
          </button>
        </div>
      </dialog>
    </section>`;
  }
}
if (!customElements.get("kaleidescape-metadata-repair"))
  customElements.define("kaleidescape-metadata-repair", MetadataRepair);
