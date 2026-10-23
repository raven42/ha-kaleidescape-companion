/** Standalone framework shell; no Home Assistant or device requests. */
import { LitElement, css, html } from "lit";

export class KaleidescapePanel extends LitElement {
  static styles = css`
    :host {
      display: block;
      color: var(--primary-text-color, CanvasText);
      background: var(--primary-background-color, Canvas);
      min-height: 100dvh;
    }
    main {
      box-sizing: border-box;
      max-width: 60rem;
      margin: 0 auto;
      padding: clamp(1rem, 5vw, 3rem);
    }
    h1 { margin-top: 0; }
    p { max-width: 42rem; line-height: 1.6; }
  `;

  protected render() {
    return html`
      <main>
        <h1>Kaleidescape</h1>
        <p>Project framework</p>
        <p>
          Watch journal, Now Playing, library browser, and playback controls
          will be added in the planned phases.
        </p>
      </main>
    `;
  }
}

customElements.define("kaleidescape-panel", KaleidescapePanel);
