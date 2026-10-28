import { afterEach, beforeEach, expect, it, vi } from "vitest";
import "../src/transfers";
import type { KaleidescapeTransfers } from "../src/transfers";
import { ApiError, MAX_IMPORT_BYTES } from "../src/api";
import type { ImportResult } from "../src/api";
import { FixtureTransport, info } from "./fixture";

let element: KaleidescapeTransfers;
let transport: FixtureTransport;
const root = () => element.shadowRoot!;
const text = () => root().textContent!;
function button(label: string) {
  return [...root().querySelectorAll("button")].find(
    (button) => button.textContent?.trim() === label,
  )!;
}
async function flush() {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await element.updateComplete;
}
function choose(file: File) {
  const input = root().querySelector<HTMLInputElement>('input[type="file"]')!;
  Object.defineProperty(input, "files", { configurable: true, value: [file] });
  input.dispatchEvent(new Event("change", { bubbles: true }));
}
beforeEach(async () => {
  transport = new FixtureTransport();
  element = document.createElement(
    "kaleidescape-transfers",
  ) as KaleidescapeTransfers;
  element.client = transport.client();
  element.scope = { ...info, tracking_enabled: false };
  document.body.append(element);
  await flush();
  button("Import").click();
  await flush();
});
afterEach(() => element.remove());

it("requires a file and disabled recording, then sends an explicit import", async () => {
  expect(button("Import new entries").disabled).toBe(true);
  const client = element.client!;
  const upload = vi
    .spyOn(client, "importFile")
    .mockResolvedValue({ imported_count: 2, skipped_count: 1, revision: 6 });
  choose(new File(['{"viewings":[]}'], "prior.json"));
  await flush();
  expect(upload).not.toHaveBeenCalled();
  button("Import new entries").click();
  await flush();
  expect(upload).toHaveBeenCalledTimes(1);
  expect(text()).toContain("Imported 2 entries; skipped 1 existing entries.");
  element.scope = { ...info, tracking_enabled: true };
  await flush();
  button("Import").click();
  await flush();
  expect(
    root().querySelector<HTMLInputElement>('input[type="file"]')!.disabled,
  ).toBe(true);
});
it("retains the exact file, UUID, and revision for an uncertain import retry", async () => {
  const file = new File(['{"viewings":[]}'], "prior.sqlite3");
  const upload = vi
    .spyOn(element.client!, "importFile")
    .mockRejectedValueOnce(new ApiError("connection_lost"))
    .mockResolvedValueOnce({
      imported_count: 1,
      skipped_count: 0,
      revision: 6,
    });
  choose(file);
  await flush();
  button("Import new entries").click();
  await flush();
  expect(text()).toContain("unconfirmed");
  expect(
    root().querySelector<HTMLInputElement>('input[type="file"]')!.disabled,
  ).toBe(true);
  const dialog = root().querySelector<HTMLDialogElement>("dialog")!;
  const cancel = new Event("cancel", { cancelable: true });
  dialog.dispatchEvent(cancel);
  await flush();
  expect(cancel.defaultPrevented).toBe(true);
  expect(dialog.open).toBe(true);
  expect(button("Cancel").disabled).toBe(true);
  button("Retry same import").click();
  await flush();
  expect(upload.mock.calls[0][0]).toEqual(upload.mock.calls[1][0]);
  expect(upload.mock.calls[0][1]).toBe(file);
  expect(upload.mock.calls[1][1]).toBe(file);
  expect(dialog.open).toBe(false);
});

it("clears a cancelled file selection and opens export format selection without starting a transfer", async () => {
  const upload = vi.spyOn(element.client!, "importFile");
  const download = vi.spyOn(element.client!, "download");
  choose(new File(["{}"], "fictional-private-export.json"));
  await flush();
  button("Cancel").click();
  await flush();
  const dialog = root().querySelector<HTMLDialogElement>("dialog")!;
  expect(dialog.open).toBe(false);
  expect(text()).not.toContain("fictional-private-export");
  button("Import").click();
  await flush();
  expect(button("Import new entries").disabled).toBe(true);
  const cancel = new Event("cancel", { cancelable: true });
  dialog.dispatchEvent(cancel);
  await flush();
  expect(dialog.open).toBe(false);
  button("Export").click();
  await flush();
  expect(dialog.open).toBe(true);
  expect(text()).toContain("Export JSON");
  expect(text()).toContain("Export SQLite");
  expect(root().querySelector('input[type="file"]')).toBeNull();
  expect(upload).not.toHaveBeenCalled();
  expect(download).not.toHaveBeenCalled();
});
it("rejects unsupported or oversized files before sending them", async () => {
  const upload = vi.spyOn(element.client!, "importFile");
  choose(new File(["DROP TABLE viewings;"], "data.sql"));
  await flush();
  button("Import new entries").click();
  await flush();
  expect(upload).not.toHaveBeenCalled();
  const file = new File(["{}"], "data.json");
  Object.defineProperty(file, "size", { value: MAX_IMPORT_BYTES + 1 });
  choose(file);
  await flush();
  button("Import new entries").click();
  await flush();
  expect(text()).toContain("32 MiB");
  expect(upload).not.toHaveBeenCalled();
});
it("aborts and ignores late import results after changing connections", async () => {
  let resolve!: (value: ImportResult) => void;
  const upload = vi.spyOn(element.client!, "importFile").mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  choose(new File(["{}"], "data.json"));
  await flush();
  button("Import new entries").click();
  await flush();
  const signal = upload.mock.calls[0][2];
  element.client = new FixtureTransport().client();
  await flush();
  expect(signal.aborted).toBe(true);
  expect(root().querySelector<HTMLDialogElement>("dialog")!.open).toBe(false);
  resolve({ imported_count: 999, skipped_count: 0, revision: 6 });
  await flush();
  expect(text()).not.toContain("Imported 999");
  expect(text()).not.toContain("data.json");
});
it("clears private file selection on revoked access and does not retry automatically", async () => {
  const upload = vi
    .spyOn(element.client!, "importFile")
    .mockRejectedValue(new ApiError("unauthorized"));
  choose(new File(["{}"], "private-fictional-name.json"));
  await flush();
  button("Import new entries").click();
  await flush();
  expect(text()).not.toContain("private-fictional-name.json");
  expect(text()).toContain("Access to this operation is denied");
  expect(upload).toHaveBeenCalledTimes(1);
});
