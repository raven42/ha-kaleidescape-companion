/** Bounded layout categories, without device identifiers or fingerprint storage.
 * Pin a preference operation to the format in which its view was opened.
 * View controllers reload profiles after a breakpoint change, deferring during dialogs.
 */
export function displayProfile(): "mobile" | "tablet" | "desktop" {
  const width = window.innerWidth;
  return width <= 600 ? "mobile" : width <= 1024 ? "tablet" : "desktop";
}
