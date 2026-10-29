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
