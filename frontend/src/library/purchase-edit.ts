/** One group purchase form with exact-retry and snapshot protection. */
import { LitElement, css, html, nothing } from "lit";
import { errorCode, errorMessage } from "../core/api";
import type {
  GroupPurchaseEdit,
  JournalClient,
  JournalInfo,
  PreparedMutation,
} from "../core/api";
import { closeButton, dismissBackdrop } from "../ui/dialog";
import { styles } from "../ui/styles";
import {
  PURCHASE_FIELDS,
  purchaseProjection,
  purchaseValues,
} from "./purchase-details";
import type { PurchaseField } from "./purchase-details";

const LABELS: Record<string, string> = {
  title: "Receipt title",
  purchased_on: "Purchase date",
  purchase_price: "Purchase price",
  retail_price: "Retail price",
  order_id: "Order ID",
  href: "Store link",
};

export class GroupPurchaseEditor extends LitElement {
  static properties = {
    client: { attribute: false },
    scope: { attribute: false },
    titleId: { type: String },
  };
  static styles = [
    styles,
    css`
      dialog {
        width: min(640px, calc(100% - 24px));
      }
      .purchase-fields {
        display: grid;
        gap: 14px;
        margin-block: 12px;
      }
    `,
  ];
  client?: JournalClient;
  scope?: JournalInfo;
  titleId = "";
  private review?: GroupPurchaseEdit;
  private index = 0;
  private draft: Record<string, string> = {};
  private unavailable = false;
  private pending?: PreparedMutation;
  private busy = false;
  private error = "";
  private stale = false;
  private generation = 0;

  protected firstUpdated() {
    this.renderRoot.querySelector<HTMLDialogElement>("dialog")?.showModal();
    void this.updateComplete.then(() => {
      if (this.isConnected) void this.load();
    });
  }
  disconnectedCallback() {
    this.generation++;
    super.disconnectedCallback();
  }
  private initial(index = this.index): Record<string, string | null> {
    if (!this.review) return {};
    return {
      ...purchaseValues(this.review.records, this.review.manual, index),
      ...(this.review.records[index]
        ? { title: this.review.records[index].title }
        : {}),
    };
  }
  private resetDraft() {
    this.draft = Object.fromEntries(
      Object.entries(this.initial()).map(([key, value]) => [key, value ?? ""]),
    );
  }
  private changes() {
    const original = this.initial();
    return Object.fromEntries(
      Object.entries(this.draft).flatMap(([key, raw]) => {
        const value = raw.trim() || null;
        return value !== (original[key as keyof typeof original] ?? null)
          ? [[key, value]]
          : [];
      }),
    );
  }
  confirmNavigation() {
    if (this.busy || this.pending) return false;
    return (
      !this.review ||
      (this.unavailable === this.review.unavailable &&
        !Object.keys(this.changes()).length) ||
      window.confirm("Discard your unsaved purchase changes?")
    );
  }
  private close(event?: Event) {
    event?.preventDefault();
    if (!this.confirmNavigation()) return;
    this.dispatchEvent(
      new CustomEvent("purchase-cancel", { bubbles: true, composed: true }),
    );
  }
  private notifyBusy() {
    this.dispatchEvent(
      new CustomEvent("purchase-busy", {
        detail: this.busy || !!this.pending,
        bubbles: true,
        composed: true,
      }),
    );
  }
  private report(error: unknown) {
    this.error = errorMessage(error);
    if (errorCode(error) === "unauthorized")
      this.dispatchEvent(
        new CustomEvent("access-denied", { bubbles: true, composed: true }),
      );
  }
  private async load() {
    if (!this.client || !this.scope || !this.scope.permissions.edit) return;
    const generation = ++this.generation;
    this.busy = true;
    this.notifyBusy();
    this.error = "";
    this.requestUpdate();
    try {
      const review = await this.client.groupPurchaseEdit(
        this.scope,
        this.titleId,
      );
      if (generation !== this.generation) return;
      this.review = review;
      this.index = 0;
      this.unavailable = review.unavailable;
      this.stale = false;
      this.resetDraft();
    } catch (error) {
      if (generation === this.generation) this.report(error);
    } finally {
      if (generation === this.generation) {
        this.busy = false;
        this.notifyBusy();
        this.requestUpdate();
      }
    }
  }
  private selectReceipt(event: Event) {
    const select = event.target as HTMLSelectElement;
    const next = Number(select.value);
    if (
      Object.keys(this.changes()).length &&
      !window.confirm("Discard changes to this purchase?")
    ) {
      select.value = String(this.index);
      return;
    }
    this.index = next;
    this.resetDraft();
    this.requestUpdate();
  }
  private async save() {
    if (
      !this.client ||
      !this.scope?.permissions.edit ||
      !this.review ||
      this.busy ||
      this.stale
    )
      return;
    const fields = this.unavailable ? {} : this.changes();
    if (
      !this.pending &&
      !Object.keys(fields).length &&
      this.unavailable === this.review.unavailable
    ) {
      this.close();
      return;
    }
    this.pending ??= this.client.prepareGroupPurchaseEdit(
      this.scope,
      this.titleId,
      this.review.snapshot,
      {
        receipt_id: this.review.records[this.index]?.id ?? null,
        fields,
        unavailable: this.unavailable,
      },
    );
    const generation = this.generation;
    this.busy = true;
    this.error = "";
    this.notifyBusy();
    this.requestUpdate();
    try {
      await this.client.saveGroupPurchaseEdit(this.pending);
      if (generation !== this.generation) return;
      this.pending = undefined;
      this.dispatchEvent(
        new CustomEvent("purchase-complete", { bubbles: true, composed: true }),
      );
    } catch (error) {
      if (generation !== this.generation) return;
      if (
        [
          "conflict",
          "refresh_required",
          "invalid_request",
          "not_found",
          "unauthorized",
          "busy",
          "backup_in_progress",
        ].includes(errorCode(error))
      ) {
        this.pending = undefined;
        this.stale = ["conflict", "refresh_required", "not_found"].includes(
          errorCode(error),
        );
      }
      this.report(error);
    } finally {
      if (generation === this.generation) {
        this.busy = false;
        this.notifyBusy();
        this.requestUpdate();
      }
    }
  }
  protected render() {
    const fields = this.review?.records[this.index]
      ? ["title", ...PURCHASE_FIELDS]
      : [...PURCHASE_FIELDS];
    const projection = this.review
      ? purchaseProjection(this.review.records, this.review.manual, this.index)
      : undefined;
    return html`<dialog
      aria-labelledby="purchase-edit-title"
      @cancel=${this.close}
      @click=${dismissBackdrop}
    >
      <div class="card-head">
        <h2 id="purchase-edit-title">Edit purchase details</h2>
        ${closeButton((event) => this.close(event), this.busy || !!this.pending)}
      </div>
      ${this.error ? html`<p class="error" role="alert">${this.error}</p>` : nothing}
      ${this.busy ? html`<p role="status">${this.pending ? "Saving purchase details…" : "Loading purchase details…"}</p>` : nothing}
      ${
        this.review
          ? html`
              <label class="check"
                ><input
                  name="purchase_information_unavailable"
                  type="checkbox"
                  .checked=${this.unavailable}
                  ?disabled=${this.busy || !!this.pending}
                  @change=${(event: Event) => {
                    this.unavailable = (
                      event.target as HTMLInputElement
                    ).checked;
                    this.requestUpdate();
                  }}
                />Purchase information unavailable</label
              >
              ${
                !this.unavailable
                  ? html`
                      ${
                        this.review.records.length > 1
                          ? html`<label
                                >Purchase record<select
                                  name="purchase_record"
                                  .value=${String(this.index)}
                                  ?disabled=${this.busy || !!this.pending}
                                  @change=${this.selectReceipt}
                                >
                                  ${this.review.records.map((record, index) => html`<option value=${index}>${record.purchased_on ?? "Date unknown"} · ${record.title}${record.order_id ? ` · ${record.order_id}` : ""}</option>`)}
                                </select></label
                              >
                              <p class="muted">
                                Separate receipts remain separate. Select the
                                purchase to edit.
                              </p>`
                          : nothing
                      }
                      <div class="purchase-fields">
                        ${fields.map(
                          (key) =>
                            html`<label
                              >${LABELS[key]}<input
                                name=${key}
                                type=${key === "purchased_on" ? "date" : "text"}
                                .value=${this.draft[key] ?? ""}
                                ?disabled=${this.busy || !!this.pending || !!projection?.foreign.has(key as PurchaseField)}
                                @input=${(event: Event) => {
                                  this.draft[key] = (
                                    event.target as HTMLInputElement
                                  ).value;
                                  this.requestUpdate();
                                }}
                              />${projection?.foreign.has(key as PurchaseField) ? html`<small>Select the purchase record containing this value to edit it.</small>` : nothing}</label
                            >`,
                        )}
                      </div>
                      ${projection?.conflicts.size ? html`<p class="warning">Some saved purchase values differ. Review the original records in Database.</p>` : nothing}
                    `
                  : nothing
              }
            `
          : nothing
      }
      <div class="dialog-footer">
        <button
          type="button"
          ?disabled=${this.busy || !!this.pending}
          @click=${this.close}
        >
          Cancel
        </button>
        ${
          this.stale
            ? html`<button
                type="button"
                @click=${() => {
                  if (this.confirmNavigation()) void this.load();
                }}
              >
                Reload details
              </button>`
            : nothing
        }
        ${this.review && !this.stale ? html`<button type="button" class="primary" ?disabled=${this.busy} @click=${this.save}>${this.pending ? "Retry exact save" : "Save changes"}</button>` : nothing}
      </div>
    </dialog>`;
  }
}
if (!customElements.get("kaleidescape-group-purchase-edit"))
  customElements.define(
    "kaleidescape-group-purchase-edit",
    GroupPurchaseEditor,
  );
