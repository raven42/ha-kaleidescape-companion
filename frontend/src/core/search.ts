/** Same bounded word edits as the worker; literal matching never expands patterns. */
const latinEquivalents: Record<string, string> = {
  æ: "ae",
  œ: "oe",
  ø: "o",
  ł: "l",
  đ: "d",
  ð: "d",
  þ: "th",
  ħ: "h",
  ı: "i",
  ß: "ss",
  ς: "σ",
};

export function foldSearch(value: string) {
  return value
    .toLowerCase()
    .replace(/[æœøłđðþħıßς]/gu, (char) => latinEquivalents[char])
    .normalize("NFKD")
    .replace(/\p{M}/gu, "");
}
function normalized(value: string) {
  return (
    foldSearch(value)
      .match(/[\p{L}\p{N}_]+/gu)
      ?.join(" ") ?? ""
  );
}
function closeWord(left: string, right: string) {
  const allowance = Math.min(2, Math.max(1, Math.ceil(left.length / 4)));
  if (
    left.length < 3 ||
    Math.max(left.length, right.length) > 100 ||
    Math.abs(left.length - right.length) > allowance
  )
    return false;
  let previous = Array.from({ length: right.length + 1 }, (_, i) => i),
    older = previous;
  for (let i = 1; i <= left.length; i++) {
    const current = Array<number>(right.length + 1).fill(allowance + 1);
    current[0] = i;
    for (
      let j = Math.max(1, i - allowance);
      j <= Math.min(right.length, i + allowance);
      j++
    ) {
      let value = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + Number(left[i - 1] !== right[j - 1]),
      );
      if (
        i > 1 &&
        j > 1 &&
        left[i - 1] === right[j - 2] &&
        left[i - 2] === right[j - 1]
      )
        value = Math.min(value, older[j - 2] + 1);
      current[j] = value;
    }
    if (Math.min(...current) > allowance) return false;
    older = previous;
    previous = current;
  }
  return previous[right.length] <= allowance;
}
export function matches(value: string, query: string, fuzzy = false) {
  const trimmed = query.trim();
  if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) {
    let phrase: string;
    try {
      phrase = (JSON.parse(trimmed) as string).trim();
    } catch {
      phrase = trimmed.slice(1, -1).trim();
    }
    if (!phrase) return false;
    const words = foldSearch(phrase)
      .split(/\s+/)
      .map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    return new RegExp(
      "(?<![\\p{L}\\p{N}_])" + words.join("\\s+") + "(?![\\p{L}\\p{N}_])",
      "u",
    ).test(foldSearch(value));
  }
  if (foldSearch(value).includes(foldSearch(query))) return true;
  if (!fuzzy) return false;
  const needle = normalized(query),
    name = normalized(value);
  if (!needle) return false;
  if (name.includes(needle)) return true;
  const tokens = needle.split(" "),
    words = name.split(" ");
  return (
    tokens.length <= 12 &&
    tokens.every((token) =>
      words.some((word) => word.includes(token) || closeWord(token, word)),
    )
  );
}
