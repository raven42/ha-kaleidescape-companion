import { afterEach, expect, it, vi } from "vitest";
import "../src/ui/logs";
import type { KaleidescapeLogs } from "../src/ui/logs";
import { ApiError } from "../src/core/api";
import type { LogPage } from "../src/core/api";
import { FixtureTransport, info } from "./fixture";
import { logMessage, logSource, logText } from "../src/ui/log-format";

let element: KaleidescapeLogs;
afterEach(() => element?.remove());
const page = (): LogPage => ({
  items: [
    {
      id: 9,
      timestamp: "2026-10-31T12:00:00Z",
      level: "WARNING",
      logger: "calendar",
      operation: "verify",
      outcome: "mismatch",
      message:
        "The calendar description differs from the expected description.",
      file: "custom_components/kaleidescape_companion/calendar/entity.py",
      line: 180,
      resource: "event-opaque",
      trace: "request-aaaaaaaaaaaaaaaaaaaaaaaa",
    },
  ],
  before: null,
  through: 9,
  retained: 1,
  bytes: 250,
  limit_bytes: 5242880,
  banner: "Privacy: identifying details are not included.",
  loggers: ["calendar", "playback"],
  config: { level: "INFO", log_values: false, hidden_through: 0 },
  dropped: 0,
  storage_failures: 0,
  sink_failures: 0,
});
async function mount() {
  const client = new FixtureTransport().client();
  const call = vi.spyOn(client, "logs").mockResolvedValue(page());
  element = document.createElement("kaleidescape-logs") as KaleidescapeLogs;
  element.client = client;
  element.scope = info;
  document.body.append(element);
  await vi.waitFor(() =>
    expect(element.shadowRoot!.textContent).toContain("event-opaque"),
  );
  return { call, root: element.shadowRoot! };
}
it("filters structured logs and changes the shared logging level live", async () => {
  const { call, root } = await mount();
  const select = root.querySelector<HTMLSelectElement>('[name="log-level"]')!;
  expect(select.value).toBe("INFO");
  select.value = "DEBUG";
  select.dispatchEvent(new Event("change"));
  await vi.waitFor(() =>
    expect(call).toHaveBeenCalledWith(info, "configure", {
      data: { level: "DEBUG" },
    }),
  );
  await element.updateComplete;
  const filter = root.querySelector<HTMLSelectElement>(
    '[name="filter-logger"]',
  )!;
  filter.value = "calendar";
  filter.dispatchEvent(new Event("change"));
  await vi.waitFor(() =>
    expect(call).toHaveBeenLastCalledWith(info, "list", {
      filters: {
        logger: "calendar",
        level: "",
        hidden: false,
        reference: "",
        before: undefined,
      },
    }),
  );
});
it("clear uses a review dialog and hides only through the displayed sequence", async () => {
  const { call, root } = await mount();
  [...root.querySelectorAll("button")]
    .find((b) => b.textContent?.trim() === "Clear logs")!
    .click();
  await element.updateComplete;
  const dialog = root.querySelector("dialog")!;
  expect(dialog.open).toBe(true);
  expect(dialog.textContent).toContain("hides retained");
  dialog.querySelector<HTMLButtonElement>(".primary")!.click();
  await vi.waitFor(() =>
    expect(call).toHaveBeenLastCalledWith(info, "clear", { through: 9 }),
  );
  expect(call.mock.calls.every(([, op]) => op !== ("delete" as string))).toBe(
    true,
  );
});
it("withholds the panel and issues no requests for a household reader", async () => {
  const client = new FixtureTransport().client();
  const call = vi.spyOn(client, "logs");
  element = document.createElement("kaleidescape-logs") as KaleidescapeLogs;
  element.client = client;
  element.scope = {
    ...info,
    permissions: { read: true, edit: false, export: false },
  };
  document.body.append(element);
  await element.updateComplete;
  expect(element.shadowRoot!.querySelector("section")).toBeNull();
  expect(call).not.toHaveBeenCalled();
});
it("clears private log rows when authorization is revoked", async () => {
  const { call, root } = await mount();
  const denied = vi.fn();
  element.addEventListener("access-denied", denied);
  call.mockRejectedValueOnce(new ApiError("unauthorized"));
  [...root.querySelectorAll("button")]
    .find((b) => b.textContent?.trim() === "Refresh")!
    .click();
  await vi.waitFor(() => expect(denied).toHaveBeenCalled());
  expect(root.textContent).not.toContain("event-opaque");
});
it("shows refresh failures beside the log list without opening Options", async () => {
  const { call, root } = await mount();
  call.mockRejectedValueOnce(new ApiError("storage_error"));
  [...root.querySelectorAll("button")]
    .find((b) => b.textContent?.trim() === "Refresh")!
    .click();
  await vi.waitFor(() =>
    expect(
      root.querySelector('.log-body [role="alert"]')?.textContent,
    ).toBeTruthy(),
  );
  expect(root.querySelector<HTMLDialogElement>("#log-options")!.open).toBe(
    false,
  );
});
it("follows an originating request through linked log rows", async () => {
  const { call, root } = await mount();
  root.querySelector<HTMLButtonElement>(".log-detail .link")!.click();
  await vi.waitFor(() =>
    expect(call).toHaveBeenLastCalledWith(info, "list", {
      filters: {
        level: "",
        logger: "",
        hidden: false,
        reference: "request-aaaaaaaaaaaaaaaaaaaaaaaa",
        before: undefined,
      },
    }),
  );
  expect(
    root.querySelector<HTMLInputElement>('[name="filter-reference"]')!.value,
  ).toBe("request-aaaaaaaaaaaaaaaaaaaaaaaa");
});
it("ignores a late reply after the signed-in scope changes", async () => {
  const client = new FixtureTransport().client();
  let release!: (page: LogPage) => void;
  vi.spyOn(client, "logs").mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  );
  element = document.createElement("kaleidescape-logs") as KaleidescapeLogs;
  element.client = client;
  element.scope = info;
  document.body.append(element);
  await element.updateComplete;
  element.scope = {
    ...info,
    permissions: { read: true, edit: false, export: false },
  };
  await element.updateComplete;
  release(page());
  await element.updateComplete;
  expect(element.shadowRoot!.textContent).not.toContain("event-opaque");
});

it.each(["json", "text"] as const)(
  "exports %s with the privacy banner and active filters",
  async (format) => {
    const { call, root } = await mount();
    const blobs: Blob[] = [];
    vi.spyOn(URL, "createObjectURL").mockImplementation((blob) => {
      blobs.push(blob as Blob);
      return "blob:fictional-export";
    });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const button = [...root.querySelectorAll("button")].find(
      (b) =>
        b.textContent?.trim() ===
        (format === "json" ? "Export JSON" : "Export text"),
    )!;
    button.click();
    await vi.waitFor(() => expect(blobs.length).toBe(1));
    const content = await blobs[0].text();
    expect(content).toContain("Privacy:");
    expect(content).toContain("event-opaque");
    expect(content).toContain("calendar/entity.py");
    expect(content).toContain("180");
    expect(content).toContain("description differs");
    expect(call).toHaveBeenLastCalledWith(info, "export", {
      filters: {
        level: "",
        logger: "",
        hidden: false,
        reference: "",
        before: undefined,
        through: undefined,
        limit: 500,
      },
    });
  },
);

it("shows a compact human message, source and collapsed structured details", async () => {
  const { root } = await mount();
  expect(root.querySelector(".log-message")!.textContent).toContain(
    "description differs",
  );
  expect(root.querySelector(".log-source")!.textContent).toContain(
    "entity.py:180",
  );
  expect(
    root.querySelector(".log-source code")!.getAttribute("title"),
  ).toContain("calendar/entity.py:180");
  expect(root.querySelector<HTMLDetailsElement>(".log-detail")!.open).toBe(
    false,
  );
  expect(root.querySelector(".log-detail pre")).toBeNull();
  expect(root.querySelector<HTMLDialogElement>("#log-options")!.open).toBe(
    false,
  );
  [...root.querySelectorAll("button")]
    .find((b) => b.textContent?.trim() === "Options")!
    .click();
  await element.updateComplete;
  expect(root.querySelector<HTMLDialogElement>("#log-options")!.open).toBe(
    true,
  );
});

it("keeps legacy logs readable without inventing their source location", () => {
  const row = {
    logger: "calendar",
    operation: "write",
    outcome: "failed",
    failure: "missing_field",
  };
  expect(logMessage(row)).toContain("required field is missing");
  expect(logSource(row)).toBe("Not recorded");
  expect(logText(row)).toContain("[Not recorded]");
});

it("rejects absolute or unsafe source paths and invalid line numbers", () => {
  for (const file of [
    "/private/account/module.py",
    "../module.py",
    "package/<script>.py",
  ]) {
    expect(logSource({ file, line: 10 })).toBe("Not recorded");
  }
  expect(logSource({ file: "package/module.py", line: -1 })).toBe(
    "Not recorded",
  );
  expect(logSource({ file: "external", line: 10 })).toBe("External caller:10");
});
