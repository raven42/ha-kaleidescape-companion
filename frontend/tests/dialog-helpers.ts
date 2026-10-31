/** Prefer the active modal when a component renders several dialogs. */
export function modalClose(root: ParentNode): HTMLButtonElement {
  const button =
    root.querySelector<HTMLButtonElement>(
      "dialog[open] .dialog-close, dialog[open] > .movie-heading .dialog-close",
    ) ?? root.querySelector<HTMLButtonElement>(".dialog-close");
  if (!button) throw new Error("Missing accessible modal close control");
  return button;
}
