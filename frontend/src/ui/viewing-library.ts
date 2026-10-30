/** Source-scoped Journal artwork and navigation using the saved exact version link. */
import { LitElement, css, html, nothing } from "lit";
import type {
  JournalClient,
  JournalInfo,
  ViewingLibraryLink,
} from "../core/api";
import { errorCode, errorMessage } from "../core/api";
import { CoverQueue } from "../library/cover";
import { styles } from "./styles";

export class ViewingLibrary extends LitElement {
  static properties = {
    client: { attribute: false },
    scope: { attribute: false },
    viewingId: { type: String },
    disabled: { type: Boolean },
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
      kaleidescape-library-cover {
        width: 110px;
        height: 165px;
        flex: 0 0 110px;
        border-radius: 6px;
      }
    `,
  ];
  client?: JournalClient;
  scope?: JournalInfo;
  viewingId = "";
  disabled = false;
  private queue = new CoverQueue();
  private link?: ViewingLibraryLink | null;
  private error = "";
  private generation = 0;
  private bound = "";
  private boundClient?: JournalClient;
  protected willUpdate() {
    const key = `${this.scope?.entry_id}:${this.scope?.dataset_id}:${this.scope?.library_enabled}:${this.viewingId}`;
    if (key === this.bound && this.client === this.boundClient) return;
    this.clear();
    this.bound = key;
    this.boundClient = this.client;
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
      if (generation === this.generation) this.link = result.library;
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
  protected render() {
    if (!this.scope?.library_enabled) return nothing;
    if (this.error)
      return html`<p class="error" role="alert">
        ${this.error} <button @click=${this.load}>Retry Library link</button>
      </p>`;
    if (this.link === null)
      return html`<p class="muted">No linked Library entry is available.</p>`;
    if (!this.link) return nothing;
    return html`<div class="linked-movie">
      <kaleidescape-library-cover
        .client=${this.client}
        .scope=${this.scope}
        .queue=${this.queue}
        .artworkKey=${this.link.artwork_key}
        .title=${this.link.title}
        @access-denied=${() => {
          this.clear();
          this.requestUpdate();
        }}
      ></kaleidescape-library-cover>
      <button
        class="link"
        ?disabled=${this.disabled}
        @click=${() =>
          this.dispatchEvent(
            new CustomEvent("open-library-title", {
              detail: this.link!.title_id,
              bubbles: true,
              composed: true,
            }),
          )}
      >
        View in Library: ${this.link.title}
      </button>
    </div>`;
  }
}
if (!customElements.get("kaleidescape-viewing-library"))
  customElements.define("kaleidescape-viewing-library", ViewingLibrary);
