/** URL contains an allowlisted tab, calendar month and Library filter state. */
export const PAGES = [
  {
    id: "now-playing",
    label: "Now Playing",
    description: "See what’s playing across your system.",
  },
  {
    id: "library",
    label: "Library",
    description: "Browse movies and collections.",
  },
  {
    id: "journal",
    label: "Journal",
    description: "Explore your viewing history.",
  },
  {
    id: "database",
    label: "Database",
    description: "Inspect and manage stored history.",
  },
  {
    id: "settings",
    label: "Settings",
    description: "Configure your Companion experience.",
  },
] as const;
export type Page = (typeof PAGES)[number]["id"];
const pages: Page[] = PAGES.map((page) => page.id);
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
