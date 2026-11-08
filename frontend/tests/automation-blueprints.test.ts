import { afterEach, expect, it, vi } from "vitest";
import "../src/ui/automation-blueprints";
import type { AutomationBlueprints } from "../src/ui/automation-blueprints";
import { FixtureTransport, info } from "./fixture";
import { ApiError } from "../src/core/api";

let element: AutomationBlueprints;
afterEach(() => element?.remove());

async function reviewFixture(
  state: "outdated" | "modified" | "missing" = "outdated",
) {
  const client = new FixtureTransport().client();
  vi.spyOn(client, "automationStatuses").mockResolvedValue({
    purchase_email: {
      status: state,
      label: "Email",
      revision: state === "missing" ? null : "reviewed-revision",
      installed_version: state === "missing" ? null : 7,
      latest_version: 8,
    },
  });
  const template = vi.spyOn(client, "automationTemplate").mockResolvedValue({
    path: "fictional.yaml",
    yaml: "# Version history:\n# v8: Require HTML and explain missing items\n# v7: Previous extraction\n# End version history\nblueprint: {}",
  });
  const update = vi
    .spyOn(client, "updateAutomationBlueprint")
    .mockResolvedValue({});
  const install = vi
    .spyOn(client, "installAutomationBlueprint")
    .mockResolvedValue({ overrides_existing: false });
  element = document.createElement(
    "kaleidescape-automation-blueprints",
  ) as AutomationBlueprints;
  element.client = client;
  element.scope = info;
  document.body.append(element);
  await vi.waitFor(() =>
    expect(
      element.shadowRoot!.querySelector(
        '[data-blueprint="purchase_email"] button',
      ),
    ).not.toBeNull(),
  );
  return { client, template, update, install };
}

it.each(["outdated", "modified"] as const)(
  "shows versions and a readable change log before accepting an %s blueprint",
  async (state) => {
    const { update } = await reviewFixture(state);
    element
      .shadowRoot!.querySelector<HTMLButtonElement>(
        '[data-blueprint="purchase_email"] button',
      )!
      .click();
    await vi.waitFor(() =>
      expect(
        element.shadowRoot!.querySelector<HTMLButtonElement>("dialog .primary")
          ?.disabled,
      ).toBe(false),
    );
    const dialog = element.shadowRoot!.querySelector("dialog")!;
    expect(dialog.textContent).toContain("v7");
    expect(dialog.textContent).toContain("v8");
    expect(dialog.querySelector(".history-list")!.textContent).toContain(
      "Require HTML",
    );
    if (state === "outdated")
      expect(dialog.querySelector(".history-list")!.textContent).not.toContain(
        "Previous extraction",
      );
    else expect(dialog.textContent).toContain("may discard local edits");
    expect(update).not.toHaveBeenCalled();
    dialog.querySelector<HTMLButtonElement>(".primary")!.click();
    await vi.waitFor(() =>
      expect(update).toHaveBeenCalledWith(
        info,
        "purchase_email",
        "reviewed-revision",
      ),
    );
  },
);

it("blocks confirmation when the change log fails and preserves conflict checks after retry", async () => {
  const { template, update } = await reviewFixture();
  template.mockRejectedValueOnce(new ApiError("connection_lost"));
  update.mockRejectedValue(new ApiError("conflict"));
  element
    .shadowRoot!.querySelector<HTMLButtonElement>(
      '[data-blueprint="purchase_email"] button',
    )!
    .click();
  await vi.waitFor(() =>
    expect(
      element.shadowRoot!.querySelector("dialog [role=alert]"),
    ).not.toBeNull(),
  );
  expect(
    element.shadowRoot!.querySelector<HTMLButtonElement>("dialog .primary")!
      .disabled,
  ).toBe(true);
  expect(update).not.toHaveBeenCalled();
  [...element.shadowRoot!.querySelectorAll<HTMLButtonElement>("dialog button")]
    .find((button) => button.textContent?.trim() === "Retry change log")!
    .click();
  await vi.waitFor(() =>
    expect(
      element.shadowRoot!.querySelector<HTMLButtonElement>("dialog .primary")!
        .disabled,
    ).toBe(false),
  );
  element
    .shadowRoot!.querySelector<HTMLButtonElement>("dialog .primary")!
    .click();
  await vi.waitFor(() =>
    expect(element.shadowRoot!.querySelector("dialog")!.open).toBe(false),
  );
  expect(update).toHaveBeenCalledTimes(1);
  expect(element.shadowRoot!.querySelector("[role=alert]")).not.toBeNull();
});

it("reviews a missing blueprint before installation and blocks closing while a write is pending", async () => {
  const { install, update } = await reviewFixture("missing");
  let finish!: (value: { overrides_existing: boolean }) => void;
  install.mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  const busy = vi.fn();
  element.addEventListener("blueprint-busy", busy);
  element
    .shadowRoot!.querySelector<HTMLButtonElement>(
      '[data-blueprint="purchase_email"] button',
    )!
    .click();
  await vi.waitFor(() =>
    expect(
      element.shadowRoot!.querySelector<HTMLButtonElement>("dialog .primary")
        ?.disabled,
    ).toBe(false),
  );
  const dialog = element.shadowRoot!.querySelector("dialog")!;
  expect(dialog.textContent).toContain(
    "does not create or enable an automation",
  );
  expect(install).not.toHaveBeenCalled();
  dialog.querySelector<HTMLButtonElement>(".primary")!.click();
  await vi.waitFor(() => expect(install).toHaveBeenCalledOnce());
  expect(element.confirmNavigation()).toBe(false);
  expect(dialog.dispatchEvent(new Event("cancel", { cancelable: true }))).toBe(
    false,
  );
  expect(busy.mock.calls[0][0].detail).toBe(true);
  finish({ overrides_existing: false });
  await vi.waitFor(() => expect(dialog.open).toBe(false));
  expect(element.confirmNavigation()).toBe(true);
  expect(busy.mock.calls.at(-1)![0].detail).toBe(false);
  expect(update).not.toHaveBeenCalled();
});

it("loads and installs the maintenance blueprint through its review", async () => {
  const transport = new FixtureTransport();
  transport.blueprintStatuses.maintenance_schedule = {
    ...transport.blueprintStatuses.maintenance_schedule,
    status: "missing",
    installed_version: null,
  };
  element = document.createElement(
    "kaleidescape-automation-blueprints",
  ) as AutomationBlueprints;
  element.client = transport.client();
  element.scope = info;
  document.body.append(element);
  await vi.waitFor(() =>
    expect(
      element.shadowRoot!.querySelector(
        '[data-blueprint="maintenance_schedule"] button',
      ),
    ).not.toBeNull(),
  );
  element
    .shadowRoot!.querySelector<HTMLButtonElement>(
      '[data-blueprint="maintenance_schedule"] button',
    )!
    .click();
  await vi.waitFor(() =>
    expect(
      element.shadowRoot!.querySelector<HTMLButtonElement>("dialog .primary")
        ?.disabled,
    ).toBe(false),
  );
  expect(element.shadowRoot!.querySelector("dialog")!.textContent).toContain(
    "Initial optional automation",
  );
  element
    .shadowRoot!.querySelector<HTMLButtonElement>("dialog .primary")!
    .click();
  await vi.waitFor(() =>
    expect(transport.blueprintStatuses.maintenance_schedule.status).toBe(
      "current",
    ),
  );
  expect(transport.calls).toContainEqual(
    expect.objectContaining({
      type: "kaleidescape_companion/automations/template",
      template: "maintenance_schedule",
    }),
  );
  expect(transport.calls).toContainEqual(
    expect.objectContaining({
      type: "blueprint/save",
      path: "kaleidescape_companion/maintenance_schedule.yaml",
    }),
  );
});

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
  await vi.waitFor(() =>
    expect(element.shadowRoot!.textContent).toContain("v1:"),
  );
  expect(element.shadowRoot!.textContent).toContain(
    "replaces the installed blueprint",
  );
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
  expect(
    element.shadowRoot!.querySelector('[data-blueprint="calendar_schedule"]')!
      .textContent,
  ).toContain("Not installed");
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

it.each(["disconnect", "replace client", "revoke permission"])(
  "does not save a retrieved template after %s",
  async (change) => {
    const client = new FixtureTransport().client();
    const replacement = new FixtureTransport().client();
    vi.spyOn(client, "automationStatuses").mockResolvedValue({
      library_schedule: { status: "missing", label: "Library", revision: null },
    });
    let release!: (value: { path: string; yaml: string }) => void;
    vi.spyOn(client, "automationTemplate").mockReturnValue(
      new Promise((resolve) => (release = resolve)),
    );
    const save = vi.spyOn(client, "installAutomationBlueprint");
    const otherSave = vi.spyOn(replacement, "installAutomationBlueprint");
    element = document.createElement(
      "kaleidescape-automation-blueprints",
    ) as AutomationBlueprints;
    element.client = client;
    element.scope = { ...info, permissions: { ...info.permissions } };
    document.body.append(element);
    await vi.waitFor(() =>
      expect(
        element.shadowRoot!.querySelector(
          '[data-blueprint="library_schedule"] button',
        ),
      ).not.toBeNull(),
    );
    element
      .shadowRoot!.querySelector<HTMLButtonElement>(
        '[data-blueprint="library_schedule"] button',
      )!
      .click();
    await vi.waitFor(() => expect(release).toBeDefined());
    if (change === "disconnect") element.remove();
    if (change === "replace client") element.client = replacement;
    if (change === "revoke permission")
      element.scope = {
        ...element.scope!,
        permissions: { ...info.permissions, edit: false },
      };
    release({ path: "fictional.yaml", yaml: "fictional" });
    await element.updateComplete;
    await Promise.resolve();
    expect(save).not.toHaveBeenCalled();
    expect(otherSave).not.toHaveBeenCalled();
  },
);

it("does not show a stale result after a blueprint save was transmitted", async () => {
  const client = new FixtureTransport().client();
  vi.spyOn(client, "automationStatuses").mockResolvedValue({
    library_schedule: { status: "missing", label: "Library", revision: null },
  });
  vi.spyOn(client, "automationTemplate").mockResolvedValue({
    path: "fictional.yaml",
    yaml: "fictional",
  });
  let finish!: (value: { overrides_existing: boolean }) => void;
  const save = vi
    .spyOn(client, "installAutomationBlueprint")
    .mockReturnValue(new Promise((resolve) => (finish = resolve)));
  element = document.createElement(
    "kaleidescape-automation-blueprints",
  ) as AutomationBlueprints;
  element.client = client;
  element.scope = info;
  document.body.append(element);
  await vi.waitFor(() =>
    expect(
      element.shadowRoot!.querySelector(
        '[data-blueprint="library_schedule"] button',
      ),
    ).not.toBeNull(),
  );
  element
    .shadowRoot!.querySelector<HTMLButtonElement>(
      '[data-blueprint="library_schedule"] button',
    )!
    .click();
  await vi.waitFor(() =>
    expect(
      element.shadowRoot!.querySelector<HTMLButtonElement>("dialog .primary")
        ?.disabled,
    ).toBe(false),
  );
  element
    .shadowRoot!.querySelector<HTMLButtonElement>("dialog .primary")!
    .click();
  await vi.waitFor(() => expect(save).toHaveBeenCalledOnce());
  element.scope = { ...info, entry_id: "new-scope" };
  finish({ overrides_existing: false });
  await element.updateComplete;
  await Promise.resolve();
  expect(save).toHaveBeenCalledOnce();
  expect(element.shadowRoot!.textContent).not.toContain("blueprint installed");
});
