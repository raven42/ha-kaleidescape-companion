/** Form conversion preserves untouched observed fields and opaque source IDs. */
import type { Viewing, ViewingData } from "./api";

export interface Draft {
  title: string;
  started_at: string;
  ended_at: string;
  duration_seconds: string;
  watched_seconds: string;
  status: "partial" | "completed";
  notes: string;
  source_id: string;
  player_id: string;
  raw_content_id: string;
}
export function localDate(value: string): string {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 23);
}
export function draftFrom(record?: Viewing): Draft {
  return {
    title: record?.title ?? "",
    started_at: localDate(record?.started_at ?? new Date().toISOString()),
    ended_at: record?.ended_at ? localDate(record.ended_at) : "",
    duration_seconds:
      record?.duration_seconds == null
        ? ""
        : String(record.duration_seconds / 60),
    watched_seconds: String((record?.watched_seconds ?? 0) / 60),
    status: record?.status ?? "partial",
    notes: record?.notes ?? "",
    source_id: record?.source_id ?? "",
    player_id: record?.player_id ?? "",
    raw_content_id: record?.raw_content_id ?? "",
  };
}
export function draftData(
  draft: Draft,
  original?: Draft,
): Partial<ViewingData> {
  const result: Record<string, unknown> = {};
  for (const [field, value] of Object.entries(draft)) {
    // Do not lock an observed field just because the form displays it.
    if (original && value === original[field as keyof Draft]) continue;
    if (field === "started_at" || field === "ended_at") {
      result[field] = value ? new Date(value).toISOString() : null;
    } else if (field === "duration_seconds" || field === "watched_seconds") {
      result[field] = value === "" ? null : Number(value) * 60;
    } else if (["source_id", "player_id", "raw_content_id"].includes(field)) {
      result[field] = value === "" ? null : value;
    } else {
      result[field] = value;
    }
  }
  return result;
}
