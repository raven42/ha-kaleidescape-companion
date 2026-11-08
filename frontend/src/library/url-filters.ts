/** Shareable, bounded Library filters for the authenticated Companion panel. */
export const LIBRARY_FACETS = [
  "collection",
  "actor",
  "director",
  "rating",
  "genre",
  "year",
  "format",
  "status",
] as const;
const FLAGS = [
  "missing_metadata_artwork",
  "missing_purchase_information",
] as const;
const STATUSES = new Set([
  "watched",
  "unwatched",
  "in_progress",
  "favorite",
  "watch_soon",
  "recently_added",
]);
export type LibraryUrlFilters = Record<string, string | string[] | boolean>;

export function emptyLibraryFilters(): LibraryUrlFilters {
  return {
    query: "",
    missing_metadata_artwork: false,
    missing_purchase_information: false,
    recently_added: false,
    ...Object.fromEntries(LIBRARY_FACETS.map((key) => [key, []])),
  };
}

export function isLibraryLocation(url = new URL(location.href)) {
  return (
    /^\/kaleidescape-companion\/?$/.test(url.pathname) &&
    url.searchParams.get("companion_page") === "library"
  );
}

export function readLibraryFilters(
  url = new URL(location.href),
  admin = false,
): LibraryUrlFilters | null {
  if (!isLibraryLocation(url)) return null;
  const params = url.searchParams;
  const keys = ["filters", "query", ...LIBRARY_FACETS, ...FLAGS];
  if (!keys.some((key) => params.has(`library_${key}`))) return null;
  const query = params.get("library_query") ?? "";
  const filters: LibraryUrlFilters = {
    query: query.length <= 500 && !query.includes("\0") ? query : "",
    missing_metadata_artwork:
      admin && params.get("library_missing_metadata_artwork") === "1",
    missing_purchase_information:
      admin && params.get("library_missing_purchase_information") === "1",
    recently_added: false,
  };
  for (const key of LIBRARY_FACETS) {
    const values = params.getAll(`library_${key}`);
    filters[key] =
      values.length <= 100
        ? [
            ...new Set(
              values.filter(
                (value) =>
                  value.length > 0 &&
                  value.length <= 500 &&
                  !value.includes("\0") &&
                  (key !== "status" || STATUSES.has(value)),
              ),
            ),
          ]
        : [];
  }
  return filters;
}

export function writeLibraryFilters(filters: LibraryUrlFilters) {
  const url = new URL(location.href);
  if (!isLibraryLocation(url)) return;
  const params = url.searchParams;
  for (const key of ["filters", "query", ...LIBRARY_FACETS, ...FLAGS])
    params.delete(`library_${key}`);
  params.set("library_filters", "1");
  if (typeof filters.query === "string" && filters.query)
    params.set("library_query", filters.query);
  for (const key of LIBRARY_FACETS) {
    const values = filters[key];
    if (Array.isArray(values))
      for (const value of values) params.append(`library_${key}`, value);
  }
  for (const key of FLAGS)
    if (filters[key] === true) params.set(`library_${key}`, "1");
  history.replaceState(history.state, "", url);
}
