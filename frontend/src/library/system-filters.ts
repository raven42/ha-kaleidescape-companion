/** Administrator-only Library maintenance categories. */
export const SYSTEM_FILTERS = [
  [
    "artwork_unavailable",
    "Artwork unavailable",
    "The cover or backdrop is marked unavailable.",
  ],
  [
    "badges_updated",
    "Badges updated",
    "A scraper added format badges beyond those in the Library scan.",
  ],
  [
    "currency_mismatch",
    "Currency mismatch",
    "Purchase or retail prices for the title use more than one currency.",
  ],
  [
    "edited",
    "Edited",
    "A Library display field was manually edited. Some older edits may not have recorded provenance.",
  ],
  [
    "journal_edited",
    "Journal edited",
    "A linked Journal entry has manually corrected fields.",
  ],
  [
    "manual_viewing",
    "Manually added viewing",
    "The title has a linked viewing that was manually added.",
  ],
  [
    "metadata_conflict",
    "Metadata conflict",
    "Metadata sources have a scraper conflict.",
  ],
  [
    "metadata_edited",
    "Metadata edited",
    "A per-title metadata source selection differs from the default selected source.",
  ],
  [
    "metadata_unavailable",
    "Metadata unavailable",
    "A metadata source is marked unavailable.",
  ],
  [
    "missing_artwork",
    "Missing artwork",
    "A version is missing cover or backdrop artwork that is not marked unavailable.",
  ],
  [
    "missing_metadata",
    "Missing metadata",
    "A metadata source has no data and is not marked unavailable.",
  ],
  [
    "missing_purchase_information",
    "Missing purchase",
    "The purchase date, paid price or order ID is missing, unless purchase information is marked unavailable.",
  ],
  [
    "missing_retail_price",
    "Missing retail price",
    "The retail price is missing, unless purchase information is marked unavailable.",
  ],
  [
    "split_viewings",
    "Split viewings",
    "A completed viewing spans calendar days and exceeds its runtime by at least six hours. Viewings without a known runtime or completion time are excluded.",
  ],
  [
    "upgraded",
    "Upgraded",
    "A higher-quality version was first detected more than two days after a lower-quality version. Quality follows the scanned video format.",
  ],
] as const;
