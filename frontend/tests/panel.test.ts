import { modalClose } from "./dialog-helpers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../src/ui/panel";
import type { KaleidescapePanel } from "../src/ui/panel";
import { ApiError } from "../src/core/api";
import type { ApiMessage, Hass, Viewing } from "../src/core/api";
import { draftData, draftFrom } from "../src/ui/editor";
import { FixtureTransport, info, record } from "./fixture";
import { selectManual, titlePicker } from "./manual-helpers";

let panel: KaleidescapePanel;
let transport: FixtureTransport;
async function settle() {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await panel.updateComplete;
}
async function waitFor(text: string) {
  await vi.waitFor(() => expect(panel.shadowRoot!.textContent).toContain(text));
}
function button(text: string): HTMLButtonElement {
  const element = [...panel.shadowRoot!.querySelectorAll("button")].find(
    (item) => item.textContent?.trim() === text,
  );
  expect(element, `button ${text}`).toBeTruthy();
  return element!;
}
function page(
  id: "now-playing" | "journal" | "library" | "database" | "settings",
) {
  panel.shadowRoot!.querySelector<HTMLButtonElement>(`#page-${id}`)!.click();
}
function input(name: string, value: string) {
  const element = panel.shadowRoot!.querySelector<HTMLInputElement>(
    `[name="${name}"]`,
  )!;
  element.value = value;
  element.dispatchEvent(new Event("input", { bubbles: true }));
}
async function selectViewing(title = "The Lantern Voyage", editing = true) {
  button(title).click();
  await vi.waitFor(() =>
    expect(
      panel.shadowRoot!.querySelector(".entries-detail .journal-title")
        ?.textContent,
    ).toBe(title),
  );
  if (editing) {
    button("Edit viewing").click();
    await vi.waitFor(() =>
      expect(
        panel.shadowRoot!.querySelector<HTMLDialogElement>("#journal-editor")
          ?.open,
      ).toBe(true),
    );
  }
}
async function save() {
  panel
    .shadowRoot!.querySelector("form.editor")!
    .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  await settle();
}
beforeEach(async () => {
  // happy-dom uses exact floating-point modulo for number steps (110 % .01),
  // unlike browser constraint validation. Native widget validation is operator QA.
  vi.spyOn(HTMLFormElement.prototype, "reportValidity").mockReturnValue(true);
  transport = new FixtureTransport();
  panel = document.createElement("kaleidescape-panel") as KaleidescapePanel;
  panel.client = transport.client();
  document.body.append(panel);
  window.confirm = vi.fn(() => true);
  await waitFor("The Lantern Voyage");
});
afterEach(() => {
  panel.remove();
  vi.useRealTimers();
});

it("shows the loaded pyk version in About settings", async () => {
  page("settings");
  await settle();
  const settings = panel.shadowRoot!.querySelector("kaleidescape-settings")!;
  await vi.waitFor(() =>
    expect(settings.shadowRoot!.textContent).toContain(
      "pykaleidescape version",
    ),
  );
  settings
    .shadowRoot!.querySelector<HTMLButtonElement>("#settings-tab-about")!
    .click();
  const section =
    settings.shadowRoot!.querySelector<HTMLElement>("#settings-about")!;
  await vi.waitFor(() => expect(section.hidden).toBe(false));
  expect(section.textContent).toContain("1.1.6");
});

describe("journal management", () => {
  it("uses one split surface and keeps viewing details read-only until Edit", async () => {
    await selectViewing("The Lantern Voyage", false);
    const root = panel.shadowRoot!;
    expect(
      root.querySelector(".journal .entries-layout .entries-list"),
    ).not.toBeNull();
    expect(
      root.querySelector(".journal .entries-layout .entries-detail"),
    ).not.toBeNull();
    expect(root.querySelector(".metrics")).toBeNull();
    expect(root.querySelector("form.editor")).toBeNull();
    expect(root.querySelector<HTMLDialogElement>("#journal-editor")!.open).toBe(
      false,
    );
    button("Edit viewing").click();
    await settle();
    expect(root.querySelector<HTMLDialogElement>("#journal-editor")!.open).toBe(
      true,
    );
    modalClose(panel.shadowRoot!).click();
    await settle();
    expect(
      root.querySelector(".entries-detail .journal-title")?.textContent,
    ).toBe("The Lantern Voyage");
    expect(root.querySelector("form.editor")).toBeNull();
  });
  it("guards Escape dismissal of a dirty journal dialog", async () => {
    await selectViewing();
    input("notes", "Unsaved correction");
    await settle();
    vi.mocked(window.confirm).mockReturnValue(false);
    const dialog =
      panel.shadowRoot!.querySelector<HTMLDialogElement>("#journal-editor")!;
    dialog.dispatchEvent(new Event("cancel", { cancelable: true }));
    expect(dialog.open).toBe(true);
    expect(
      panel.shadowRoot!.querySelector<HTMLTextAreaElement>("textarea")!.value,
    ).toBe("Unsaved correction");
    vi.mocked(window.confirm).mockReturnValue(true);
    dialog.dispatchEvent(new Event("cancel", { cancelable: true }));
    await settle();
    expect(dialog.open).toBe(false);
    expect(
      transport.calls.some((call) => call.type.endsWith("journal/update")),
    ).toBe(false);
  });
  it("loads the scoped list and saves only changed observed fields", async () => {
    await selectViewing();
    input("notes", "A correction only");
    await save();
    await waitFor("Entry saved.");
    const update = transport.calls.find((call) =>
      call.type.endsWith("/journal/update"),
    )!;
    expect(update.patch).toEqual({ notes: "A correction only" });
    expect(update.expected_revision).toBe(2);
    expect(update.dataset_id).toBe(info.dataset_id);
    expect(update).not.toHaveProperty("api_version");
    expect(transport.records[0].watched_seconds).toBe(6600);
  });
  it("creates a manual entry and requires explicit deletion confirmation", async () => {
    button("＋ Add viewing").click();
    await settle();
    await selectManual(panel.shadowRoot!, transport, "A fictional new entry");
    await save();
    await waitFor("Entry saved.");
    expect(transport.records).toHaveLength(4);
    button("Delete entry").click();
    await settle();
    expect(
      transport.calls.some((call) => call.type.endsWith("/journal/delete")),
    ).toBe(false);
    expect(panel.shadowRoot!.textContent!.replace(/\s+/g, " ")).toContain(
      "does not permanently erase",
    );
    button("Confirm deletion").click();
    await waitFor("Entry removed");
    expect(transport.records).toHaveLength(3);
  });
  it("confirms deletion without randomUUID and ignores a duplicate confirmation click", async () => {
    const getRandomValues = crypto.getRandomValues.bind(crypto);
    vi.stubGlobal("crypto", { getRandomValues });
    try {
      await selectViewing();
      button("Delete entry").click();
      await settle();
      const confirm = button("Confirm deletion");
      confirm.click();
      confirm.click();
      await waitFor("Entry removed");
      expect(transport.records).toHaveLength(2);
      const calls = transport.calls.filter((call) =>
        call.type.endsWith("/journal/delete"),
      );
      expect(calls).toHaveLength(1);
      expect(calls[0].request_id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it("shows a deletion preparation failure without sending or locking the entry", async () => {
    await selectViewing();
    button("Delete entry").click();
    await settle();
    vi.stubGlobal("crypto", undefined);
    try {
      button("Confirm deletion").click();
      await waitFor("No change was sent");
      expect(
        transport.calls.some((call) => call.type.endsWith("/journal/delete")),
      ).toBe(false);
      expect(transport.records).toHaveLength(3);
      expect(panel.shadowRoot!.querySelector("fieldset")!.disabled).toBe(false);
    } finally {
      vi.unstubAllGlobals();
    }
    button("Confirm deletion").click();
    await waitFor("Entry removed");
    expect(transport.records).toHaveLength(2);
  });
  it("reports missing secure randomness when saving without mislabeling the form values", async () => {
    button("＋ Add viewing").click();
    await settle();
    await selectManual(panel.shadowRoot!, transport, "Valid fictional entry");
    vi.stubGlobal("crypto", undefined);
    try {
      await save();
      await waitFor("No change was sent");
      expect(
        transport.calls.some((call) => call.type.endsWith("/journal/create")),
      ).toBe(false);
      expect(panel.shadowRoot!.textContent).not.toContain("Check the dates");
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it("retries an uncertain deletion with its original request UUID and payload", async () => {
    const getRandomValues = crypto.getRandomValues.bind(crypto);
    vi.stubGlobal("crypto", { getRandomValues });
    try {
      const original = transport.callWS.bind(transport);
      let interrupt = true;
      vi.spyOn(transport, "callWS").mockImplementation(
        async <T>(message: ApiMessage) => {
          const result = await original<T>(message);
          if (interrupt && message.type.endsWith("/journal/delete")) {
            interrupt = false;
            throw new ApiError("connection_lost");
          }
          return result;
        },
      );
      await selectViewing();
      button("Delete entry").click();
      await settle();
      button("Confirm deletion").click();
      await waitFor("Retry same change");
      expect(transport.records).toHaveLength(2);
      button("Retry same change").click();
      await waitFor("Entry removed");
      const calls = transport.calls.filter((call) =>
        call.type.endsWith("/journal/delete"),
      );
      expect(calls).toHaveLength(2);
      expect(calls[0]).toEqual(calls[1]);
      expect(transport.records).toHaveLength(2);
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it("preserves a conflict draft and never silently overwrites a newer record", async () => {
    await selectViewing();
    input("notes", "Keep my draft");
    transport.records[0].revision++;
    await save();
    await waitFor("changed elsewhere");
    expect(
      panel.shadowRoot!.querySelector<HTMLTextAreaElement>("textarea")!.value,
    ).toBe("Keep my draft");
    expect(transport.records[0].notes).not.toBe("Keep my draft");
    button("Reload entry").click();
    await settle();
    expect(window.confirm).toHaveBeenCalled();
    expect(
      panel.shadowRoot!.querySelector<HTMLTextAreaElement>("textarea")!.value,
    ).toBe(transport.records[0].notes);
  });
  it.each(["connection_lost", "not_ready", "storage_error", "unknown_error"])(
    "retries an uncertain committed write after %s with the same UUID and payload",
    async (code) => {
      const original = transport.callWS.bind(transport);
      let interrupt = true;
      vi.spyOn(transport, "callWS").mockImplementation(
        async <T>(message: ApiMessage) => {
          const result = await original<T>(message);
          if (interrupt && message.type.endsWith("/journal/create")) {
            interrupt = false;
            throw new ApiError(code);
          }
          return result;
        },
      );
      button("＋ Add viewing").click();
      await settle();
      await selectManual(panel.shadowRoot!, transport, "Saved once");
      await save();
      await waitFor("Retry same change");
      expect(
        transport.records.filter((row) => row.title === "Saved once"),
      ).toHaveLength(1);
      expect(panel.shadowRoot!.querySelector("fieldset")!.disabled).toBe(true);
      button("Retry same change").click();
      await waitFor("Entry saved.");
      const requests = transport.calls.filter((call) =>
        call.type.endsWith("/journal/create"),
      );
      expect(requests[0]).toEqual(requests[1]);
      expect(
        transport.records.filter((row) => row.title === "Saved once"),
      ).toHaveLength(1);
    },
  );
  it("renders malicious metadata as text without executing or creating markup", async () => {
    const payload =
      '<img src=x onerror="window.stolen=true"><script>attack()</script>';
    transport.records[0].title = payload;
    button("Refresh").click();
    await waitFor(payload);
    expect(panel.shadowRoot!.querySelectorAll("img")).toHaveLength(1);
    expect(
      panel.shadowRoot!.querySelector("header img.companion-icon"),
    ).not.toBeNull();
    expect(panel.shadowRoot!.querySelector("script,iframe")).toBeNull();
    await selectViewing(payload);
    expect(
      titlePicker(panel.shadowRoot!).querySelector<HTMLInputElement>(
        '[name="library_movie"]',
      )!.value,
    ).toBe(payload);
  });
  it("clears private records and drafts on authorization failure", async () => {
    await selectViewing();
    input("notes", "private draft");
    transport.failure = "unauthorized";
    await save();
    await waitFor("Access to this operation is denied");
    expect(panel.shadowRoot!.textContent).not.toContain("The Lantern Voyage");
    expect(panel.shadowRoot!.querySelector("textarea")).toBeNull();
  });
  it("ignores old detail responses after switching connections", async () => {
    const original = transport.callWS.bind(transport);
    let resolve!: (value: Viewing) => void;
    vi.spyOn(transport, "callWS").mockImplementation(
      <T>(message: ApiMessage): Promise<T> => {
        if (message.type.endsWith("/journal/get"))
          return new Promise((done) => {
            resolve = done as (value: Viewing) => void;
          });
        return original<T>(message);
      },
    );
    button("The Lantern Voyage").click();
    await settle();
    const replacement = new FixtureTransport();
    replacement.records = [record({ title: "Different connection" })];
    panel.client = replacement.client();
    await waitFor("Different connection");
    resolve(record());
    await settle();
    expect(panel.shadowRoot!.textContent).not.toContain("The Lantern Voyage");
    expect(panel.shadowRoot!.querySelector("textarea")).toBeNull();
  });
  it("applies search and pagination through opaque server cursors", async () => {
    const original = transport.callWS.bind(transport);
    vi.spyOn(transport, "callWS").mockImplementation(
      async <T>(message: ApiMessage) => {
        const result = await original<T>(message);
        if (message.type.endsWith("/journal/list") && !message.cursor)
          return { ...result, next_cursor: "opaque-test-cursor" };
        return result;
      },
    );
    button("Refresh").click();
    await settle();
    input("search", "Lantern");
    panel
      .shadowRoot!.querySelector("form.filters")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await settle();
    expect(
      transport.calls
        .filter((call) => call.type.endsWith("/journal/list"))
        .at(-1),
    ).toMatchObject({ query: "Lantern", limit: 25 });
    expect(panel.shadowRoot!.textContent).not.toContain(
      "Midnight at the Observatory",
    );
    button("Next").click();
    await settle();
    expect(transport.calls.at(-1)).toMatchObject({
      cursor: "opaque-test-cursor",
      query: "Lantern",
    });
  });
  it("drops the HA view on role or connection changes without making unauthorized calls", async () => {
    panel.client = undefined;
    const hass: Hass = {
      ...transport,
      user: { id: "test-admin", is_admin: true },
      connection: { connected: true },
      callWS: transport.callWS.bind(transport),
      fetchWithAuth: transport.fetchWithAuth.bind(transport),
    };
    panel.hass = hass;
    await waitFor("The Lantern Voyage");
    const calls = transport.calls.length;
    panel.hass = { ...hass, user: { id: "test-admin", is_admin: false } };
    await settle();
    expect(panel.shadowRoot!.textContent).not.toContain("The Lantern Voyage");
    expect(transport.calls.length).toBeGreaterThan(calls);
    expect(
      panel.shadowRoot!.querySelector("kaleidescape-reader"),
    ).not.toBeNull();
  });
});

it("does not normalize source identifiers or rewrite untouched timestamp precision", () => {
  const original = draftFrom(
    record({
      raw_content_id: "26-0.0-S_exact",
      started_at: "2026-10-24T19:15:00.123456Z",
    }),
  );
  expect(draftData({ ...original, notes: "Changed" }, original)).toEqual({
    notes: "Changed",
  });
  expect(
    draftData({ ...original, raw_content_id: "new-exact-ID" }, original),
  ).toEqual({ raw_content_id: "new-exact-ID" });
});

it("displays whole-second dates and two-decimal minutes without rewriting untouched source precision", async () => {
  const source = record({
    started_at: "2026-10-24T19:15:00.123456Z",
    ended_at: "2026-10-24T21:05:00.654321Z",
    watched_seconds: 115.37234567,
    duration_seconds: 601.234567,
  });
  transport.records[0] = source;
  button("Refresh").click();
  await settle();
  await selectViewing(source.title);
  const start = panel.shadowRoot!.querySelector<HTMLInputElement>(
    '[name="started_at"]',
  )!;
  expect(start.value).not.toContain(".");
  expect(start.step).toBe("1");
  expect(
    panel.shadowRoot!.querySelector<HTMLInputElement>(
      '[name="watched_seconds"]',
    )!.value,
  ).toBe("1.92");
  expect(
    panel.shadowRoot!.querySelector<HTMLInputElement>(
      '[name="duration_seconds"]',
    )!.value,
  ).toBe("10.02");
  input("notes", "Changed only notes");
  await save();
  await waitFor("Entry saved.");
  expect(
    transport.calls.find((call) => call.type.endsWith("/journal/update"))!
      .patch,
  ).toEqual({ notes: "Changed only notes" });
  expect(transport.records[0].started_at).toBe(source.started_at);
  expect(transport.records[0].watched_seconds).toBe(115.37234567);
});

it("keeps unsaved journal and settings changes when a tab switch is cancelled", async () => {
  await selectViewing();
  input("notes", "Keep this draft");
  vi.mocked(window.confirm).mockReturnValue(false);
  page("database");
  await settle();
  expect(
    panel
      .shadowRoot!.querySelector("#page-journal")!
      .getAttribute("aria-selected"),
  ).toBe("true");
  expect(
    panel.shadowRoot!.querySelector<HTMLTextAreaElement>(
      'textarea[name="notes"]',
    )!.value,
  ).toBe("Keep this draft");
  vi.mocked(window.confirm).mockReturnValue(true);
  page("settings");
  await settle();
  const settings = panel.shadowRoot!.querySelector("kaleidescape-settings")!;
  await vi.waitFor(() =>
    expect(
      settings.shadowRoot!.querySelector('[name="minimum_runtime_minutes"]'),
    ).not.toBeNull(),
  );
  const field = settings.shadowRoot!.querySelector<HTMLInputElement>(
    '[name="minimum_runtime_minutes"]',
  )!;
  field.value = "20";
  field.dispatchEvent(new Event("input", { bubbles: true }));
  vi.mocked(window.confirm).mockReturnValue(false);
  page("journal");
  await settle();
  expect(panel.shadowRoot!.querySelector("kaleidescape-settings")).toBe(
    settings,
  );
  expect(field.value).toBe("20");
});

it("navigates the page tabs with arrow keys, Home, and End", async () => {
  const keys = [
    ["End", "settings"],
    ["Home", "now-playing"],
    ["ArrowRight", "journal"],
    ["ArrowLeft", "now-playing"],
  ];
  for (const [key, id] of keys) {
    panel
      .shadowRoot!.querySelector('[role="tablist"]')!
      .dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
    await vi.waitFor(() =>
      expect(
        panel
          .shadowRoot!.querySelector(`#page-${id}`)!
          .getAttribute("aria-selected"),
      ).toBe("true"),
    );
    await settle();
  }
});

it("saves inline settings and returns to the Settings form with persisted values", async () => {
  page("settings");
  await settle();
  const settings = panel.shadowRoot!.querySelector("kaleidescape-settings")!;
  await vi.waitFor(() =>
    expect(
      settings.shadowRoot!.querySelector(
        'input[name="minimum_runtime_minutes"]',
      ),
    ).not.toBeNull(),
  );
  const field = settings.shadowRoot!.querySelector<HTMLInputElement>(
    '[name="minimum_runtime_minutes"]',
  )!;
  field.value = "20";
  field.dispatchEvent(new Event("input", { bubbles: true }));
  vi.spyOn(panel.client!, "info").mockResolvedValueOnce({ entries: [] });
  settings
    .shadowRoot!.querySelector("form")!
    .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  await waitFor("Settings saved.");
  await vi.waitFor(() =>
    expect(
      panel
        .shadowRoot!.querySelector("kaleidescape-settings")!
        .shadowRoot!.querySelector<HTMLInputElement>(
          '[name="minimum_runtime_minutes"]',
        )?.value,
    ).toBe("20"),
  );
  expect(
    panel
      .shadowRoot!.querySelector("#page-settings")!
      .getAttribute("aria-selected"),
  ).toBe("true");
  expect(new URL(location.href).searchParams.get("companion_page")).toBe(
    "settings",
  );
});

it("stops Now Playing polling when leaving its tab", async () => {
  page("now-playing");
  await settle();
  await vi.waitFor(() =>
    expect(
      transport.calls.some((call) => call.type.endsWith("/now_playing")),
    ).toBe(true),
  );
  page("journal");
  await waitFor("The Lantern Voyage");
  const snapshots = transport.calls.filter((call) =>
    call.type.endsWith("/now_playing"),
  ).length;
  vi.useFakeTimers();
  await vi.advanceTimersByTimeAsync(10000);
  expect(
    transport.calls.filter((call) => call.type.endsWith("/now_playing")),
  ).toHaveLength(snapshots);
});

it("does not release a completed export after switching connections", async () => {
  let resolve!: (value: Blob) => void;
  vi.spyOn(panel.client!, "download").mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  const create = vi.fn(() => "blob:fictional");
  const original = URL.createObjectURL;
  URL.createObjectURL = create;
  try {
    page("database");
    await settle();
    const advanced = panel.shadowRoot!.querySelector("kaleidescape-database")!;
    await (advanced as KaleidescapePanel).updateComplete;
    const transfers = advanced.shadowRoot!.querySelector(
      "kaleidescape-transfers",
    )!;
    await (transfers as KaleidescapePanel).updateComplete;
    [...transfers.shadowRoot!.querySelectorAll("button")]
      .find((button) => button.textContent?.trim() === "Export")!
      .click();
    await (transfers as KaleidescapePanel).updateComplete;
    [...transfers.shadowRoot!.querySelectorAll("button")]
      .find((button) => button.textContent?.trim() === "Export JSON")!
      .click();
    await settle();
    panel.client = new FixtureTransport().client();
    await settle();
    resolve(new Blob(["fictional private export"]));
    await settle();
    expect(create).not.toHaveBeenCalled();
  } finally {
    URL.createObjectURL = original;
  }
});

it("requires confirmation to abandon an uncertain retry and inspect existing records", async () => {
  button("＋ Add viewing").click();
  await settle();
  await selectManual(panel.shadowRoot!, transport, "Unconfirmed entry");
  transport.failure = "busy";
  await save();
  await waitFor("Retry same change");
  const writes = transport.calls.filter((call) =>
    call.type.endsWith("/journal/create"),
  ).length;
  transport.failure = null;
  button("Discard retry & inspect journal").click();
  await waitFor("Retry discarded");
  expect(window.confirm).toHaveBeenCalled();
  expect(
    transport.calls.filter((call) => call.type.endsWith("/journal/create")),
  ).toHaveLength(writes);
  expect(panel.shadowRoot!.querySelector("textarea")).toBeNull();
  expect(button("＋ Add viewing").disabled).toBe(false);
});

it("navigates between Journal artwork and exact grouped Library viewing history", async () => {
  transport.options.library_enabled = true;
  const title = transport.libraryTitles[0];
  transport.viewingLinks.set(transport.records[0].id, title.id);
  button("Refresh").click();
  await settle();
  await selectViewing("The Lantern Voyage", false);
  const link = panel.shadowRoot!.querySelector("kaleidescape-viewing-library")!;
  await vi.waitFor(() =>
    expect(link.shadowRoot!.querySelector("button")).not.toBeNull(),
  );
  link.shadowRoot!.querySelector<HTMLButtonElement>("button")!.click();
  await settle();
  const library = panel.shadowRoot!.querySelector("kaleidescape-library")!;
  await vi.waitFor(() =>
    expect(
      library.shadowRoot!.querySelector<HTMLDialogElement>("#title-dialog")
        ?.open,
    ).toBe(true),
  );
  const history = [...library.shadowRoot!.querySelectorAll("button")].find(
    (button) =>
      button.textContent?.trim() === "View journal entries for this movie",
  )!;
  history.click();
  await settle();
  await vi.waitFor(() =>
    expect(
      transport.calls.some(
        (call) =>
          call.type.endsWith("library/viewings") && call.title_id === title.id,
      ),
    ).toBe(true),
  );
  expect(panel.shadowRoot!.textContent).toContain(
    `Viewings for ${title.title}`,
  );
  button("Show all viewings").click();
  await settle();
  expect(panel.shadowRoot!.textContent).not.toContain(
    `Viewings for ${title.title}`,
  );
});

it("enables the Library tab after opting in and clears its content on navigation", async () => {
  transport.options.library_enabled = true;
  button("Refresh").click();
  await settle();
  expect(
    panel.shadowRoot!.querySelector<HTMLButtonElement>("#page-library")!
      .disabled,
  ).toBe(false);
  page("library");
  await settle();
  const library = panel.shadowRoot!.querySelector("kaleidescape-library")!;
  expect(library).not.toBeNull();
  await (library as KaleidescapePanel).updateComplete;
  expect(library.shadowRoot!.textContent).toContain("Voyage to Europa");
  page("journal");
  await settle();
  expect(panel.shadowRoot!.querySelector("kaleidescape-library")).toBeNull();
});

it("applies the Journal fuzzy toggle to search and an already-open New entry picker", async () => {
  const options = panel.shadowRoot!.querySelector(
    "kaleidescape-journal-options",
  )!;
  await (options as unknown as { updateComplete: Promise<unknown> })
    .updateComplete;
  await vi.waitFor(() => expect(button("＋ Add viewing").disabled).toBe(false));
  button("＋ Add viewing").click();
  await settle();
  const manual = panel.shadowRoot!.querySelector(
    "kaleidescape-manual-viewing",
  )!;
  await (manual as unknown as { updateComplete: Promise<unknown> })
    .updateComplete;
  const movie = titlePicker(manual.shadowRoot!).querySelector<HTMLInputElement>(
    '[name="library_movie"]',
  )!;
  movie.value = "Vyoage";
  movie.dispatchEvent(new Event("input"));
  await vi.waitFor(() =>
    expect(
      titlePicker(manual.shadowRoot!).querySelector('[role="option"]'),
    ).toBeTruthy(),
  );
  options.shadowRoot!.querySelector<HTMLInputElement>("input")!.click();
  await settle();
  await vi.waitFor(() =>
    expect(
      transport.calls
        .filter((call) => call.type.endsWith("library/search"))
        .at(-1),
    ).toMatchObject({ query: "Vyoage", fuzzy: false }),
  );
  await vi.waitFor(() =>
    expect(
      titlePicker(manual.shadowRoot!).querySelector('[role="option"]'),
    ).toBeNull(),
  );
  movie.value = "voyage";
  movie.dispatchEvent(new Event("input"));
  await vi.waitFor(() =>
    expect(
      titlePicker(manual.shadowRoot!).querySelector('[role="option"]'),
    ).toBeTruthy(),
  );
  expect(transport.searchPreferences.fuzzy_search).toBe(false);
  expect(
    transport.calls.filter((call) => call.type.endsWith("journal/list")).at(-1)
      ?.fuzzy,
  ).toBe(false);
});

it("shifts the journal editor end when start changes and saves both atomically", async () => {
  await selectViewing();
  input("started_at", "2026-10-15T13:00:00");
  input("ended_at", "2026-10-15T15:00:00");
  input("started_at", "2026-10-12T19:00:00");
  await settle();
  expect(
    panel.shadowRoot!.querySelector<HTMLInputElement>('[name="ended_at"]')!
      .value,
  ).toBe("2026-10-12T21:00");
  await save();
  const update = transport.calls.find((call) =>
    call.type.endsWith("/journal/update"),
  )!;
  expect(update.patch).toMatchObject({
    started_at: new Date("2026-10-12T19:00:00").toISOString(),
    ended_at: new Date("2026-10-12T21:00:00").toISOString(),
  });
});
