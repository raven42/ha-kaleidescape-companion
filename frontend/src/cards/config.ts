/** Bounded card layout configuration; no tokens, hosts or service names. */
import type { DashboardLibrary } from "../library/library";
export const CARD_KINDS = [
  "remote",
  "now-playing",
  "library-covers",
  "library-search",
  "library",
  "journal-calendar",
] as const;
export type CardKind = (typeof CARD_KINDS)[number];
export interface CardConfig extends DashboardLibrary {
  type: string;
  title: string;
  entry_id: string;
  player_id: string;
  channel: string;
  show_controls: boolean;
  calendar_size: number;
  calendar_fit: boolean;
}
export function cardConfig(
  value: Record<string, unknown>,
  kind: CardKind,
): CardConfig {
  const result = {
    title: "",
    entry_id: "",
    player_id: "",
    channel: "main",
    columns: 5,
    page_size: 25,
    view: "covers",
    search_position: kind === "library-covers" ? "off" : "top",
    show_filters: kind !== "library-covers",
    show_sort: kind !== "library-covers",
    show_stats: kind !== "library-covers",
    show_titles: true,
    show_format: true,
    show_audio_format:
      typeof value.show_format === "boolean" ? value.show_format : true,
    show_badges: true,
    show_rating: false,
    show_controls: true,
    calendar_size: 100,
    calendar_fit: false,
    ...value,
  } as CardConfig;
  for (const key of [
    "title",
    "entry_id",
    "player_id",
    "channel",
    "type",
  ] as const)
    if (
      typeof result[key] !== "string" ||
      result[key].length > (key === "title" ? 200 : 128)
    )
      throw new Error(`Invalid ${key}`);
  for (const [key, min, max] of [
    ["columns", 1, 20],
    ["page_size", 1, 1000],
    ["calendar_size", 60, 320],
  ] as const)
    if (
      !Number.isInteger(result[key]) ||
      result[key] < min ||
      result[key] > max
    )
      throw new Error(`${key} must be between ${min} and ${max}`);
  for (const key of [
    "show_filters",
    "show_sort",
    "show_stats",
    "show_titles",
    "show_format",
    "show_audio_format",
    "show_badges",
    "show_rating",
    "show_controls",
    "calendar_fit",
  ] as const)
    if (typeof result[key] !== "boolean") throw new Error(`Invalid ${key}`);
  if (
    !["top", "bottom", "off"].includes(result.search_position) ||
    !["covers", "list"].includes(result.view)
  )
    throw new Error("Invalid Library layout");
  if (kind === "library-covers")
    Object.assign(result, {
      view: "covers",
      search_position: "off",
      show_filters: false,
      show_sort: false,
    });
  return result;
}
export function cardForm(kind: CardKind) {
  const text = (name: string) => ({ name, selector: { text: {} } });
  const toggle = (name: string) => ({ name, selector: { boolean: {} } });
  const number = (name: string, min: number, max: number) => ({
    name,
    selector: { number: { min, max, step: 1, mode: "box" } },
  });
  const library = kind === "library" || kind === "library-covers";
  const defaults = cardConfig(
    { type: `custom:kaleidescape-${kind}-card` },
    kind,
  );
  return {
    schema: [
      text("title"),
      text("entry_id"),
      ...(kind === "remote" || kind === "now-playing"
        ? [text("player_id")]
        : []),
      ...(kind === "now-playing" ? [toggle("show_controls")] : []),
      ...(library || kind === "library-search" ? [text("channel")] : []),
      ...(library
        ? [
            number("columns", 1, 20),
            number("page_size", 1, 1000),
            ...[
              "show_titles",
              "show_format",
              "show_audio_format",
              "show_badges",
              "show_rating",
              "show_stats",
            ].map(toggle),
          ]
        : []),
      ...(kind === "library"
        ? [
            {
              name: "search_position",
              selector: { select: { options: ["top", "bottom", "off"] } },
            },
            {
              name: "view",
              selector: { select: { options: ["covers", "list"] } },
            },
            toggle("show_filters"),
            toggle("show_sort"),
          ]
        : []),
      ...(kind === "journal-calendar"
        ? [
            number("calendar_size", 60, 320),
            toggle("calendar_fit"),
            text("channel"),
          ]
        : []),
    ].map((field) => ({
      ...field,
      default: defaults[field.name as keyof CardConfig],
    })),
    computeLabel: (field: { name: string }) =>
      field.name === "show_format"
        ? "Show video format badges"
        : field.name === "show_audio_format"
          ? "Show audio format badges"
          : field.name
              .replaceAll("_", " ")
              .replace(/^./, (char) => char.toUpperCase()),
    computeHelper: (field: { name: string }) =>
      field.name === "entry_id"
        ? "Leave blank for the loaded Companion integration."
        : field.name === "channel"
          ? "Search and Library cards with the same channel work together on this dashboard."
          : undefined,
  };
}
