/** Positive metadata-only badges; never infer capabilities from resolution. */
import { html, nothing, svg } from "lit";
import type { LibrarySummary } from "../core/api";
type VideoMetadata = { formats?: string[] | null; edition?: string | null };
export type MovieStatusLabels = "modern" | "kaleidescape";
export function movieStatuses(row: LibrarySummary): string[] {
  return (
    row.movie_statuses ??
    (["unwatched", "watched", "in_progress"].includes(row.watched_status)
      ? [row.watched_status]
      : [])
  );
}
export function movieStatusLabel(
  status: string,
  style: MovieStatusLabels = "modern",
) {
  return (
    (
      {
        unwatched: style === "modern" ? "Unwatched" : "New",
        watched: style === "modern" ? "Watched" : "Played",
        in_progress: style === "modern" ? "In progress" : "Paused",
        unknown: "Unknown",
        none: "No status",
      } as Record<string, string>
    )[status] ?? "Unknown"
  );
}
export function statusBadges(
  row: LibrarySummary,
  style: MovieStatusLabels = "modern",
) {
  const watchSoon =
    row.is_watch_soon ??
    row.collections.some(
      (name) => name.toLowerCase().replace(/[\s_-]+/g, "") === "watchsoon",
    );
  const statuses = movieStatuses(row);
  return [
    ...(statuses.includes("in_progress")
      ? [
          {
            key: "progress",
            label: movieStatusLabel("in_progress", style),
            symbol: "◔",
          },
        ]
      : []),
    ...(statuses.includes("watched")
      ? [
          {
            key: "watched",
            label: movieStatusLabel("watched", style),
            symbol: "✓",
          },
        ]
      : []),
    ...(!statuses.includes("in_progress") &&
    !statuses.includes("watched") &&
    watchSoon
      ? [{ key: "watch-soon", label: "Watch Soon", symbol: "" }]
      : []),
    ...(statuses.includes("unwatched")
      ? [
          {
            key: "unwatched",
            label: movieStatusLabel("unwatched", style),
            symbol: movieStatusLabel("unwatched", style),
          },
        ]
      : []),
    ...(row.is_recently_added
      ? [{ key: "recent", label: "Recently Added", symbol: "Recently Added" }]
      : []),
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
const dolbySymbol = svg`<svg class="dolby-symbol" viewBox="0 0 24 16" aria-hidden="true" focusable="false">
  <path fill="currentColor" d="M1 1h3.1c4.1 0 7 2.9 7 7s-2.9 7-7 7H1V1Zm22 0h-3.1c-4.1 0-7 2.9-7 7s2.9 7 7 7H23V1Z" />
</svg>`;
const watchSoonSymbol = svg`<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
  <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2" />
  <path d="M12 6v6h5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
</svg>`;
const hdrSymbol = svg`<svg class="hdr-symbol" viewBox="0 0 27 16" aria-hidden="true" focusable="false">
  <path fill="#e94637" d="M1 4 7 3v10l-6-1z" />
  <path fill="#f28c28" d="M6 3 12 2v12l-6-1z" />
  <path fill="#edc13b" d="M11 2 17 1v14l-6-1z" />
  <path fill="#72ad69" d="M16 1 22 0v16l-6-1z" />
  <path fill="#298a98" d="M21 1 26 0v16l-5-1z" />
</svg>`;
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
        : badge.key === "vision" || badge.key === "atmos"
          ? html`${dolbySymbol}<span>${badge.label}</span>`
          : badge.key === "hdr10"
            ? html`${hdrSymbol}<b>HDR10</b>`
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
  style: MovieStatusLabels = "modern",
) {
  const badges = statusBadges(row, style);
  const topStatus = badges.some((badge) =>
    ["watched", "progress", "watch-soon"].includes(badge.key),
  );
  let labelIndex = 0;
  let triangleCount = 0;
  return badges
    .filter((badge) => !exclude.includes(badge.key))
    .map((badge) => {
      const isTriangle = ["watched", "progress", "watch-soon"].includes(
        badge.key,
      );
      const extra = flags && isTriangle && triangleCount++ > 0;
      const isLabel =
        extra || ["recent", "new", "unwatched"].includes(badge.key);
      const top =
        flags && isLabel
          ? 8 + (topStatus ? 42 : 0) + labelIndex++ * 26
          : undefined;
      return html`<span
        class=${flags ? `cover-flag flag-${badge.key === "unwatched" && style === "kaleidescape" ? "new" : badge.key}${extra ? " flag-status-extra" : ""}${badge.key === "recent" && badges.length > 1 ? " flag-offset" : ""}` : `status-badge collection-badge collection-${collectionKind(badge.label)}${badge.key === "recent" ? " status-recent" : ""}`}
        style=${top === undefined ? nothing : `top:${top}px`}
        title=${badge.label}
        aria-label=${badge.label}
        role="img"
        >${flags ? html`<span class="badge-symbol" aria-hidden="true">${extra ? badge.label : badge.key === "watch-soon" ? watchSoonSymbol : badge.symbol}</span>` : html`${collectionSymbol(badge.label)}<span>${badge.label}</span>`}</span
      >`;
    });
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
  const key = value.toLowerCase().replace(/[\s_-]+/g, "");
  return key === "played"
    ? "Watched"
    : key === "watchsoon"
      ? "Watch Soon"
      : value;
}

export function collectionKind(value: string) {
  const key = value.toLowerCase();
  if (key.replace(/[\s_-]+/g, "") === "watchsoon") return "watch-soon";
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
    "watch-soon": svg`<circle cx="12" cy="12" r="10"/><path d="M12 6v6h5"/>`,
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
