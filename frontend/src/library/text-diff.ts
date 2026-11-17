/** A bounded word-level diff. Lit renders every segment as text, never HTML. */
export function textDiff(original: string, current: string) {
  const tokenize = (text: string) =>
    text.match(/\s+|[\p{L}\p{N}_]+|[^\s\p{L}\p{N}_]/gu) ?? [];
  const left = tokenize(original);
  const right = tokenize(current);
  const a: { text: string; changed: boolean }[] = [];
  const b: { text: string; changed: boolean }[] = [];
  const add = (out: typeof a, text: string, changed: boolean) => {
    const last = out.at(-1);
    if (last && last.changed === changed) last.text += text;
    else out.push({ text, changed });
  };
  // Bound the LCS matrix for unusually large synopses and credit lists.
  if (left.length * right.length > 250_000) {
    let start = 0;
    while (
      start < original.length &&
      start < current.length &&
      original[start] === current[start]
    )
      start++;
    let end = 0;
    while (
      end < original.length - start &&
      end < current.length - start &&
      original[original.length - end - 1] === current[current.length - end - 1]
    )
      end++;
    for (const [out, value] of [
      [a, original],
      [b, current],
    ] as const) {
      add(out, value.slice(0, start), false);
      add(out, value.slice(start, value.length - end), true);
      if (end) add(out, value.slice(-end), false);
    }
    return { original: a, current: b };
  }
  const width = right.length + 1;
  const table = new Uint32Array((left.length + 1) * width);
  for (let i = left.length - 1; i >= 0; i--)
    for (let j = right.length - 1; j >= 0; j--)
      table[i * width + j] =
        left[i] === right[j]
          ? table[(i + 1) * width + j + 1] + 1
          : Math.max(table[(i + 1) * width + j], table[i * width + j + 1]);
  let i = 0,
    j = 0;
  while (i < left.length || j < right.length) {
    if (i < left.length && j < right.length && left[i] === right[j]) {
      add(a, left[i++], false);
      add(b, right[j++], false);
    } else if (
      i < left.length &&
      (j === right.length ||
        table[(i + 1) * width + j] >= table[i * width + j + 1])
    )
      add(a, left[i++], true);
    else add(b, right[j++], true);
  }
  return { original: a, current: b };
}
