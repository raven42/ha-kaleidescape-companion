/** Text-only setting help, available by hover, keyboard and touch. */
import { LitElement, css, html } from "lit";

export class SettingsHint extends LitElement {
  static properties = {
    label: {},
    hint: {},
  };
  static styles = css`
    :host {
      display: inline-flex;
      vertical-align: middle;
    }
    button {
      display: inline-grid;
      place-items: center;
      width: 28px;
      height: 28px;
      padding: 0;
      border: 0;
      background: transparent;
      color: var(--muted, #52645d);
      cursor: help;
      border-radius: 50%;
    }
    button span {
      display: grid;
      place-items: center;
      width: 18px;
      height: 18px;
      box-sizing: border-box;
      border: 1px solid currentColor;
      border-radius: 50%;
      font: 600 12px/1 system-ui;
    }
    button:hover,
    button[aria-expanded="true"] {
      color: var(--accent, #256b59);
    }
    button:focus-visible {
      outline: 2px solid var(--accent, #256b59);
      outline-offset: 2px;
    }
    .balloon {
      position: fixed;
      z-index: 100;
      box-sizing: border-box;
      padding: 12px 14px;
      border: 1px solid var(--line, #dbe3df);
      border-radius: 10px;
      background: var(--surface, #fff);
      color: var(--primary-text-color, #20302c);
      box-shadow: 0 6px 24px #0003;
      font: 400 13px/1.55 system-ui;
      white-space: normal;
      overflow-wrap: anywhere;
      text-align: start;
    }
    .balloon::before {
      content: "";
      position: absolute;
      left: var(--arrow-left, 16px);
      top: -5px;
      width: 8px;
      height: 8px;
      background: inherit;
      border-top: 1px solid var(--line, #dbe3df);
      border-left: 1px solid var(--line, #dbe3df);
      transform: rotate(45deg);
    }
    .balloon[data-above]::before {
      top: auto;
      bottom: -5px;
      transform: rotate(225deg);
    }
    [hidden] {
      display: none;
    }
  `;
  label = "";
  hint = "";
  private open = false;
  private hovering = false;
  private focused = false;
  private pinned = false;
  private closing?: ReturnType<typeof setTimeout>;
  private listeners?: AbortController;

  disconnectedCallback() {
    this.dismiss();
    super.disconnectedCallback();
  }
  private dismiss = () => {
    clearTimeout(this.closing);
    this.listeners?.abort();
    this.listeners = undefined;
    this.open = this.pinned = this.hovering = this.focused = false;
    this.requestUpdate();
  };
  private async show() {
    clearTimeout(this.closing);
    if (this.open) return;
    this.open = true;
    this.listeners = new AbortController();
    const { signal } = this.listeners;
    document.addEventListener(
      "pointerdown",
      (event) => {
        if (!event.composedPath().includes(this)) this.dismiss();
      },
      { signal },
    );
    document.addEventListener(
      "keydown",
      (event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          this.dismiss();
        }
      },
      { signal, capture: true },
    );
    document.addEventListener(
      "companion-hint-open",
      (event) => {
        if ((event as CustomEvent).detail !== this) this.dismiss();
      },
      { signal },
    );
    document.dispatchEvent(
      new CustomEvent("companion-hint-open", { detail: this }),
    );
    window.addEventListener("scroll", this.position, { signal, capture: true });
    window.addEventListener("resize", this.position, { signal });
    window.visualViewport?.addEventListener("resize", this.position, {
      signal,
    });
    window.visualViewport?.addEventListener("scroll", this.position, {
      signal,
    });
    this.requestUpdate();
    await this.updateComplete;
    if (this.open && this.isConnected) this.position();
  }
  private position = () => {
    const button = this.renderRoot.querySelector("button");
    const balloon = this.renderRoot.querySelector<HTMLElement>(".balloon");
    if (!this.open || !button || !balloon) return;
    const viewport = window.visualViewport;
    const width = viewport?.width ?? window.innerWidth;
    const height = viewport?.height ?? window.innerHeight;
    const leftEdge = viewport?.offsetLeft ?? 0;
    const topEdge = viewport?.offsetTop ?? 0;
    const anchor = button.getBoundingClientRect();
    const balloonWidth = Math.min(320, width - 24);
    balloon.style.width = `${balloonWidth}px`;
    const size = balloon.getBoundingClientRect();
    const left = Math.max(
      leftEdge + 12,
      Math.min(anchor.left - 8, leftEdge + width - balloonWidth - 12),
    );
    const above = anchor.bottom + 10 + size.height > topEdge + height - 12;
    const top = above
      ? Math.max(topEdge + 12, anchor.top - size.height - 10)
      : anchor.bottom + 10;
    balloon.style.left = `${left}px`;
    balloon.style.top = `${top}px`;
    balloon.style.setProperty(
      "--arrow-left",
      `${Math.max(12, Math.min(balloonWidth - 20, anchor.left + anchor.width / 2 - left - 4))}px`,
    );
    balloon.toggleAttribute("data-above", above);
  };
  private closeWhenIdle() {
    clearTimeout(this.closing);
    if (!this.pinned && !this.focused && !this.hovering)
      this.closing = setTimeout(this.dismiss, 120);
  }
  protected render() {
    return html`<span
      @pointerenter=${(event: PointerEvent) => {
        if (event.pointerType === "touch") return;
        this.hovering = true;
        void this.show();
      }}
      @pointerleave=${() => {
        this.hovering = false;
        this.closeWhenIdle();
      }}
      @focusin=${() => {
        this.focused = true;
        void this.show();
      }}
      @focusout=${() => {
        this.focused = this.pinned = false;
        this.closeWhenIdle();
      }}
      ><button
        type="button"
        aria-label=${`Help for ${this.label}`}
        aria-describedby="hint"
        aria-expanded=${this.open}
        @click=${() => {
          if (this.pinned) this.dismiss();
          else {
            this.pinned = true;
            void this.show();
          }
        }}
      >
        <span aria-hidden="true">?</span></button
      ><span class="balloon" id="hint" role="tooltip" ?hidden=${!this.open}
        >${this.hint}</span
      ></span
    >`;
  }
}
if (!customElements.get("kaleidescape-settings-hint"))
  customElements.define("kaleidescape-settings-hint", SettingsHint);

export function settingHint(label: string, hint: string) {
  return html`<kaleidescape-settings-hint
    .label=${label}
    .hint=${hint}
  ></kaleidescape-settings-hint>`;
}

/** Keep the input's accessible label/description in its own shadow root. */
export function settingLabel(key: string, label: string, hint: string) {
  return html`<span class="setting-label"
    ><label for=${key}>${label}</label>${settingHint(label, hint)}
    <span class="setting-description" id=${`${key}-hint`}>${hint}</span></span
  >`;
}
