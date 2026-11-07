/** URL contains an allowlisted tab, calendar month and Library filter state. */
export type Page =
  "now-playing" | "journal" | "library" | "database" | "settings";
const pages: Page[] = [
  "now-playing",
  "library",
  "journal",
  "database",
  "settings",
];
export function landingPage(
  fallback: string | undefined,
  admin: boolean,
  library: boolean,
  useCurrentPage = true,
): Page {
  const allowed = (page: string | null | undefined): page is Page =>
    pages.includes(page as Page) &&
    (admin ||
      page === "now-playing" ||
      page === "journal" ||
      page === "library") &&
    (page !== "library" || library);
  const requested = useCurrentPage
    ? new URL(location.href).searchParams.get("companion_page")
    : null;
  return allowed(requested)
    ? requested
    : allowed(fallback)
      ? fallback
      : "journal";
}
export function rememberPage(page: Page) {
  const url = new URL(location.href);
  url.searchParams.set("companion_page", page);
  if (page !== "journal") url.searchParams.delete("companion_month");
  history.replaceState(history.state, "", url);
}
