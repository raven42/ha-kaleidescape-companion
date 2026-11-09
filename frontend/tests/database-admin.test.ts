import { modalClose } from "./dialog-helpers";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import "../src/ui/database";
import type { KaleidescapeDatabase } from "../src/ui/database";
import type { DatabaseSearch } from "../src/ui/database-query";
import { ApiError } from "../src/core/api";
import { FixtureTransport, info, record } from "./fixture";
import { selectManual } from "./manual-helpers";
let element: KaleidescapeDatabase;
let transport: FixtureTransport;
const root = () => element.shadowRoot!;
const button = (label: string) =>
  [...root().querySelectorAll<HTMLButtonElement>("button")].find(
    (node) => node.textContent?.trim() === label,
  )!;
async function flush() {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await element?.updateComplete;
}
function input(name: string, value: string) {
  const field = root().querySelector<HTMLInputElement | HTMLTextAreaElement>(
    `[name="${name}"]`,
  )!;
  field.value = value;
  field.dispatchEvent(new Event("input", { bubbles: true }));
}
async function mount() {
  element = document.createElement(
    "kaleidescape-database",
  ) as KaleidescapeDatabase;
  element.client = transport.client();
  element.scope = { ...info, tracking_enabled: true };
  document.body.append(element);
  await vi.waitFor(() =>
    expect(root().textContent).toContain("The Lantern Voyage"),
  );
}
async function choose() {
  [...root().querySelectorAll<HTMLButtonElement>(".entry-name")]
    .find((node) => node.textContent?.trim() === record().title)!
    .click();
  await flush();
}
async function edit() {
  await choose();
  button("Edit entry").click();
  await flush();
}
async function confirm() {
  root().querySelector<HTMLInputElement>('[name="confirm_edit"]')!.click();
  await flush();
  button("Save changes").click();
  await flush();
}
beforeEach(() => {
  transport = new FixtureTransport();
  window.confirm = vi.fn(() => true);
});
afterEach(() => {
  element?.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("keeps the database pager outside the list and provides separate keyboard scroll regions", async () => {
  await mount();
  await choose();
  expect(
    root().querySelector(".entries-header kaleidescape-database-search"),
  ).not.toBeNull();
  expect(root().querySelector('.entry-list[tabindex="0"]')).not.toBeNull();
  expect(root().querySelector('.entries-detail[tabindex="0"]')).not.toBeNull();
  expect(root().querySelector(".entries-list .pagination")).toBeNull();
  expect(root().querySelector(".entries-footer .pagination")).not.toBeNull();
  expect(root().querySelector(".entries-detail pre")?.textContent).toContain(
    record().id,
  );
});

it("opens the selected purchase in the reviewed repair panel", async () => {
  transport.purchaseRecords = [
    {
      id: "a".repeat(64),
      title: "Fictional purchase",
      purchase_price: "$12.99",
      purchased_on: "2020-01-02",
      library_id: null,
    },
  ];
  await mount();
  root().querySelector<HTMLButtonElement>("#table-purchase_records")!.click();
  await vi.waitFor(() =>
    expect(root().textContent).toContain("Fictional purchase"),
  );
  root().querySelector<HTMLButtonElement>(".entry-name")!.click();
  await flush();
  expect(root().textContent).not.toContain("Repair purchase");
  button("Edit entry").click();
  await flush();
  const repair = root().querySelector("kaleidescape-purchase-repair")!;
  await (repair as HTMLElement & { updateComplete: Promise<unknown> })
    .updateComplete;
  expect(
    repair.shadowRoot!.querySelector<HTMLInputElement>('[name="title"]')!.value,
  ).toBe("Fictional purchase");
  expect(repair.shadowRoot!.textContent).toContain("Edit purchase");
  expect(repair.shadowRoot!.textContent).not.toContain("Void purchase");
  expect(repair.shadowRoot!.textContent).not.toContain("Unlink purchase");
  expect(
    root().querySelector<HTMLButtonElement>("#table-viewings")!.disabled,
  ).toBe(true);
});

it("clears an applied database search and exposes the selected table hint", async () => {
  await mount();
  const hint = root().querySelector<HTMLElement & { hint: string }>(
    ".database-table-heading kaleidescape-settings-hint",
  )!;
  expect(hint.hint).toContain("Journal");
  const search = root().querySelector(
    "kaleidescape-database-search",
  ) as DatabaseSearch;
  await search.updateComplete;
  const field = search.shadowRoot!.querySelector<HTMLInputElement>("input")!;
  field.value = "Voyage";
  field.dispatchEvent(new Event("input"));
  field.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "Enter",
      bubbles: true,
      cancelable: true,
    }),
  );
  await flush();
  await search.updateComplete;
  search
    .shadowRoot!.querySelector<HTMLButtonElement>(
      '[aria-label="Clear database search"]',
    )!
    .click();
  await flush();
  expect(field.value).toBe("");
  expect(
    transport.calls
      .filter((call) => call.type.endsWith("/database/inspect"))
      .at(-1),
  ).toMatchObject({ query: "" });
});

it("shows raw details first and edits only supported fields after explicit confirmation", async () => {
  await mount();
  await choose();
  expect(root().querySelector<HTMLDialogElement>("#database-edit")!.open).toBe(
    false,
  );
  expect(
    root().querySelector('[aria-label="Selected database entry"] pre')!
      .textContent,
  ).toContain(record().id);
  button("Edit entry").click();
  await flush();
  expect(root().querySelector<HTMLDialogElement>("#database-edit")!.open).toBe(
    true,
  );
  expect(root().querySelector('#database-edit [name="id"]')).toBeNull();
  input("notes", "Administrator correction");
  await confirm();
  await vi.waitFor(() =>
    expect(transport.records[0].notes).toBe("Administrator correction"),
  );
  const call = transport.calls.find((call) =>
    call.type.endsWith("/database/mutate"),
  )!;
  expect(call.data).toMatchObject({
    table: "viewings",
    operation: "edit",
    patch: { notes: "Administrator correction" },
    confirmation: "SAVE",
  });
  expect(root().querySelector<HTMLDialogElement>("#database-edit")!.open).toBe(
    false,
  );
});
it("permanently deletes a selected record with typed confirmation while recording remains enabled", async () => {
  await mount();
  await choose();
  button("Delete entry").click();
  await flush();
  expect(button("Confirm delete").disabled).toBe(true);
  input("delete_confirmation", "DELETE");
  await flush();
  button("Confirm delete").click();
  await flush();
  expect(transport.records.some((row) => row.id === record().id)).toBe(false);
  expect(
    transport.calls.find((call) => call.type.endsWith("/database/mutate"))!
      .data,
  ).toMatchObject({ operation: "delete", confirmation: "DELETE" });
  expect(root().querySelector("#purge-entry")).toBeNull();
});
it("locks an uncertain delete and retries its exact UUID and payload without another deletion", async () => {
  await mount();
  const original = transport.callWS.bind(transport);
  let lost = true;
  vi.spyOn(transport, "callWS").mockImplementation(async (message) => {
    const result = await original(message);
    if (lost && message.type.endsWith("/database/mutate")) {
      lost = false;
      throw new ApiError("connection_lost");
    }
    return result;
  });
  await choose();
  button("Delete entry").click();
  await flush();
  input("delete_confirmation", "DELETE");
  await flush();
  button("Confirm delete").click();
  await flush();
  expect(element.confirmNavigation()).toBe(false);
  root().querySelector<HTMLButtonElement>("#database-delete button")!;
  button("Retry same change").click();
  await flush();
  const calls = transport.calls.filter((call) =>
    call.type.endsWith("/database/mutate"),
  );
  expect(calls).toHaveLength(2);
  expect(calls[1]).toEqual(calls[0]);
  expect(transport.records).toHaveLength(2);
});
it("retains an edited draft on conflicts and blocks implicit dirty-modal dismissal", async () => {
  await mount();
  await edit();
  input("notes", "Keep this correction");
  window.confirm = vi.fn(() => false);
  modalClose(root()).click();
  await flush();
  expect(root().querySelector<HTMLDialogElement>("#database-edit")!.open).toBe(
    true,
  );
  transport.revision++;
  await confirm();
  expect(root().textContent).toContain("changed elsewhere");
  expect(
    root().querySelector<HTMLTextAreaElement>('[name="notes"]')!.value,
  ).toBe("Keep this correction");
  expect(transport.records[0].notes).not.toBe("Keep this correction");
});
it("stores database row counts, per-table sorts and system visibility separately from Library preferences", async () => {
  await mount();
  expect(root().querySelectorAll('[role="tab"]')).toHaveLength(4);
  button("Options").click();
  await flush();
  const limit = root().querySelector<HTMLSelectElement>(
    '[name="database_limit"]',
  )!;
  limit.value = "100";
  limit.dispatchEvent(new Event("change"));
  await flush();
  const sort = root().querySelector<HTMLSelectElement>(
    '[name="database_sort"]',
  )!;
  sort.value = "title";
  sort.dispatchEvent(new Event("change"));
  await flush();
  button("Ascending ↑").click();
  await flush();
  root().querySelector<HTMLInputElement>('[name="show_system"]')!.click();
  await flush();
  for (const table of [
    "settings",
    "calendar_managed_events",
    "calendar_reconcile_candidates",
    "calendar_reconcile_intents",
  ])
    expect(
      root().querySelector(`[name="database_table"] option[value="${table}"]`),
    ).not.toBeNull();
  expect(root().querySelector('optgroup[label="Calendar"]')).toBeTruthy();
  expect(root().querySelector('optgroup[label="Library"]')).toBeTruthy();
  expect(transport.databasePreferences).toMatchObject({
    limit: 100,
    show_system: true,
    sorts: { viewings: { sort: "title", descending: true } },
  });
  expect(transport.uiPreferences.page_size).toBe(100);
  element.remove();
  await mount();
  expect(
    root().querySelector<HTMLSelectElement>('[name="database_limit"]')!.value,
  ).toBe("100");
  for (const table of [
    "settings",
    "calendar_managed_events",
    "calendar_reconcile_candidates",
    "calendar_reconcile_intents",
  ])
    expect(
      root().querySelector(`[name="database_table"] option[value="${table}"]`),
    ).not.toBeNull();
  const system = root().querySelector<HTMLSelectElement>(
    '[name="database_table"]',
  )!;
  system.value = "requests";
  system.dispatchEvent(new Event("change"));
  await flush();
  expect(button("New Entry").disabled).toBe(true);
  expect(button("Delete entry").disabled).toBe(true);
});
it("uses scoped schema completion, validation feedback and literal/structured search submission", async () => {
  await mount();
  const search = root().querySelector(
    "kaleidescape-database-search",
  ) as DatabaseSearch;
  await search.updateComplete;
  const field = search.shadowRoot!.querySelector<HTMLInputElement>("input")!;
  field.value = "tit";
  field.setSelectionRange(3, 3);
  field.dispatchEvent(new Event("input"));
  await search.updateComplete;
  expect(search.shadowRoot!.textContent).toContain("title");
  field.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "Tab",
      bubbles: true,
      cancelable: true,
    }),
  );
  await search.updateComplete;
  expect(field.value).toBe("title ");
  for (const partial of ["title IS N", "title IS NOT N"]) {
    field.value = partial;
    field.setSelectionRange(partial.length, partial.length);
    field.dispatchEvent(new Event("input"));
    await search.updateComplete;
    expect(search.shadowRoot!.textContent).toContain("IS NOT NULL");
    const suggestion = [
      ...search.shadowRoot!.querySelectorAll<HTMLButtonElement>(
        '[role="option"]',
      ),
    ].find((option) => option.textContent === "IS NOT NULL")!;
    const touch = new PointerEvent("pointerdown", {
      pointerType: "touch",
      cancelable: true,
    });
    suggestion.dispatchEvent(touch);
    expect(touch.defaultPrevented).toBe(true);
    suggestion.click();
    await search.updateComplete;
    expect(field.value).toBe("title IS NOT NULL ");
  }
  field.value = "title = 'Voyage'";
  field.setSelectionRange(field.value.length, field.value.length);
  field.dispatchEvent(new Event("input"));
  field.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "Enter",
      bubbles: true,
      cancelable: true,
    }),
  );
  await flush();
  expect(
    transport.calls
      .filter((call) => call.type.endsWith("/database/inspect"))
      .at(-1),
  ).toMatchObject({ query: "title = 'Voyage'" });
  vi.spyOn(element.client!, "validateDatabaseQuery").mockRejectedValueOnce({
    code: "query_syntax",
    message: "Expected quoted text (position 9)",
  });
  field.value = "title =";
  field.dispatchEvent(new Event("input"));
  await vi.waitFor(() =>
    expect(search.shadowRoot!.textContent).toContain("Expected quoted text"),
  );
  expect(field.getAttribute("aria-invalid")).toBe("true");
  const aliases = [
    "stored_purchased_on",
    "stored_purchase_price",
    "stored_retail_price",
    "stored_order_id",
    "stored_href",
  ];
  search.fields = aliases.map((name) => ({ name, type: "text" }));
  for (const name of aliases) {
    field.value = `${name} IS NULL`;
    field.dispatchEvent(new Event("input"));
    await vi.waitFor(() =>
      expect(element.client!.validateDatabaseQuery).toHaveBeenCalledWith(
        search.scope,
        search.table,
        `${name} IS NULL`,
      ),
    );
    await search.updateComplete;
    expect(field.getAttribute("aria-invalid")).toBe("false");
    expect(search.shadowRoot!.querySelector("#query-result")).toBeNull();
  }
});
it("clears inspection results after denial and ignores late responses after account changes", async () => {
  await mount();
  await choose();
  transport.failure = "unauthorized";
  button("Refresh database").click();
  await flush();
  expect(root().textContent).not.toContain(record().notes);
  expect(root().querySelector("pre")).toBeNull();
});
it("creates manual viewings through the existing journal API with confirmed fields", async () => {
  await mount();
  button("New Entry").click();
  await flush();
  await selectManual(root(), transport, "A new fictional entry");
  await confirm();
  await vi.waitFor(() =>
    expect(
      transport.records.some((row) => row.title === "A new fictional entry"),
    ).toBe(true),
  );
  expect(
    transport.calls.some((call) => call.type.endsWith("/journal/create")),
  ).toBe(true);
});

it("lets typing replace NULL values with a footer save and header close", async () => {
  transport.records[0].duration_seconds = null;
  await mount();
  await edit();
  const duration = root().querySelector<HTMLInputElement>(
    '[name="duration_seconds"]',
  )!;
  const nullToggle = root().querySelector<HTMLInputElement>(
    '[aria-label="Set duration_seconds to NULL"]',
  )!;
  expect(duration.disabled).toBe(false);
  expect(nullToggle.checked).toBe(true);
  input("duration_seconds", "7200");
  await flush();
  expect(nullToggle.checked).toBe(false);
  expect(
    button("Save changes").parentElement!.classList.contains("dialog-footer"),
  ).toBe(true);
  expect(modalClose(root()).closest(".card-head")).not.toBeNull();
  await confirm();
  expect(transport.records[0].duration_seconds).toBe(7200);
});

it("shows compact outgoing and incoming entry links and follows the chosen referencing row", async () => {
  transport.records[0] = {
    ...transport.records[0],
    library_title_id: "fictional-title",
  } as (typeof transport.records)[0];
  transport.databaseReferences.viewings = [
    { table: "library", key: { id: "library_title_id" } },
  ];
  transport.purchaseRecords = [
    { id: "purchase-a", title: "Fictional purchase A" },
    { id: "purchase'b", title: "Fictional purchase B" },
  ];
  transport.databaseIncoming.viewings = [
    {
      table: "purchase_records",
      key: { library_id: "id" },
      items: [{ id: "purchase-a" }, { id: "purchase'b" }],
      more: true,
    },
  ];
  await mount();
  await choose();
  await vi.waitFor(() =>
    expect(
      root().querySelector('[aria-label="Referenced by"]')?.textContent,
    ).toContain("purchase'b"),
  );
  const outgoing = root().querySelector('[aria-label="References"]')!;
  expect(outgoing.querySelector("h3")?.textContent).toBe("References");
  expect(outgoing.querySelector("button")?.textContent?.trim()).toBe(
    "Library - fictional-title",
  );
  const incoming = root().querySelector('[aria-label="Referenced by"]')!;
  const links = [...incoming.querySelectorAll<HTMLButtonElement>("button")];
  expect(
    links.map((item) => item.textContent?.replace(/\s+/g, " ").trim()),
  ).toEqual([
    "Purchases - purchase-a",
    "Purchases - purchase'b",
    "View all Purchases",
  ]);
  links[1].click();
  await vi.waitFor(() =>
    expect(root().querySelector(".database-detail pre")?.textContent).toContain(
      "Fictional purchase B",
    ),
  );
  expect(
    transport.calls
      .filter((call) => call.type.endsWith("/database/inspect"))
      .at(-1),
  ).toMatchObject({
    table: "purchase_records",
    query: "WHERE id = 'purchase''b'",
  });
});

it("ignores incoming reference results for a previously selected entry", async () => {
  const client = transport.client();
  const resolvers: ((value: {
    groups: import("../src/core/api").DatabaseReferenceGroup[];
  }) => void)[] = [];
  vi.spyOn(client, "referencedBy").mockImplementation(
    () => new Promise((resolve) => resolvers.push(resolve)),
  );
  element = document.createElement(
    "kaleidescape-database",
  ) as KaleidescapeDatabase;
  element.client = client;
  element.scope = info;
  document.body.append(element);
  await vi.waitFor(() =>
    expect(root().querySelectorAll(".entry-name").length).toBeGreaterThan(1),
  );
  const buttons = root().querySelectorAll<HTMLButtonElement>(".entry-name");
  buttons[0].click();
  await flush();
  buttons[1].click();
  await flush();
  resolvers[1]({ groups: [] });
  resolvers[0]({
    groups: [
      {
        table: "viewings",
        key: { id: "id" },
        items: [{ id: "stale-private-value" }],
        more: false,
      },
    ],
  });
  await flush();
  expect(root().textContent).not.toContain("stale-private-value");
});

it("follows composite references and selects the referenced row without accepting executable SQL", async () => {
  const original = transport.client();
  const target = { source_id: "fictional-source", name: "Director's picks" };
  const inspect = vi
    .spyOn(original, "inspect")
    .mockImplementation(async (_scope, table) => ({
      dataset_revision: 1,
      sort: "id",
      descending: false,
      query: "",
      main_tables: [],
      table,
      tables: { viewings: 1, library_collections: 1 },
      schema: [],
      query_fields: [],
      operators: [],
      deletable: false,
      row_tokens: [],
      items: table === "viewings" ? [{ id: "viewing", ...target }] : [target],
      references:
        table === "viewings"
          ? [
              {
                table: "library_collections",
                key: { source_id: "source_id", name: "name" },
              },
            ]
          : [],
      columns: Object.keys(target),
      revision: 1,
      offset: 0,
      limit: 25,
      total: 1,
      has_more: false,
    }));
  element = document.createElement(
    "kaleidescape-database",
  ) as KaleidescapeDatabase;
  element.client = original;
  element.scope = info;
  document.body.append(element);
  await vi.waitFor(() =>
    expect(root().querySelector(".entry-name")).toBeTruthy(),
  );
  root().querySelector<HTMLButtonElement>(".entry-name")!.click();
  await flush();
  expect(
    root()
      .querySelector<HTMLButtonElement>(".database-references button")!
      .textContent?.replace(/\s+/g, " ")
      .trim(),
  ).toBe("Library collections - fictional-source, Director's picks");
  root()
    .querySelector<HTMLButtonElement>(".database-references button")!
    .click();
  await flush();
  expect(inspect.mock.calls.at(-1)?.at(-1)).toMatchObject({
    query:
      "WHERE source_id = 'fictional-source' AND name = 'Director''s picks'",
  });
  expect(root().querySelector(".database-detail pre")?.textContent).toContain(
    "Director's picks",
  );
});

it("loads All in revision-bound batches, virtualizes rows and keeps selections across batches", async () => {
  transport.databasePreferences.limit = "all";
  transport.records = Array.from({ length: 225 }, (_, index) =>
    record({
      id: String(index).padStart(3, "0"),
      title:
        index === 0
          ? "The Lantern Voyage"
          : `Viewing ${String(index).padStart(3, "0")}`,
    }),
  );
  await mount();
  expect(root().textContent).toContain("100 of 225 rows loaded");
  expect(root().querySelectorAll(".entry-name").length).toBeLessThan(40);
  expect(root().querySelector(".database-pagination .actions")).toBeNull();
  const selected = root().querySelector<HTMLInputElement>(
    '[data-row-index="0"] input',
  )!;
  selected.click();
  selected.focus();
  const list = root().querySelector<HTMLElement>(".entry-list")!;
  Object.defineProperty(list, "clientHeight", {
    configurable: true,
    value: 440,
  });
  Object.defineProperty(list, "scrollHeight", {
    configurable: true,
    value: 4400,
  });
  list.scrollTop = 4250;
  list.dispatchEvent(new Event("scroll"));
  expect(root().activeElement).toBe(list);
  await vi.waitFor(() =>
    expect(root().textContent).toContain("200 of 225 rows loaded"),
  );
  expect(
    transport.calls
      .filter((call) => call.type.endsWith("database/inspect"))
      .at(-1),
  ).toMatchObject({ offset: 100, revision: 5, limit: 100 });
  expect(root().textContent).toContain("1 selected");
  await vi.waitFor(() =>
    expect(
      root().querySelector('[data-row-index="100"] .entry-name'),
    ).toBeTruthy(),
  );
  root()
    .querySelector<HTMLInputElement>('[data-row-index="100"] input')!
    .click();
  root()
    .querySelector<HTMLButtonElement>('[data-row-index="100"] .entry-name')!
    .click();
  await vi.waitFor(() =>
    expect(root().querySelector(".entries-detail pre")?.textContent).toContain(
      "Viewing 100",
    ),
  );
  expect(root().textContent).toContain("2 selected");
  button("Delete entries (2)").click();
  await flush();
  input("delete_confirmation", "DELETE");
  await flush();
  button("Confirm delete").click();
  await vi.waitFor(() => expect(transport.records).toHaveLength(223));
  expect(
    transport.records.some((row) => row.id === "000" || row.id === "100"),
  ).toBe(false);
});

it("stops loading All if the database revision changes and retains the visible selection", async () => {
  transport.databasePreferences.limit = "all";
  transport.records = Array.from({ length: 150 }, (_, index) =>
    record({
      id: String(index).padStart(3, "0"),
      title: index ? `Viewing ${index}` : "The Lantern Voyage",
    }),
  );
  await mount();
  root().querySelector<HTMLInputElement>('[data-row-index="0"] input')!.click();
  transport.revision++;
  button("Load more rows").click();
  await vi.waitFor(() =>
    expect(root().textContent).toContain("Refresh database to restart"),
  );
  expect(root().textContent).toContain("1 selected");
  expect(root().textContent).toContain("100 of 150 rows loaded");
  expect(root().querySelectorAll(".entry-name").length).toBeLessThan(40);
  button("Refresh database").click();
  await vi.waitFor(() =>
    expect(root().textContent).not.toContain("Refresh database to restart"),
  );
  expect(root().textContent).toContain("0 selected");
});

it("discards a late All batch after switching tables", async () => {
  transport.databasePreferences.limit = "all";
  transport.records = Array.from({ length: 150 }, (_, index) =>
    record({
      id: String(index).padStart(3, "0"),
      title: index ? `Viewing ${index}` : "The Lantern Voyage",
    }),
  );
  const original = transport.callWS.bind(transport);
  let release!: () => void;
  vi.spyOn(transport, "callWS").mockImplementation(async (message) => {
    const result = await original(message);
    if (
      message.type.endsWith("database/inspect") &&
      message.table === "viewings" &&
      message.offset === 100
    )
      await new Promise<void>((resolve) => {
        release = resolve;
      });
    return result;
  });
  await mount();
  button("Load more rows").click();
  await vi.waitFor(() => expect(release).toBeTypeOf("function"));
  root().querySelector<HTMLButtonElement>("#table-sessions")!.click();
  await vi.waitFor(() =>
    expect(root().querySelector(".entries-list h2")?.textContent).toBe(
      "Sessions",
    ),
  );
  release();
  await flush();
  expect(root().textContent).toContain("0 of 0 rows loaded");
  expect(root().textContent).not.toContain("Viewing 100");
});

it("refetches complete rows when switching from All to Fit", async () => {
  transport.databasePreferences.limit = "all";
  await mount();
  button("Options").click();
  await flush();
  const limit = root().querySelector<HTMLSelectElement>(
    '[name="database_limit"]',
  )!;
  limit.value = "fit";
  limit.dispatchEvent(new Event("change"));
  await vi.waitFor(() =>
    expect(
      transport.calls
        .filter((call) => call.type.endsWith("database/inspect"))
        .at(-1)?.limit,
    ).toBe(25),
  );
  await vi.waitFor(() =>
    expect(button("The Lantern Voyage").disabled).toBe(false),
  );
  await choose();
  expect(root().querySelector(".entries-detail pre")?.textContent).toContain(
    "fictional viewing for interface testing",
  );
});

it("reduces All batch size when a response is too large", async () => {
  transport.databasePreferences.limit = "all";
  transport.records = Array.from({ length: 150 }, (_, index) =>
    record({
      id: String(index).padStart(3, "0"),
      title: index ? `Viewing ${index}` : "The Lantern Voyage",
    }),
  );
  const original = transport.callWS.bind(transport);
  const attempted: number[] = [];
  vi.spyOn(transport, "callWS").mockImplementation(async (message) => {
    if (message.type.endsWith("database/inspect")) {
      attempted.push(Number(message.limit));
      if (Number(message.limit) > 25)
        throw new ApiError("database_page_too_large");
    }
    return original(message);
  });
  await mount();
  expect(attempted.slice(0, 3)).toEqual([100, 50, 25]);
  expect(root().textContent).toContain("25 of 150 rows loaded");
  button("Load more rows").click();
  await vi.waitFor(() =>
    expect(root().textContent).toContain("50 of 150 rows loaded"),
  );
  expect(attempted.at(-1)).toBe(25);
});

it("fits rows to the list viewport and keeps the selected entry on its new page after resize", async () => {
  transport.databasePreferences.limit = "fit";
  transport.records = Array.from({ length: 40 }, (_, index) =>
    record({
      id: String(index).padStart(3, "0"),
      title: index === 0 ? "The Lantern Voyage" : `Viewing ${index}`,
    }),
  );
  let height = 328;
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockImplementation(
    function (this: HTMLElement) {
      return this.classList.contains("entry-list") ? height : 0;
    },
  );
  const rect = HTMLElement.prototype.getBoundingClientRect;
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function (this: HTMLElement) {
      return this.tagName === "LI"
        ? ({ height: 64 } as DOMRect)
        : rect.call(this);
    },
  );
  await mount();
  await vi.waitFor(() =>
    expect(root().querySelectorAll(".entry-list li")).toHaveLength(5),
  );
  button("Next").click();
  await vi.waitFor(() =>
    expect(root().querySelector(".entry-name")?.textContent).toContain(
      "Viewing 5",
    ),
  );
  const selected = root().querySelectorAll<HTMLButtonElement>(".entry-name")[3];
  const title = selected.textContent!.trim();
  selected.click();
  await flush();
  height = 200; // Three rows; ordinal eight now belongs to offset six.
  window.dispatchEvent(new Event("resize"));
  await vi.waitFor(() =>
    expect(root().querySelectorAll(".entry-list li")).toHaveLength(3),
  );
  expect(root().querySelector("li.selected")?.textContent).toContain(title);
  expect(root().querySelector(".entries-detail pre")?.textContent).toContain(
    title,
  );
  expect(
    transport.calls
      .filter((call) => call.type.endsWith("database/inspect"))
      .at(-1),
  ).toMatchObject({ offset: 6, limit: 3 });
  height = 520;
  window.dispatchEvent(new Event("resize"));
  await vi.waitFor(() =>
    expect(root().querySelectorAll(".entry-list li")).toHaveLength(8),
  );
  expect(root().querySelector("li.selected")?.textContent).toContain(title);
  expect(transport.databasePreferences.limit).toBe("fit");
  const nextWidth = window.innerWidth > 600 ? 390 : 1280;
  vi.stubGlobal("innerWidth", nextWidth);
  window.dispatchEvent(new Event("resize"));
  await vi.waitFor(() =>
    expect(
      transport.calls.some(
        (call) =>
          call.type.endsWith("ui/preferences/get") &&
          call.area === "database" &&
          call.profile === (nextWidth === 390 ? "mobile" : "desktop"),
      ),
    ).toBe(true),
  );
  await vi.waitFor(() =>
    expect(root().querySelector("li.selected")?.textContent).toContain(title),
  );
  expect(root().querySelector(".entries-detail pre")?.textContent).toContain(
    title,
  );
});

it("recalculates Fit after window height changes and a reload at the smaller size", async () => {
  vi.stubGlobal("innerHeight", 1000);
  vi.stubGlobal("visualViewport", undefined);
  transport.databasePreferences.limit = "fit";
  transport.records = Array.from({ length: 40 }, (_, i) =>
    record({
      id: String(i).padStart(3, "0"),
      title: i ? `Viewing ${i}` : "The Lantern Voyage",
    }),
  );
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockImplementation(
    function (this: HTMLElement) {
      if (!this.classList.contains("entry-list")) return 0;
      const db = this.getRootNode() as ShadowRoot;
      return Math.max(
        0,
        parseFloat(
          (db.host as HTMLElement).style.getPropertyValue("--entries-height"),
        ) - 80,
      );
    },
  );
  const original = HTMLElement.prototype.getBoundingClientRect;
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function (this: HTMLElement) {
      if (this.tagName === "LI") return { height: 64 } as DOMRect;
      if (this.classList.contains("entries-layout"))
        return { top: 220, height: 600 } as DOMRect;
      if (this.classList.contains("entries-header"))
        return { height: 100 } as DOMRect;
      if (this.classList.contains("entries-footer"))
        return { height: 60 } as DOMRect;
      return original.call(this);
    },
  );
  await mount();
  await vi.waitFor(() =>
    expect(root().querySelectorAll(".entry-list li")).toHaveLength(9),
  );
  vi.stubGlobal("innerHeight", 650);
  window.dispatchEvent(new Event("resize"));
  await vi.waitFor(() =>
    expect(root().querySelectorAll(".entry-list li")).toHaveLength(4),
  );
  expect(transport.databasePreferences.limit).toBe("fit");
  element.remove();
  await mount();
  await vi.waitFor(() =>
    expect(root().querySelectorAll(".entry-list li")).toHaveLength(4),
  );
});
