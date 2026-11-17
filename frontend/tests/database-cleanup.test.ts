import { afterEach, expect, it, vi } from "vitest";
import "../src/ui/database-cleanup";
import type { DatabaseCleanup } from "../src/ui/database-cleanup";
import { FixtureTransport, info } from "./fixture";

let element: DatabaseCleanup;
afterEach(() => element?.remove());
it("reviews recommended defaults and lets advanced mode keep selected histories", async () => {
  const client = new FixtureTransport().client();
  const preview = vi.spyOn(client, "cleanupPreview");
  const apply = vi.spyOn(client, "cleanupDatabase");
  element = document.createElement(
    "kaleidescape-database-cleanup",
  ) as DatabaseCleanup;
  element.client = client;
  element.scope = info;
  document.body.append(element);
  await element.updateComplete;
  const root = element.shadowRoot!;
  const button = (label: string) =>
    [...root.querySelectorAll("button")].find(
      (item) => item.textContent?.trim() === label,
    )!;
  button("Database cleanup").click();
  await element.updateComplete;
  expect(root.querySelectorAll("kaleidescape-settings-hint")).toHaveLength(4);
  expect(root.querySelector<HTMLSelectElement>("#calendar")!.disabled).toBe(
    true,
  );
  expect(root.querySelector<HTMLSelectElement>("#calendar")!.value).toBe("180");
  expect(root.querySelector<HTMLSelectElement>("#playback")!.value).toBe("90");
  root.querySelector<HTMLButtonElement>('[role="switch"]')!.click();
  await element.updateComplete;
  const calendar = root.querySelector<HTMLSelectElement>("#calendar")!;
  calendar.value = "0";
  calendar.dispatchEvent(new Event("change"));
  await element.updateComplete;
  button("Review cleanup").click();
  await vi.waitFor(() =>
    expect(root.textContent).toContain("Review the proposed cleanup"),
  );
  expect(preview).toHaveBeenCalledWith(info, {
    calendar: 0,
    collections: 180,
    playback: 90,
  });
  expect(root.textContent).not.toContain("Calendar reconciliation history: 3");
  expect(apply).not.toHaveBeenCalled();
  button("Apply cleanup").click();
  await vi.waitFor(() =>
    expect(root.textContent).toContain("Database cleanup complete: 6"),
  );
  expect(apply.mock.calls[0][1].policies).toEqual({
    calendar: 0,
    collections: 180,
    playback: 90,
  });
});

it("reviews and applies artwork repairs even when every history is kept", async () => {
  const client = new FixtureTransport().client();
  vi.spyOn(client, "cleanupPreview").mockResolvedValue({
    as_of: "2026-11-08T00:00:00+00:00",
    counts: { calendar: 0, collections: 0, playback: 0 },
    artwork_links: 2,
    policies: { calendar: 0, collections: 0, playback: 0 },
    revision: 1,
  });
  const apply = vi.spyOn(client, "cleanupDatabase").mockResolvedValue({
    removed: { calendar: 0, collections: 0, playback: 0 },
    artwork_links: 2,
  });
  element = document.createElement(
    "kaleidescape-database-cleanup",
  ) as DatabaseCleanup;
  element.client = client;
  element.scope = info;
  document.body.append(element);
  await element.updateComplete;
  const root = element.shadowRoot!;
  const button = (label: string) =>
    [...root.querySelectorAll("button")].find(
      (item) => item.textContent?.trim() === label,
    )!;
  button("Database cleanup").click();
  await element.updateComplete;
  root.querySelector<HTMLButtonElement>('[role="switch"]')!.click();
  await element.updateComplete;
  for (const key of ["calendar", "collections", "playback"]) {
    const select = root.querySelector<HTMLSelectElement>(`#${key}`)!;
    select.value = "0";
    select.dispatchEvent(new Event("change"));
    await element.updateComplete;
  }
  expect(button("Review cleanup").disabled).toBe(false);
  button("Review cleanup").click();
  await vi.waitFor(() =>
    expect(root.textContent?.replace(/\s+/g, " ")).toContain(
      "Artwork links to repair: 2 editions",
    ),
  );
  expect(button("Apply cleanup").disabled).toBe(false);
  button("Apply cleanup").click();
  await vi.waitFor(() =>
    expect(root.textContent).toContain("artwork linked for 2 editions"),
  );
  expect(apply).toHaveBeenCalledOnce();
});
