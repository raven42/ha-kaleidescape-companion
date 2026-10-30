import { afterEach, expect, it, vi } from "vitest";
import "../src/ui/calendar-export";
import type { CalendarExport } from "../src/ui/calendar-export";
import { ApiError } from "../src/core/api";
import { FixtureTransport, info } from "./fixture";
let element: CalendarExport | undefined;
afterEach(() => {
  element?.remove();
  vi.restoreAllMocks();
});
const button = (root: ShadowRoot, label: string) =>
  [...root.querySelectorAll<HTMLButtonElement>("button")].find(
    (node) => node.textContent?.trim() === label,
  )!;
async function mount() {
  const transport = new FixtureTransport();
  const client = transport.client();
  vi.spyOn(client, "calendarStatus").mockResolvedValue({
    enabled: true,
    ready: true,
    fingerprint: "fictional-fp",
    active: false,
    completed_viewings: 42,
    job: null,
  });
  element = document.createElement(
    "kaleidescape-calendar-export",
  ) as CalendarExport;
  element.client = client;
  element.scope = info;
  document.body.append(element);
  await vi.waitFor(() =>
    expect(
      button(element!.shadowRoot!, "Sync all watched movies to calendar")
        .disabled,
    ).toBe(false),
  );
  return { client, transport, root: element.shadowRoot! };
}
it("requires confirmation, describes matching and duplicate risk, and sends one saved-config UUID", async () => {
  const { root, transport } = await mount();
  button(root, "Sync all watched movies to calendar").click();
  await vi.waitFor(() => expect(root.querySelector("dialog")!.open).toBe(true));
  const dialog = root.querySelector("dialog")!;
  expect(dialog.classList.contains("database-dialog")).toBe(true);
  expect(
    root.getElementById(dialog.getAttribute("aria-labelledby")!)?.textContent,
  ).toBe("Export Journal to calendar");
  expect(root.textContent).toContain("duplicate events");
  expect(
    transport.calls.some((call) => call.type.endsWith("calendar/sync")),
  ).toBe(false);
  button(root, "Export Journal").click();
  await vi.waitFor(() =>
    expect(root.querySelector("dialog")!.open).toBe(false),
  );
  const call = transport.calls.find((call) =>
    call.type.endsWith("calendar/sync"),
  )!;
  expect(call).toMatchObject({
    entry_id: info.entry_id,
    dataset_id: info.dataset_id,
    fingerprint: "fictional-fp",
    confirmation: "EXPORT JOURNAL",
  });
  expect(call.request_id).toMatch(/^[a-f0-9-]{36}$/);
  expect(button(root, "Cancel").parentElement).toBe(
    button(root, "Export Journal").parentElement,
  );
});
it("blocks dismissal and preserves the exact request after a lost response", async () => {
  const { root, client } = await mount();
  const sync = vi
    .spyOn(client, "calendarSync")
    .mockRejectedValueOnce(new ApiError("connection_lost"))
    .mockResolvedValue({ job_id: "fictional", total: 42 });
  button(root, "Sync all watched movies to calendar").click();
  await vi.waitFor(() => expect(root.querySelector("dialog")!.open).toBe(true));
  button(root, "Export Journal").click();
  await vi.waitFor(() =>
    expect(root.textContent).toContain("start result is unconfirmed"),
  );
  expect(element!.confirmNavigation()).toBe(false);
  const cancel = new Event("cancel", { cancelable: true });
  root.querySelector("dialog")!.dispatchEvent(cancel);
  expect(cancel.defaultPrevented).toBe(true);
  button(root, "Retry same export").click();
  await vi.waitFor(() => expect(sync).toHaveBeenCalledTimes(2));
  expect(sync.mock.calls[1][0]).toBe(sync.mock.calls[0][0]);
});
it("ignores late status responses after account/scope changes", async () => {
  const { root, client } = await mount();
  let release: (
    value: Awaited<ReturnType<typeof client.calendarStatus>>,
  ) => void = () => {};
  vi.spyOn(client, "calendarStatus").mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  );
  button(root, "Refresh export status").click();
  element!.remove();
  release({
    enabled: true,
    ready: true,
    fingerprint: "late-private",
    active: false,
    completed_viewings: 999,
    job: {
      job_id: "late",
      total: 999,
      finished: true,
      counts: { created: 999 },
    },
  });
  await element!.updateComplete;
  expect(root.textContent).not.toContain("999");
});
