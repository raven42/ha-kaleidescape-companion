/** Approved, locally bundled provider attribution, shared by all account views. */
import { html } from "lit";
import tmdbLogo from "../ui/assets/tmdb.svg?inline";

export function tmdbCredits() {
  return html`<a
      href="https://www.themoviedb.org"
      target="_blank"
      rel="noopener noreferrer"
      ><img src=${tmdbLogo} alt="TMDB" width="100"
    /></a>
    <p class="muted">
      This product uses the TMDB API but is not endorsed or certified by TMDB.
    </p>`;
}
