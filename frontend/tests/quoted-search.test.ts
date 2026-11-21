import { expect, it } from "vitest";
import { matches } from "../src/core/search";

it.each([false, true])(
  "quoted phrases require whole words regardless of fuzzy mode (%s)",
  (fuzzy) => {
    expect(matches("Tom Hollander", '"Tom Holland"', fuzzy)).toBe(false);
    expect(
      matches("Cast: Tom Holland, Other Actor", '"tom holland"', fuzzy),
    ).toBe(true);
    expect(matches("Tom Hollander", "Tom Holland", fuzzy)).toBe(true);
    expect(matches("Tom Holland", '"Tom Hollan"', fuzzy)).toBe(false);
    expect(matches("A [Literal] Title", '"[Literal]"', fuzzy)).toBe(true);
    expect(matches("anything", '""', fuzzy)).toBe(false);
    expect(
      matches(
        'Alex "Example" Person',
        JSON.stringify('Alex "Example" Person'),
        fuzzy,
      ),
    ).toBe(true);
  },
);

it.each([false, true])(
  "folds accents in literal and quoted searches (%s)",
  (fuzzy) => {
    expect(matches("Amélie", "amelie", fuzzy)).toBe(true);
    expect(matches("Señor Østergård", '"senor ostergard"', fuzzy)).toBe(true);
    expect(matches("Æther and Łódź", "aether and lodz", fuzzy)).toBe(true);
    expect(matches("Amélie Again", '"amelie"', fuzzy)).toBe(true);
    expect(matches("Amélies", '"amelie"', fuzzy)).toBe(false);
  },
);
