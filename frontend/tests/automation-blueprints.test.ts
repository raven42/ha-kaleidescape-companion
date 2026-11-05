import { afterEach, expect, it, vi } from "vitest";
import "../src/ui/automation-blueprints";
import type { AutomationBlueprints } from "../src/ui/automation-blueprints";
import { FixtureTransport, info } from "./fixture";

let element: AutomationBlueprints;
afterEach(() => element?.remove());

it("shows blueprint status and requires confirmation before updating", async () => {
  const client = new FixtureTransport().client();
  const status = vi.spyOn(client, "automationStatuses").mockResolvedValue({
    library_schedule: { status: "outdated", label: "Library", revision: "old" },
    metadata_schedule: {
      status: "modified",
      label: "Metadata",
      revision: "custom",
    },
    purchase_email: { status: "current", label: "Email", revision: "current" },
    calendar_schedule: { status: "missing", label: "Calendar", revision: null },
  });
  const update = vi
    .spyOn(client, "updateAutomationBlueprint")
    .mockResolvedValue({});
  element = document.createElement(
    "kaleidescape-automation-blueprints",
  ) as AutomationBlueprints;
  element.client = client;
  element.scope = info;
  document.body.append(element);
  await vi.waitFor(() =>
    expect(element.shadowRoot!.textContent).toContain("Update available"),
  );
  expect(element.shadowRoot!.textContent).toContain("Modified or unrecognized");
  const row = element.shadowRoot!.querySelector(
    '[data-blueprint="library_schedule"]',
  )!;
  row.querySelector("button")!.click();
  await element.updateComplete;
  expect(update).not.toHaveBeenCalled();
  expect(element.shadowRoot!.textContent).toContain("may discard local edits");
  [...element.shadowRoot!.querySelectorAll("button")]
    .find(
      (button) => button.textContent!.trim() === "Update installed blueprint",
    )!
    .click();
  await vi.waitFor(() =>
    expect(update).toHaveBeenCalledWith(info, "library_schedule", "old"),
  );
  await vi.waitFor(() => expect(status).toHaveBeenCalledTimes(2));
});

it("shows installed and current versions in About", async () => {
  const client = new FixtureTransport().client();
  vi.spyOn(client, "automationStatuses").mockResolvedValue({
    purchase_email: {
      status: "outdated",
      label: "Email",
      revision: "old",
      installed_version: 1,
      latest_version: 2,
    },
    library_schedule: {
      status: "current",
      label: "Library",
      revision: "new",
      installed_version: 1,
      latest_version: 1,
    },
    metadata_schedule: {
      status: "modified",
      label: "Metadata",
      revision: "custom",
      installed_version: null,
      latest_version: 1,
    },
    calendar_schedule: {
      status: "missing",
      label: "Calendar",
      revision: null,
      installed_version: null,
      latest_version: 1,
    },
  });
  element = document.createElement(
    "kaleidescape-automation-blueprints",
  ) as AutomationBlueprints;
  element.client = client;
  element.scope = info;
  element.versionsOnly = true;
  document.body.append(element);
  await vi.waitFor(() =>
    expect(element.shadowRoot!.textContent).toContain("Purchase receipt email"),
  );
  const rows = [...element.shadowRoot!.querySelectorAll("tbody tr")];
  expect(rows[0].textContent).toContain("v1");
  expect(rows[0].textContent).toContain("v2");
  expect(rows[2].textContent).toContain("Unversioned");
  expect(rows[3].textContent).toContain("Not installed");
});

it("does not redefine its custom element when the module is loaded again", async () => {
  const registered = customElements.get("kaleidescape-automation-blueprints");
  vi.resetModules();
  await import("../src/ui/automation-blueprints");
  expect(customElements.get("kaleidescape-automation-blueprints")).toBe(
    registered,
  );
});

it("opens bundled version history for the selected blueprint as text", async () => {
  const client = new FixtureTransport().client();
  vi.spyOn(client, "automationStatuses").mockResolvedValue({
    purchase_email: { status: "outdated", label: "Email", revision: "old" },
  });
  const template = vi.spyOn(client, "automationTemplate").mockResolvedValue({
    path: "example.yaml",
    yaml: "# Version history:\n# v4: Handle forwards\n# v3: <img src=x>\n# End version history\nblueprint: {}",
  });
  element = document.createElement(
    "kaleidescape-automation-blueprints",
  ) as AutomationBlueprints;
  element.client = client;
  element.scope = info;
  element.versionsOnly = true;
  document.body.append(element);
  await vi.waitFor(() =>
    expect(element.shadowRoot!.querySelector("tbody tr button")).not.toBeNull(),
  );
  element
    .shadowRoot!.querySelector<HTMLButtonElement>("tbody tr button")!
    .click();
  await vi.waitFor(() =>
    expect(element.shadowRoot!.querySelector("dialog")!.textContent).toContain(
      "v4: Handle forwards",
    ),
  );
  const dialog = element.shadowRoot!.querySelector("dialog")!;
  expect(dialog.open).toBe(true);
  expect(dialog.textContent).toContain("v3: <img src=x>");
  expect(dialog.querySelector("img")).toBeNull();
  expect(template).toHaveBeenCalledWith(info, "purchase_email");
  [...dialog.querySelectorAll("button")]
    .find((button) => button.textContent!.trim() === "Close")!
    .click();
  expect(dialog.open).toBe(false);
});

it("discards history responses after administrator access changes", async () => {
  const client = new FixtureTransport().client();
  vi.spyOn(client, "automationStatuses").mockResolvedValue({
    purchase_email: { status: "current", label: "Email", revision: "current" },
  });
  let resolve!: (value: { path: string; yaml: string }) => void;
  vi.spyOn(client, "automationTemplate").mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  element = document.createElement(
    "kaleidescape-automation-blueprints",
  ) as AutomationBlueprints;
  element.client = client;
  element.scope = info;
  element.versionsOnly = true;
  document.body.append(element);
  await vi.waitFor(() =>
    expect(element.shadowRoot!.querySelector("tbody tr button")).not.toBeNull(),
  );
  element
    .shadowRoot!.querySelector<HTMLButtonElement>("tbody tr button")!
    .click();
  await vi.waitFor(() => expect(resolve).toBeDefined());
  element.scope = {
    ...info,
    permissions: { ...info.permissions, edit: false },
  };
  await element.updateComplete;
  resolve({
    path: "example.yaml",
    yaml: "# Version history:\n# v1: Late history\n# End version history",
  });
  await Promise.resolve();
  await element.updateComplete;
  expect(element.shadowRoot!.textContent).not.toContain("Late history");
  expect(element.shadowRoot!.querySelector("dialog")).toBeNull();
});
