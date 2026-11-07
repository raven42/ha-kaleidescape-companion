import { expect, it } from "vitest";
import {
  emptyLibraryFilters,
  readLibraryFilters,
  writeLibraryFilters,
} from "../src/library/url-filters";
import { rememberPage } from "../src/ui/navigation";

it("round trips every Library search and filter option without changing other URL state", () => {
  history.replaceState(
    null,
    "",
    "/kaleidescape-companion?companion_page=library&unrelated=kept",
  );
  const filters = {
    ...emptyLibraryFilters(),
    query: "Movie & name",
    collection: ["Drama", "Kids & Family"],
    actor: ["Actor"],
    director: ["Director"],
    rating: ["PG-13"],
    genre: ["Science Fiction"],
    year: ["2025"],
    format: ["4K"],
    status: ["watched", "recently_added"],
    missing_metadata_artwork: true,
    missing_purchase_information: true,
  };
  writeLibraryFilters(filters);
  expect(readLibraryFilters(undefined, true)).toEqual(filters);
  expect(new URL(location.href).searchParams.get("unrelated")).toBe("kept");
  expect(
    readLibraryFilters(undefined, false)!.missing_purchase_information,
  ).toBe(false);
});

it("rejects unsupported, oversized, malformed and non-panel filter inputs", () => {
  const link = new URL(
    "https://example.invalid/kaleidescape-companion?companion_page=library&library_missing_metadata_artwork=1&library_status=watched&library_status=unknown",
  );
  link.searchParams.set("library_query", "x".repeat(501));
  link.searchParams.set("library_actor", "bad\0value");
  for (let i = 0; i < 101; i++)
    link.searchParams.append("library_genre", `genre-${i}`);
  const filters = readLibraryFilters(link, true)!;
  expect(filters).toMatchObject({
    query: "",
    actor: [],
    genre: [],
    status: ["watched"],
    missing_metadata_artwork: true,
  });
  link.pathname = "/lovelace";
  expect(readLibraryFilters(link, true)).toBeNull();
  history.replaceState(null, "", "/lovelace?keep=1");
  writeLibraryFilters({ ...emptyLibraryFilters(), query: "private" });
  expect(location.search).toBe("?keep=1");
});

it("forgets the Journal month on navigation to another view", () => {
  history.replaceState(
    null,
    "",
    "/kaleidescape-companion?companion_page=journal&companion_month=2026-11&library_status=watched&other=kept",
  );
  rememberPage("journal");
  expect(new URL(location.href).searchParams.get("companion_month")).toBe(
    "2026-11",
  );
  rememberPage("library");
  const params = new URL(location.href).searchParams;
  expect(params.has("companion_month")).toBe(false);
  expect(params.get("library_status")).toBe("watched");
  expect(params.get("other")).toBe("kept");
});
