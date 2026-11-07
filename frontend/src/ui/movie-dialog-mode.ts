/** Current user's Journal movie detail presentation. */

let unified = true;
const listeners = new Set<() => void>();

export function unifiedMovieDialog() {
  return unified;
}
export function setUnifiedMovieDialog(value: boolean) {
  if (unified === value) return;
  unified = value;
  for (const listener of listeners) listener();
}
export function watchMovieDialogMode(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
