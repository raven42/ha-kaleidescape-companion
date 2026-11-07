/** Source-scoped Journal artwork and navigation using the saved exact version link. */
import { LitElement, css, html, nothing } from "lit";
import type { PropertyValues } from "lit";
import type {
  JournalClient,
  JournalInfo,
  ViewingLibraryLink,
} from "../core/api";
import { errorCode, errorMessage } from "../core/api";
import { CoverQueue } from "../library/cover";
import { styles } from "./styles";
import "../library/library";

export class ViewingLibrary extends LitElement {
  static properties = {
    client: { attribute: false },
    scope: { attribute: false },
    viewingId: { type: String },
    disabled: { type: Boolean },
    advanced: { type: Boolean },
    autoOpen: { type: Boolean },
  };
  static styles = [
    styles,
    css`
      :host {
        display: block;
      }
      .linked-movie {
        display: flex;
        align-items: center;
        gap: 16px;
        margin-block: 16px;
      }
      .linked-movie > div {
        min-width: 0;
        overflow-wrap: anywhere;
      }
      kaleidescape-library-cover {
        width: 110px;
        height: 165px;
        flex: 0 0 110px;
        border-radius: 6px;
      }
      @media (max-width: 600px) {
        .linked-movie {
          gap: 10px;
          margin-block: 10px;
        }
        kaleidescape-library-cover {
          width: 72px;
          height: 108px;
          flex-basis: 72px;
        }
      }
    `,
  ];
  client?: JournalClient;
  scope?: JournalInfo;
  viewingId = "";
  private openTitleId?: string;
  disabled = false;
  advanced = false;
  autoOpen = false;
  private autoOpened = false;
  private queue = new CoverQueue();
  private link?: ViewingLibraryLink | null;
  private error = "";
  private generation = 0;
  private bound = "";
  private boundClient?: JournalClient;
  protected willUpdate(changed: PropertyValues) {
    const key = `${this.scope?.entry_id}:${this.scope?.dataset_id}:${this.scope?.library_enabled}:${this.scope?.permissions.edit}:${this.viewingId}`;
    if (key === this.bound && this.client === this.boundClient) {
      if (changed.has("autoOpen")) {
        if (!this.autoOpen) {
          if (this.autoOpened) this.openTitleId = undefined;
          this.autoOpened = false;
        } else this.openAutomatically();
      }
      return;
    }
    this.clear();
    this.bound = key;
    this.boundClient = this.client;
    this.reportLink();
    void this.load();
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    this.clear();
    this.bound = "";
    this.boundClient = undefined;
  }
  private clear() {
    this.generation++;
    this.queue.cache.dispose();
    this.queue = new CoverQueue();
    this.openTitleId = undefined;
    this.autoOpened = false;
    this.link = undefined;
    this.error = "";
  }
  private async load() {
    if (!this.client || !this.scope?.library_enabled || !this.viewingId) return;
    const generation = this.generation;
    try {
      const result = await this.client.viewingLibrary(
        this.scope,
        this.viewingId,
      );
      if (generation === this.generation) {
        this.link = result.library;
        this.reportLink();
        this.openAutomatically();
      }
    } catch (error) {
      if (generation !== this.generation) return;
      this.error = errorMessage(error);
      if (errorCode(error) === "unauthorized") {
        this.clear();
        this.requestUpdate();
        this.dispatchEvent(
          new CustomEvent("access-denied", { bubbles: true, composed: true }),
        );
      }
    } finally {
      if (generation === this.generation) this.requestUpdate();
    }
  }
  private reportLink() {
    this.dispatchEvent(
      new CustomEvent("viewing-library-link", {
        detail: { viewingId: this.viewingId, linked: !!this.link },
        bubbles: true,
        composed: true,
      }),
    );
  }
  private openAutomatically() {
    if (this.autoOpen && !this.autoOpened && this.link && !this.disabled) {
      this.autoOpened = true;
      this.openLibrary();
    }
  }
  openLibrary() {
    if (!this.link || this.disabled) return;
    this.openTitleId = this.link.title_id;
    this.requestUpdate();
  }
  protected render() {
    return html` ${this.error ? html`<p class="error" role="alert">${this.error} <button @click=${this.load}>Retry Library link</button></p>` : nothing}
    ${this.scope?.library_enabled && this.link === null ? html`<p class="muted">No linked Library entry is available.</p>` : nothing}
    ${
      this.link
        ? html`<div class="linked-movie">
            <kaleidescape-library-cover
              .client=${this.client}
              .scope=${this.scope}
              .queue=${this.queue}
              .artworkKey=${this.link.artwork_key}
              .title=${this.link.title}
              @access-denied=${() => {
                this.clear();
                this.requestUpdate();
                this.dispatchEvent(
                  new CustomEvent("access-denied", {
                    bubbles: true,
                    composed: true,
                  }),
                );
              }}
            ></kaleidescape-library-cover>
          </div>`
        : nothing
    }
    ${
      this.openTitleId
        ? html`<kaleidescape-library
            .client=${this.client}
            .scope=${this.scope}
            .dialogOnly=${true}
            .advanced=${this.advanced}
            .openTitleId=${this.openTitleId}
            @title-dialog-closed=${() => {
              if (this.openTitleId === undefined) return;
              this.openTitleId = undefined;
              this.requestUpdate();
            }}
            @title-dialog-error=${(event: CustomEvent<string>) => {
              this.openTitleId = undefined;
              this.error = event.detail;
              this.requestUpdate();
            }}
          ></kaleidescape-library>`
        : nothing
    }`;
  }
}
if (!customElements.get("kaleidescape-viewing-library"))
  customElements.define("kaleidescape-viewing-library", ViewingLibrary);
