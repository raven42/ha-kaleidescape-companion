import { afterEach, expect, it, vi } from "vitest";
import {
  manualData,
  manualDraft,
  ManualViewingFields,
} from "../src/ui/manual-viewing";
import { FixtureTransport, info, libraryTitle } from "./fixture";
import type { LibraryTitle } from "../src/core/api";
import { selectManual } from "./manual-helpers";
let host: HTMLElement | undefined;
afterEach(() => {
  host?.remove();
  host = undefined;
});
it("accepts convenient text times and sends only exact selection and partial watched time", () => {
  const draft = {
    ...manualDraft(),
    library_title_id: "a".repeat(64),
    date: "2026-10-29",
  };
  expect(draft.status).toBe("completed");
  expect(manualData({ ...draft, time: "7:30 PM" })).toEqual(
    manualData({ ...draft, time: "19:30" }),
  );
  expect(manualData({ ...draft, time: "1930" })).toEqual(
    manualData({ ...draft, time: "19:30" }),
  );
  expect(manualData({ ...draft, time: "12 AM" }).started_at).not.toEqual(
    manualData({ ...draft, time: "12 PM" }).started_at,
  );
  expect(manualData(draft)).not.toHaveProperty("duration_seconds");
  expect(manualData(draft)).not.toHaveProperty("ended_at");
  expect(manualData(draft)).not.toHaveProperty("title");
  expect(
    manualData({ ...draft, status: "partial", watched_minutes: "12.34" })
      .watched_seconds,
  ).toBeCloseTo(740.4);
  for (const time of ["25:00", "00 PM", "9:99", "garbage"])
    expect(() => manualData({ ...draft, time })).toThrow();
  expect(() => manualData({ ...draft, date: "2026-02-30" })).toThrow();
  expect(() => manualData({ ...draft, library_title_id: "invented" })).toThrow(
    "suggestions",
  );
  expect(() =>
    manualData({ ...draft, status: "partial", watched_minutes: "" }),
  ).toThrow("positive");
});
it("selects exact versions, exposes partial minutes conditionally and clears selection on title edits", async () => {
  host = document.createElement("div");
  const root = host.attachShadow({ mode: "open" });
  const fields = document.createElement(
    "kaleidescape-manual-viewing",
  ) as ManualViewingFields;
  const transport = new FixtureTransport();
  fields.client = transport.client();
  fields.scope = info;
  fields.addEventListener("draft-change", (event) => {
    fields.draft = (event as CustomEvent).detail;
  });
  root.append(fields);
  document.body.append(host);
  await selectManual(root, transport, "Fictional Version");
  expect(fields.draft.library_title_id).toBe("a".repeat(64));
  expect(
    fields
      .shadowRoot!.querySelector('[name="viewing_time"]')!
      .getAttribute("type"),
  ).toBe("text");
  expect(
    fields.shadowRoot!.querySelector('[name="watched_minutes"]'),
  ).toBeNull();
  const status = fields.shadowRoot!.querySelector<HTMLSelectElement>("select")!;
  status.value = "partial";
  status.dispatchEvent(new Event("change"));
  await fields.updateComplete;
  expect(
    fields.shadowRoot!.querySelector('[name="watched_minutes"]'),
  ).toBeTruthy();
  const input = fields.shadowRoot!.querySelector<HTMLInputElement>(
    '[name="library_movie"]',
  )!;
  input.value = "Changed";
  input.dispatchEvent(new Event("input"));
  await fields.updateComplete;
  expect(fields.draft.library_title_id).toBe("");
  fields.remove();
});
it("ignores late title suggestions after unmount and disallows versions without runtime", async () => {
  const fields = document.createElement(
    "kaleidescape-manual-viewing",
  ) as ManualViewingFields;
  host = fields;
  const transport = new FixtureTransport();
  transport.libraryTitles = [libraryTitle({ duration_seconds: null })];
  fields.client = transport.client();
  fields.scope = info;
  document.body.append(fields);
  await fields.updateComplete;
  const input = fields.shadowRoot!.querySelector<HTMLInputElement>("input")!;
  input.value = "Voyage";
  input.dispatchEvent(new Event("input"));
  await vi.waitFor(() =>
    expect(
      fields.shadowRoot!.querySelector<HTMLButtonElement>('[role="option"]')
        ?.disabled,
    ).toBe(true),
  );
  let resolve:
    ((value: { items: LibraryTitle[]; has_more: boolean }) => void) | undefined;
  const pending = vi
    .spyOn(fields.client, "librarySearch")
    .mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
  input.dispatchEvent(new Event("input"));
  await vi.waitFor(() => expect(pending).toHaveBeenCalled());
  fields.remove();
  resolve!({
    items: [libraryTitle({ title: "Late private title" })],
    has_more: false,
  });
  await fields.updateComplete;
  expect(fields.shadowRoot!.textContent).not.toContain("Late private title");
});
