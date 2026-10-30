/** A detail click replaces the Library search or selects one exact facet. */
export interface LibraryCriterion {
  key:
    "query" | "year" | "genre" | "collection" | "status" | "rating" | "format";
  value: string;
}
