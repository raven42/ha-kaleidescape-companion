/** Expanded provider details stay compact until requested; all values remain text. */
import { html, nothing } from "lit";
import type { TemplateResult } from "lit";
import type { LibraryTitle } from "../core/api";
import { counted } from "../core/text";
import { tmdbCredits } from "./credits";

export function metadataDetails(
  row: LibraryTitle,
  personLink: (name: string) => TemplateResult,
) {
  const extra = [
    ["Full cast", row.actors.length > 8 ? row.actors : []],
    ["Writers", row.writers],
    ["Producers", row.producers ?? []],
    ["Studios", row.studios],
  ] as [string, string[]][];
  return html`${
    extra.some(([, values]) => values?.length)
      ? html`<details class="extra-credits">
          <summary>More credits</summary>
          <dl class="movie-credits">
            ${extra.map(([label, values]) =>
              values?.length
                ? html`<div>
                    <dt>${label}</dt>
                    <dd>
                      ${values.map((name, index) => html`${index ? ", " : ""}${personLink(name)}`)}
                    </dd>
                  </div>`
                : nothing,
            )}
          </dl>
        </details>`
      : nothing
  }
  ${
    row.enrichment && Object.keys(row.enrichment).length
      ? html`<details class="metadata-scores">
          <summary>Ratings and metadata sources</summary>
          ${Object.entries(row.enrichment).map(([provider, item]) => html`<p class="muted">${provider === "tmdb" ? "TMDB" : "Kaleidescape store"}${item.critic_score != null ? html` · Rotten Tomatoes critics ${item.critic_score}%` : nothing}${item.audience_score != null ? html` · Rotten Tomatoes audience ${item.audience_score}%` : nothing}${item.audience_rating != null ? html` · TMDB audience ${item.audience_rating}/10 (${counted(item.audience_votes ?? 0, "vote")})` : nothing}${item.distributor ? html` · Distributor: ${item.distributor}` : nothing}</p>`)}
          ${row.enrichment.tmdb ? tmdbCredits() : nothing}
        </details>`
      : nothing
  }`;
}
