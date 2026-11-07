/** Purchase information is shared across the source-defined movie group. */
import type { GroupManualPurchase, LibraryPurchase } from "../core/api";

export const PURCHASE_FIELDS = [
  "purchased_on",
  "purchase_price",
  "retail_price",
  "order_id",
  "href",
] as const;
export type PurchaseField = (typeof PURCHASE_FIELDS)[number];
type Manual = Partial<Pick<GroupManualPurchase, PurchaseField>>;
export function purchaseValues(
  records: LibraryPurchase[],
  manual: Manual[],
  index = 0,
) {
  return purchaseProjection(records, manual, index).values;
}
export function purchaseProjection(
  records: LibraryPurchase[],
  manual: Manual[],
  index = 0,
) {
  const receipt = records[index];
  const foreign = new Set<PurchaseField>();
  const conflicts = new Set<PurchaseField>();
  const values = Object.fromEntries(
    PURCHASE_FIELDS.map((field) => {
      if (receipt?.[field] != null) return [field, receipt[field]];
      const candidates = [
        ...new Set(
          records
            .map((row) => row[field])
            .filter((value): value is string => value != null),
        ),
      ];
      if (candidates.length > 1) {
        conflicts.add(field);
        return [field, null];
      }
      if (candidates.length === 1) {
        foreign.add(field);
        return [field, candidates[0]];
      }
      const saved = [
        ...new Set(
          manual
            .map((row) => row[field])
            .filter((value): value is string => value != null),
        ),
      ];
      if (saved.length > 1) conflicts.add(field);
      return [field, saved[0] ?? null];
    }),
  ) as Record<PurchaseField, string | null>;
  return { values, foreign, conflicts };
}

/** Only open trusted Store routes; imported references may be arbitrary URLs. */
export function storeLink(
  value: string | null | undefined,
): string | undefined {
  if (
    !value ||
    value.includes("\\") ||
    [...value].some((character) => character.charCodeAt(0) <= 32)
  )
    return undefined;
  if (!/^https?:\/\//i.test(value) && !/^\/?movie-store\//.test(value))
    return undefined;
  try {
    const url = new URL(value, "https://www.kaleidescape.com/");
    if (
      !["www.kaleidescape.com", "store.kaleidescape.com"].includes(
        url.hostname,
      ) ||
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.port ||
      !url.pathname.startsWith("/movie-store/")
    )
      return undefined;
    url.protocol = "https:";
    return url.href;
  } catch {
    return undefined;
  }
}
