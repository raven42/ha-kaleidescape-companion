/** Compact, source-labelled scores; missing ratings are never invented. */
import criticsPositive from "../ui/assets/rt-critics-positive.svg?inline";
import criticsNegative from "../ui/assets/rt-critics-negative.svg?inline";
import audiencePositive from "../ui/assets/rt-audience-positive.svg?inline";
import audienceNegative from "../ui/assets/rt-audience-negative.svg?inline";
import { html, nothing } from "lit";
import type { LibraryTitle } from "../core/api";

export function ratingScores(row: LibraryTitle) {
  const metadata = row.enrichment ?? {};
  const reviewed = metadata.reviewed;
  return [
    {
      kind: "viewer",
      label: "TMDB viewer rating",
      value: row.ratings
        ? row.ratings.audience_rating
        : (reviewed?.audience_rating ?? metadata.tmdb?.audience_rating),
      max: 10,
    },
    {
      kind: "critic",
      label: "Rotten Tomatoes critics",
      value: row.ratings
        ? row.ratings.critic_score
        : (reviewed?.critic_score ?? metadata.kaleidescape?.critic_score),
      max: 100,
    },
    {
      kind: "audience",
      label: "Rotten Tomatoes audience",
      value: row.ratings
        ? row.ratings.audience_score
        : (reviewed?.audience_score ?? metadata.kaleidescape?.audience_score),
      max: 100,
    },
  ].filter(
    ({ value, max }) =>
      typeof value === "number" &&
      Number.isFinite(value) &&
      value >= 0 &&
      value <= max,
  );
}

export function renderRatings(row?: LibraryTitle) {
  const scores = row ? ratingScores(row) : [];
  if (!scores.length) return nothing;
  return html`<div
    class="movie-ratings"
    slot="collection"
    aria-label="Viewer and critic ratings"
  >
    ${scores.map(({ kind, label, value, max }) => {
      const percent = Math.round((value! / max) * 100);
      const icon =
        kind === "critic"
          ? percent >= 60
            ? criticsPositive
            : criticsNegative
          : percent >= 60
            ? audiencePositive
            : audienceNegative;
      return html`<span
        class=${`score-chip score-${kind}`}
        title=${`${label}: ${percent}%`}
        aria-label=${`${label}: ${percent}%${max === 10 ? ` (${value}/10)` : ""}`}
      >
        ${
          kind === "viewer"
            ? html`<svg
                class="score-ring"
                viewBox="0 0 48 48"
                aria-hidden="true"
              >
                <circle cx="24" cy="24" r="23" fill="#081c22" />
                <circle
                  cx="24"
                  cy="24"
                  r="18"
                  fill="none"
                  stroke=${percent >= 70 ? "#204529" : percent >= 40 ? "#423d0f" : "#571435"}
                  stroke-width="3"
                />
                <circle
                  cx="24"
                  cy="24"
                  r="18"
                  fill="none"
                  stroke=${percent >= 70 ? "#21d07a" : percent >= 40 ? "#d2d531" : "#db2360"}
                  stroke-width="3"
                  stroke-linecap="round"
                  pathLength="100"
                  stroke-dasharray=${`${percent} 100`}
                  transform="rotate(-90 24 24)"
                />
                <text x="24" y="29" text-anchor="middle" fill="white">
                  ${percent}
                  <tspan font-size="7" dy="-4">%</tspan>
                </text>
              </svg>`
            : html`<img src=${icon} alt="" width="30" height="30" /><span
                  >${percent}%</span
                >`
        }
      </span>`;
    })}
  </div>`;
}
