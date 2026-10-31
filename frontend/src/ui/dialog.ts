import { html } from "lit";

/** Shared dismissal control; callers retain their draft/write guards. */
export function closeButton(close: (event: Event) => void, disabled = false) {
  return html`<button
    type="button"
    class="dialog-close"
    aria-label="Close"
    title="Close"
    ?disabled=${disabled}
    @click=${close}
  >
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="m6 6 12 12M18 6 6 18"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
      />
    </svg>
  </button>`;
}

/** Give backdrop clicks the same guarded dismissal path as Escape. */
export function dismissBackdrop(event: MouseEvent) {
  const dialog = event.currentTarget as HTMLDialogElement;
  if (event.target !== dialog) return;
  const bounds = dialog.getBoundingClientRect();
  if (
    event.clientX >= bounds.left &&
    event.clientX <= bounds.right &&
    event.clientY >= bounds.top &&
    event.clientY <= bounds.bottom
  )
    return;
  if (dialog.dispatchEvent(new Event("cancel", { cancelable: true })))
    dialog.close();
}
