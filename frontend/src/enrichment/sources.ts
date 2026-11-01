/** Bounded source choices mirror the backend's field allowlist. */
export const SOURCE_FIELDS = [
  ["actors", "Cast", ["kaleidescape", "tmdb"]],
  ["directors", "Directors", ["kaleidescape", "tmdb"]],
  ["writers", "Writers", ["kaleidescape", "tmdb"]],
  ["producers", "Producers", ["kaleidescape", "tmdb"]],
  ["studios", "Studios", ["kaleidescape", "tmdb"]],
  ["synopsis", "Synopsis", ["kaleidescape", "tmdb"]],
  ["genres", "Genres", ["kaleidescape", "tmdb"]],
  ["distributor", "Distributor", ["kaleidescape"]],
  ["critic_score", "Rotten Tomatoes critics", ["kaleidescape"]],
  ["audience_score", "Rotten Tomatoes audience", ["kaleidescape"]],
  ["audience_rating", "TMDB viewer rating", ["tmdb"]],
  ["artwork", "Cover artwork", ["kaleidescape", "tmdb"]],
  ["backdrop", "Landscape image", ["tmdb"]],
] as const;
export const SOURCE_LABELS: Record<string, string> = {
  auto: "Automatic",
  original: "Original library data",
  kaleidescape: "Kaleidescape store",
  tmdb: "TMDB",
};
