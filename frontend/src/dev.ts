/** Vite entry point, deliberately excluded from the distributed HA panel bundle. */
import { LitElement, css, html } from "lit";
import "./panel";
import { connectDevelopment, DEVELOPMENT_HA } from "./dev-connection";
import type { DevelopmentSession } from "./dev-connection";
import { errorCode } from "./api";

export class KaleidescapeDevelopment extends LitElement {
  static styles = css`
    :host {
      display: block;
      font-family: system-ui, sans-serif;
      color: CanvasText;
      background: Canvas;
      min-height: 100vh;
    }
    .connection {
      max-width: 520px;
      margin: 8vh auto;
      padding: 32px;
      border: 1px solid #83948d;
      border-radius: 12px;
    }
    h1 {
      font-size: 26px;
      margin-top: 0;
    }
    p {
      line-height: 1.6;
    }
    small {
      line-height: 1.6;
    }
    label {
      display: block;
      font-size: 14px;
      margin: 24px 0 8px;
    }
    input {
      width: 100%;
      box-sizing: border-box;
      padding: 12px;
      background: Canvas;
      color: CanvasText;
      border: 1px solid #83948d;
      border-radius: 6px;
      font: inherit;
    }
    button {
      margin-top: 16px;
      padding: 10px 16px;
      background: #256b59;
      color: white;
      border: 0;
      border-radius: 6px;
      font: inherit;
      cursor: pointer;
    }
    button:disabled {
      opacity: 0.5;
    }
    :focus-visible {
      outline: 3px solid #4c9f87;
      outline-offset: 3px;
    }
    nav {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
      padding: 10px 24px;
      background: #183a30;
      color: white;
      font-size: 13px;
    }
    nav button {
      margin: 0 0 0 auto;
      background: transparent;
      border: 1px solid #88ae9f;
      padding: 6px 12px;
    }
    .error {
      color: light-dark(#b5262c, #ff9f9f);
    }
    @media (max-width: 600px) {
      .connection {
        margin: 24px 16px;
        padding: 24px;
      }
    }
  `;
  private session?: DevelopmentSession;
  private connecting = false;
  private error = "";
  private generation = 0;
  private readonly leave = () => this.disconnect();
  connectedCallback() {
    super.connectedCallback();
    window.addEventListener("pagehide", this.leave);
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener("pagehide", this.leave);
    this.disconnect();
  }
  private disconnect(message = "") {
    this.generation++;
    this.session?.close();
    this.session = undefined;
    this.connecting = false;
    this.error = message;
    this.requestUpdate();
  }
  private async connect(event: SubmitEvent) {
    event.preventDefault();
    if (this.connecting) return;
    const input = this.renderRoot.querySelector<HTMLInputElement>("#token")!;
    const token = input.value.trim();
    input.value = "";
    if (!token) return;
    const generation = ++this.generation;
    this.connecting = true;
    this.error = "";
    this.requestUpdate();
    try {
      const session = await connectDevelopment(token, () =>
        this.disconnect(
          "The connection closed. Reconnect to refresh the journal. An interrupted save may have committed.",
        ),
      );
      if (generation !== this.generation) {
        session.close();
        return;
      }
      this.session = session;
    } catch (error) {
      if (generation === this.generation)
        this.error =
          errorCode(error) === "unauthorized"
            ? "An active development administrator account is required."
            : "Could not connect. Check that local HA is running and the development token is valid.";
    } finally {
      if (generation === this.generation) {
        this.connecting = false;
        this.requestUpdate();
      }
    }
  }
  protected render() {
    if (this.session)
      return html`<nav>
          <strong>Development</strong
          ><span>${this.session.name} · ${DEVELOPMENT_HA}</span
          ><button @click=${() => this.disconnect()}>Disconnect</button>
        </nav>
        <kaleidescape-panel
          .client=${this.session.client}
        ></kaleidescape-panel>`;
    return html`<section class="connection">
      <small>KALEIDESCAPE COMPANION · LOCAL DEVELOPMENT</small>
      <h1>Connect to your test journal</h1>
      <p>
        Start the local HA server and add the Kaleidescape Companion
        integration. Use a token from an administrator account on that
        development instance.
      </p>
      <p><strong>${DEVELOPMENT_HA}</strong></p>
      <form @submit=${this.connect}>
        <label for="token">Development access token</label
        ><input
          id="token"
          type="password"
          required
          autocomplete="off"
          spellcheck="false"
          ?disabled=${this.connecting}
        /><button ?disabled=${this.connecting}>
          ${this.connecting ? "Connecting…" : "Connect"}
        </button>
      </form>
      <p>
        <small
          >The token stays in memory until you disconnect or reload. Use
          development credentials only. In HA, the panel uses your existing
          signed-in session.</small
        >
      </p>
      ${this.error ? html`<p class="error" role="alert">${this.error}</p>` : ""}
    </section>`;
  }
}
customElements.define("kaleidescape-dev", KaleidescapeDevelopment);
