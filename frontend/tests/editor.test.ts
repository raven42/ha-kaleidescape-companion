import { expect, it } from "vitest";
import { changeDraft, draftFrom } from "../src/ui/editor";
import { record } from "./fixture";

it("moves end with start across dates while keeping elapsed time", () => {
  const draft = {
    ...draftFrom(record()),
    started_at: "2026-10-15T13:00:00",
    ended_at: "2026-10-15T15:00:00",
  };
  const shifted = changeDraft(draft, "started_at", "2026-10-12T19:00:00");
  expect(shifted.ended_at).toBe("2026-10-12T21:00:00");
  const extended = changeDraft(shifted, "ended_at", "2026-10-12T22:00:00");
  expect(extended.started_at).toBe(shifted.started_at);
  expect(
    changeDraft(extended, "started_at", "2026-10-11T19:00:00").ended_at,
  ).toBe("2026-10-11T22:00:00");
});
it("keeps an open end empty and recovers after temporarily clearing start", () => {
  const anchor = {
    ...draftFrom(record()),
    started_at: "2026-10-15T13:00:00",
    ended_at: "2026-10-15T15:00:00",
  };
  const empty = changeDraft(anchor, "started_at", "");
  expect(empty.ended_at).toBe(anchor.ended_at);
  expect(
    changeDraft(empty, "started_at", "2026-10-12T19:00:00", anchor).ended_at,
  ).toBe("2026-10-12T21:00:00");
  expect(
    changeDraft(
      { ...anchor, ended_at: "" },
      "started_at",
      "2026-10-12T19:00:00",
    ).ended_at,
  ).toBe("");
});
