# Bundled attribution artwork

`tmdb.svg` is TMDB's approved blue short logo, downloaded from its
[official attribution page](https://www.themoviedb.org/about/logos-attribution)
on 2026-10-30. Colors, proportions and artwork are unchanged. The original asset
is
[available from TMDB](https://www.themoviedb.org/assets/v4/logos/v2/blue_short-8e7b30f73a4020692ccca9c88bafe5dcb6f8a62a4c6bc55cd9ba82bb2cd95f6c.svg).
The logo is TMDB branding, used according to its attribution/branding terms; it
is not project-owned artwork.

The shared credits component bundles it inline so displaying attribution makes
no browser request to a third party. Keep the required attribution notice and
provider link with it. Do not recolor or distort the logo.

`rt-critics-{positive,negative}.svg` and `rt-audience-{positive,negative}.svg`
are Rotten Tomatoes' standard Fresh, Rotten, positive-audience and
negative-audience icons. They were extracted on 2026-10-31 from the score-icon
components used by its
[official ratings guide](https://www.rottentomatoes.com/about), in that page's
[public component bundle](https://www.rottentomatoes.com/assets/pizza-pie/javascripts/bundles/roma/default.45dc58bf8f0.js).
Only static SVG markup is retained; geometry, colors and proportions are
unchanged. These are third-party branding, not project-owned artwork. Use them
with their labelled source scores; do not infer Certified Fresh or Verified Hot
status from a percentage. The standard positive icons apply at 60% and above.

The rating component embeds these assets as local image data URLs. They add no
third-party browser request and contain no executable markup or external links.
TMDB's circular percentage display is a CSS/SVG score visualization; the
separate approved TMDB logo and attribution remain in the metadata credits.
