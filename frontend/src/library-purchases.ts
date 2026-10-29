/** Offline invoice preview; only explicit version/date corrections are persisted. */
import { LitElement, html, nothing } from "lit";
import type { PropertyValues } from "lit";
import { errorCode, errorMessage } from "./api";
import type {
  JournalClient,
  JournalInfo,
  PreparedMutation,
  PurchasePreview,
} from "./api";
import { styles } from "./styles";
import { dismissBackdrop } from "./dialog";

export class LibraryPurchases extends LitElement {
  static properties = {
    client: { attribute: false },
    scope: { attribute: false },
  };
  static styles = styles;
  client?: JournalClient;
  scope?: JournalInfo;
  private generation = 0;
  private preview?: PurchasePreview;
  private selected = new Map<string, string>();
  private pending?: PreparedMutation;
  private controller?: AbortController;
  private busy = false;
  private error = "";
  private notice = "";
  protected willUpdate(changed: PropertyValues) {
    if (changed.has("client") || changed.has("scope")) this.clear();
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    this.clear();
  }
  private clear() {
    this.generation++;
    this.controller?.abort();
    this.controller = undefined;
    this.preview = this.pending = undefined;
    this.selected.clear();
    this.busy = false;
    this.error = this.notice = "";
    this.renderRoot.querySelector<HTMLDialogElement>("dialog")?.close();
  }
  confirmNavigation() {
    return (
      !this.busy &&
      (!this.pending ||
        window.confirm(
          "Discard this unconfirmed purchase-date retry? Inspect saved dates before making another correction.",
        ))
    );
  }
  private close(event?: Event) {
    event?.preventDefault();
    if (this.pending) return;
    this.generation++;
    this.busy = false;
    this.controller?.abort();
    this.preview = undefined;
    this.selected.clear();
    const input =
      this.renderRoot.querySelector<HTMLInputElement>('input[type="file"]');
    if (input) input.value = "";
    this.renderRoot.querySelector<HTMLDialogElement>("dialog")?.close();
    this.requestUpdate();
  }
  private fail(error: unknown) {
    this.error = errorMessage(error);
    if (errorCode(error) === "unauthorized") {
      this.clear();
      this.dispatchEvent(
        new CustomEvent("access-denied", { bubbles: true, composed: true }),
      );
    }
  }
  private async open() {
    this.error = this.notice = "";
    this.requestUpdate();
    await this.updateComplete;
    this.renderRoot.querySelector<HTMLDialogElement>("dialog")?.showModal();
  }
  private async upload(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    if (!file || !this.client || !this.scope || this.busy || this.pending)
      return;
    const generation = ++this.generation;
    this.busy = true;
    this.preview = undefined;
    this.selected.clear();
    this.error = "";
    this.controller = new AbortController();
    const timeout = setTimeout(() => this.controller?.abort(), 35000);
    this.requestUpdate();
    try {
      const preview = await this.client.purchasePreview(
        this.scope,
        file,
        this.controller.signal,
      );
      if (generation === this.generation) this.preview = preview;
    } catch (error) {
      if (generation === this.generation) this.fail(error);
    } finally {
      clearTimeout(timeout);
      if (generation === this.generation) {
        this.busy = false;
        this.requestUpdate();
      }
    }
  }
  private async save() {
    if (!this.client || !this.scope || !this.preview || this.busy) return;
    if (!this.pending) {
      try {
        this.pending = this.client.preparePurchaseDates(
          this.scope,
          this.preview.revision,
          [...this.selected].map(([title_id, purchased_on]) => ({
            title_id,
            purchased_on,
          })),
        );
      } catch (error) {
        this.fail(error);
        this.requestUpdate();
        return;
      }
    }
    const generation = this.generation;
    this.busy = true;
    this.error = "";
    this.requestUpdate();
    try {
      const result = await this.client.purchaseDates(this.pending);
      if (generation !== this.generation) return;
      this.pending = undefined;
      this.busy = false;
      this.notice = `Updated purchase dates for ${result.updated_count} versions.`;
      this.close();
      this.dispatchEvent(
        new CustomEvent("purchase-dates-changed", {
          bubbles: true,
          composed: true,
        }),
      );
    } catch (error) {
      if (generation !== this.generation) return;
      if (
        [
          "conflict",
          "invalid_request",
          "not_found",
          "library_disabled",
          "backup_in_progress",
          "busy",
          "library_storage_limit",
        ].includes(errorCode(error))
      )
        this.pending = undefined;
      this.fail(error);
    } finally {
      if (generation === this.generation) {
        this.busy = false;
        this.requestUpdate();
      }
    }
  }
  protected render() {
    if (!this.scope?.permissions.edit) return nothing;
    const locked = this.busy || !!this.pending;
    return html`<button @click=${this.open}>Import purchase dates</button>
      ${this.notice ? html`<p role="status">${this.notice}</p>` : nothing}
      <dialog
        class="database-dialog library-dialog"
        @click=${dismissBackdrop}
        @cancel=${this.close}
        aria-labelledby="purchase-title"
      >
        <div class="card-head">
          <h2 id="purchase-title">Import purchase dates</h2>
          <button ?disabled=${!!this.pending} @click=${this.close}>
            Close
          </button>
        </div>
        <p>
          Select a saved Kaleidescape purchase-history HTML file (UTF-8, up to 8
          MiB). No page scripts or links are used. Rentals, pending invoices,
          and cancelled rows are skipped; repeated purchases use the earliest
          date.
        </p>
        <p>
          Exact title names suggest matches, not proof of edition identity.
          Review each version and date before applying. First-detected dates and
          viewing history are preserved.
        </p>
        <label
          >Purchase history HTML<input
            type="file"
            accept=".html,.htm,text/html"
            ?disabled=${locked}
            @change=${this.upload}
        /></label>
        ${this.busy ? html`<p role="status">Working…</p>` : nothing}
        ${this.error ? html`<p role="alert" class="error">${this.error}</p>` : nothing}
        ${
          this.pending
            ? html`<p class="warning">
                  The result is unconfirmed. Retry the same correction to
                  confirm it.
                </p>
                <button
                  ?disabled=${this.busy}
                  @click=${() => {
                    if (
                      window.confirm(
                        "Discard the retry? Inspect saved dates before making another correction.",
                      )
                    ) {
                      this.pending = undefined;
                      this.close();
                    }
                  }}
                >
                  Discard retry
                </button>`
            : nothing
        }
        ${
          this.preview
            ? html`<p>
                  ${this.preview.rows.length} purchase names ·
                  ${this.preview.rows.filter((row) => !row.versions.length).length}
                  unmatched ·
                  ${this.preview.rows.filter((row) => row.ambiguous).length}
                  ambiguous · ${this.selected.size} versions selected (maximum
                  1000)
                </p>
                <button
                  ?disabled=${locked}
                  @click=${() => {
                    this.selected.clear();
                    for (const row of this.preview!.rows)
                      if (!row.ambiguous)
                        for (const version of row.versions)
                          if (this.selected.size < 1000)
                            this.selected.set(version.id, row.purchased_on);
                    this.requestUpdate();
                  }}
                >
                  Select unambiguous matches
                </button>
                <div class="purchase-preview">
                  ${this.preview.rows.map(
                    (row) =>
                      html`<section>
                        <strong>${row.title}</strong> ·
                        ${row.purchased_on}${row.ambiguous ? html`<span class="warning"> · Ambiguous: choose exact versions</span>` : nothing}
                        ${!row.versions.length ? html`<p class="muted">No exact cached title match; skipped.</p>` : nothing}
                        ${row.versions.map(
                          (version) =>
                            html`<label class="check"
                              ><input
                                type="checkbox"
                                .checked=${this.selected.has(version.id)}
                                ?disabled=${locked || (this.selected.size >= 1000 && !this.selected.has(version.id))}
                                @change=${(event: Event) => {
                                  if (
                                    (event.target as HTMLInputElement).checked
                                  )
                                    this.selected.set(
                                      version.id,
                                      row.purchased_on,
                                    );
                                  else this.selected.delete(version.id);
                                  this.requestUpdate();
                                }}
                              />${version.year ?? "Year unknown"} ·
                              ${version.edition || "Format unknown"} · currently
                              ${version.purchased_on ?? "unknown"} ·
                              ${version.id.slice(0, 8)}</label
                            >`,
                        )}
                        ${row.versions_truncated ? html`<p class="warning">Only the first 50 matching versions are shown.</p>` : nothing}
                      </section>`,
                  )}
                </div>
                <div class="actions dialog-footer">
                  <button
                    class="primary"
                    ?disabled=${this.busy || (!this.pending && !this.selected.size)}
                    @click=${this.save}
                  >
                    ${this.pending ? "Retry same correction" : `Apply ${this.selected.size} purchase dates`}
                  </button>
                </div>`
            : nothing
        }
      </dialog>`;
  }
}
if (!customElements.get("kaleidescape-library-purchases"))
  customElements.define("kaleidescape-library-purchases", LibraryPurchases);
