/** Both Journal editors require exact Library selection for movie changes. */
import { afterEach, expect, it, vi } from "vitest";
import "../src/ui/panel";
import type { KaleidescapePanel } from "../src/ui/panel";
import type { JournalCalendar } from "../src/ui/journal-calendar";
import { FixtureTransport, libraryTitle } from "./fixture";
import { titlePicker } from "./manual-helpers";

let panel: KaleidescapePanel;
afterEach(() => panel?.remove());
const button = (root: ParentNode, text: string) =>
  [...root.querySelectorAll<HTMLButtonElement>("button")].find(
    (node) => node.textContent?.trim() === text,
  )!;

it.each(["list", "calendar"])(
  "requires a Library suggestion and updates the exact movie link from the %s editor",
  async (view) => {
    vi.spyOn(HTMLFormElement.prototype, "reportValidity").mockReturnValue(true);
    const transport = new FixtureTransport();
    transport.options.library_enabled = true;
    transport.journalPreferences.view = view;
    transport.options.fuzzy_search = false;
    transport.libraryTitles[1].year = 2026;
    transport.libraryTitles.push(
      libraryTitle({
        id: "d".repeat(64),
        title: "Midnight at the Observatory",
        year: 1984,
      }),
    );
    // Keep the calendar test independent of the machine's current date.
    const now = new Date();
    for (const row of transport.records) {
      row.started_at = new Date(
        now.getFullYear(),
        now.getMonth(),
        10,
        18,
      ).toISOString();
      row.ended_at = new Date(
        now.getFullYear(),
        now.getMonth(),
        10,
        20,
      ).toISOString();
    }
    panel = document.createElement("kaleidescape-panel") as KaleidescapePanel;
    panel.client = transport.client();
    document.body.append(panel);
    const root = panel.shadowRoot!;
    if (view === "calendar") {
      await vi.waitFor(() =>
        expect(
          root.querySelector("kaleidescape-journal-calendar"),
        ).not.toBeNull(),
      );
      const calendar = root.querySelector(
        "kaleidescape-journal-calendar",
      ) as JournalCalendar;
      await vi.waitFor(() =>
        expect(calendar.shadowRoot!.querySelector(".poster")).not.toBeNull(),
      );
      calendar.shadowRoot!.querySelector<HTMLButtonElement>(".poster")!.click();
      await vi.waitFor(() =>
        expect(button(calendar.shadowRoot!, "Edit viewing")?.disabled).toBe(
          false,
        ),
      );
      button(calendar.shadowRoot!, "Edit viewing").click();
    } else {
      await vi.waitFor(() =>
        expect(button(root, "The Lantern Voyage")).toBeDefined(),
      );
      button(root, "The Lantern Voyage").click();
      await vi.waitFor(() =>
        expect(button(root, "Edit viewing")).toBeDefined(),
      );
      button(root, "Edit viewing").click();
    }
    const editor = root.querySelector<HTMLDialogElement>("#journal-editor")!;
    await vi.waitFor(() => expect(editor.open).toBe(true));
    const picker = titlePicker(editor);
    await vi.waitFor(() =>
      expect(picker.querySelector("input")).not.toBeNull(),
    );
    const input = picker.querySelector<HTMLInputElement>("input")!;
    expect(input.value).toBe("The Lantern Voyage");
    expect(editor.querySelector('[name="title"]')).toBeNull();
    const before = structuredClone(transport.records[0]);
    function search(value: string) {
      input.value = value;
      input.dispatchEvent(new Event("input"));
    }
    function save() {
      editor
        .querySelector("form")!
        .dispatchEvent(new Event("submit", { cancelable: true }));
    }
    search("An invented movie");
    save();
    await vi.waitFor(() =>
      expect(editor.textContent).toContain("Select a Library movie"),
    );
    expect(
      transport.calls.some((call) => call.type.endsWith("journal/update")),
    ).toBe(false);
    search("Midnight");
    await vi.waitFor(() =>
      expect(picker.querySelector('[role="option"]')).not.toBeNull(),
    );
    expect(picker.textContent).toContain("Midnight at the Observatory");
    const suggestions = [
      ...picker.querySelectorAll<HTMLButtonElement>('[role="option"]'),
    ];
    expect(suggestions).toHaveLength(2);
    const suggestion = suggestions.find((option) =>
      option.textContent?.includes("2026"),
    )!;
    const touch = new PointerEvent("pointerdown", {
      pointerType: "touch",
      cancelable: true,
    });
    suggestion.dispatchEvent(touch);
    // Keep the picker open until selection, including touch/pen focus changes.
    expect(touch.defaultPrevented).toBe(true);
    suggestion.click();
    save();
    await vi.waitFor(() => expect(root.textContent).toContain("Entry saved."));
    const update = transport.calls.find((call) =>
      call.type.endsWith("journal/update"),
    )!;
    expect(update.patch).toEqual({
      library_title_id: transport.libraryTitles[1].id,
    });
    expect(transport.records[0].title).toBe("Midnight at the Observatory");
    expect(transport.viewingLinks.get(before.id)).toBe(
      transport.libraryTitles[1].id,
    );
    for (const key of [
      "started_at",
      "ended_at",
      "duration_seconds",
      "watched_seconds",
      "raw_content_id",
      "source_id",
    ] as const)
      expect(transport.records[0][key]).toBe(before[key]);
  },
);
