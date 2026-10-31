/** URL contains only an allowlisted tab, never records, queries, or credentials. */
export type Page =
  "now-playing" | "journal" | "library" | "database" | "logs" | "settings";
const pages: Page[] = [
  "now-playing",
  "library",
  "journal",
  "database",
  "logs",
  "settings",
];
export function landingPage(
  fallback: string | undefined,
  admin: boolean,
  library: boolean,
): Page {
  const allowed = (page: string | null | undefined): page is Page =>
    pages.includes(page as Page) &&
    (admin ||
      page === "now-playing" ||
      page === "journal" ||
      page === "library") &&
    (page !== "library" || library);
  const requested = new URL(location.href).searchParams.get("companion_page");
  return allowed(requested)
    ? requested
    : allowed(fallback)
      ? fallback
      : "journal";
}
export function rememberPage(page: Page) {
  const url = new URL(location.href);
  url.searchParams.set("companion_page", page);
  history.replaceState(history.state, "", url);
}
