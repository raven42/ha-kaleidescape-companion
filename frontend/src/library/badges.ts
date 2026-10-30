/** Positive metadata-only badges; never infer capabilities from resolution. */
import { html, nothing } from "lit";
import type { LibrarySummary } from "../core/api";
type VideoMetadata = { formats?: string[] | null; edition?: string | null };
export function statusBadges(row: LibrarySummary) {
  const status =
    row.watched_status === "in_progress"
      ? { key: "progress", label: "In progress", symbol: "◔" }
      : row.watched_status === "watched"
        ? { key: "watched", label: "Watched", symbol: "✓" }
        : row.is_recently_added
          ? { key: "recent", label: "Recently added", symbol: "NEW" }
          : undefined;
  return [
    ...(status ? [status] : []),
    ...(row.is_favorite
      ? [{ key: "favorite", label: "Favorite", symbol: "★" }]
      : []),
  ];
}
export function formatBadges(row: VideoMetadata) {
  const formats = (row.formats?.length ? row.formats : [row.edition ?? ""]).map(
    (value) => value.toLowerCase(),
  );
  const has = (pattern: RegExp) => formats.some((value) => pattern.test(value));
  const badges: { key: string; label: string }[] = [];
  if (
    formats.some(
      (value) => /\b4k\b/.test(value) && !/\bcinematic\b/.test(value),
    )
  )
    badges.push({ key: "four-k", label: "4K" });
  if (
    formats.some((value) => /\b4k\b/.test(value) && /\bcinematic\b/.test(value))
  )
    badges.push({ key: "cinematic", label: "4K Cinematic" });
  if (has(/\bhd\b|\b1080p\b/)) badges.push({ key: "hd", label: "HD" });
  if (has(/\bsd\b|\b(?:480|576)[pi]\b/))
    badges.push({ key: "sd", label: "SD" });
  if (has(/\bsdr\b/)) badges.push({ key: "sdr", label: "SDR" });
  if (has(/\bhdr10\b/)) badges.push({ key: "hdr10", label: "HDR10" });
  if (has(/\bdolby\s*vision\b/))
    badges.push({ key: "vision", label: "Dolby Vision" });
  if (has(/\bdolby\s*atmos\b/))
    badges.push({ key: "atmos", label: "Dolby Atmos" });
  return badges;
}
export function highestVideoFormat(row: VideoMetadata) {
  const badges = formatBadges(row);
  return ["cinematic", "four-k", "hd", "sd"]
    .map((key) => badges.find((badge) => badge.key === key))
    .find(Boolean);
}
export function renderFormatBadges(
  row: VideoMetadata,
  cover = false,
  select?: (value: string) => void,
  disabled = false,
) {
  const best = cover ? highestVideoFormat(row) : undefined;
  return (cover ? (best ? [best] : []) : formatBadges(row)).map((badge) => {
    const content =
      badge.key === "cinematic"
        ? html`<b>4K</b><span class="cinematic-label">Cinematic</span>`
        : badge.label;
    return select
      ? html`<button
          type="button"
          class=${`format-badge format-${badge.key}`}
          aria-label=${`Filter by format: ${badge.label}`}
          ?disabled=${disabled}
          @click=${() => select(badge.label)}
        >
          ${content}
        </button>`
      : html`<span
          class=${`format-badge format-${badge.key}`}
          aria-label=${badge.label}
          >${content}</span
        >`;
  });
}
export function renderStatusBadges(row: LibrarySummary, flags = false) {
  return statusBadges(row).map(
    (badge) =>
      html`<span
        class=${flags ? `cover-flag flag-${badge.key}` : `status-badge flag-${badge.key}`}
        title=${badge.label}
        aria-label=${badge.label}
        role="img"
        ><span class="badge-symbol" aria-hidden="true"
          >${flags ? badge.symbol : badge.key === "recent" ? "✦" : badge.symbol}</span
        >${flags ? "" : ` ${badge.label}`}</span
      >`,
  );
}

export function renderRatingBadge(
  value: string | null | undefined,
  select?: (value: string) => void,
  disabled = false,
) {
  if (!value?.trim()) return nothing;
  const rating = value.trim();
  const normalized = rating.toUpperCase().replaceAll(" ", "");
  const kind =
    (
      {
        G: "general",
        PG: "parental",
        "PG-13": "teen",
        PG13: "teen",
        R: "restricted",
        "NC-17": "adult",
        NC17: "adult",
      } as Record<string, string>
    )[normalized] ?? "unrated";
  if (select)
    return html`<button
      type="button"
      class=${`rating-badge rating-${kind}`}
      aria-label=${`Filter by rating: ${rating}`}
      ?disabled=${disabled}
      @click=${() => select(rating)}
    >
      ${rating}
    </button>`;
  return html`<span
    class=${`rating-badge rating-${kind}`}
    title=${`Rating: ${rating}`}
    >${rating}</span
  >`;
}

export function collectionLabel(value: string) {
  return value.toLocaleLowerCase() === "played" ? "Watched" : value;
}
