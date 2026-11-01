/** Positive metadata-only badges; never infer capabilities from resolution. */
import { html, nothing, svg } from "lit";
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
export function renderStatusBadges(
  row: LibrarySummary,
  flags = false,
  exclude: readonly string[] = [],
) {
  return statusBadges(row)
    .filter((badge) => !exclude.includes(badge.key))
    .map(
      (badge) =>
        html`<span
          class=${flags ? `cover-flag flag-${badge.key}` : `status-badge collection-badge collection-${collectionKind(badge.label)}`}
          title=${badge.label}
          aria-label=${badge.label}
          role="img"
          >${flags ? html`<span class="badge-symbol" aria-hidden="true">${badge.symbol}</span>` : html`${collectionSymbol(badge.label)}<span>${badge.label}</span>`}</span
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

export function collectionKind(value: string) {
  const key = value.toLowerCase();
  return (
    (
      {
        all: "all",
        new: "new",
        "recently added": "new",
        unwatched: "unwatched",
        watched: "watched",
        played: "watched",
        favorites: "favorite",
        favorite: "favorite",
        paused: "progress",
        "in progress": "progress",
      } as Record<string, string>
    )[key] ?? "all"
  );
}

export function collectionSymbol(value: string) {
  const kind = collectionKind(value);
  const shapes = {
    all: svg`<path d="m2 7 10-5 10 5-10 5zM2 12l10 5 10-5M2 17l10 5 10-5"/>`,
    new: svg`<path d="m12 1 3 2 4 1 1 4 3 4-3 3-1 4-4 1-3 3-3-3-4-1-1-4-3-3 3-4 1-4 4-1z"/><text x="12" y="14.5" text-anchor="middle" fill="currentColor" stroke="none" font-size="6" font-weight="800">NEW</text>`,
    unwatched: svg`<circle cx="12" cy="12" r="10"/><path fill="currentColor" stroke="none" d="m9 6 9 6-9 6z"/>`,
    watched: svg`<circle cx="12" cy="12" r="10"/><path d="m6 12 4 4 8-8"/>`,
    favorite: svg`<path d="M12 21 3 12C-3 4 6-1 12 6c6-7 15-2 9 6z"/>`,
    progress: svg`<circle cx="12" cy="12" r="10"/><path d="M9 7v10M15 7v10"/>`,
  };
  return svg`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${shapes[kind as keyof typeof shapes]}</svg>`;
}

export function renderCollectionBadge(
  value: string,
  select?: () => void,
  disabled = false,
) {
  const content = html`${collectionSymbol(value)}<span
      >${collectionLabel(value)}</span
    >`;
  const className = `collection-badge collection-${collectionKind(value)}`;
  return select
    ? html`<button
        type="button"
        class=${className}
        aria-label=${`Filter by collection: ${collectionLabel(value)}`}
        ?disabled=${disabled}
        @click=${select}
      >
        ${content}
      </button>`
    : html`<span class=${className}>${content}</span>`;
}
