/** Native dashboard writes stay isolated, retryable, scoped and non-destructive. */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import "../src/ui/test-dashboard";
import type { TestDashboard } from "../src/ui/test-dashboard";
import { ApiError, JournalClient } from "../src/core/api";
import type {
  ApiMessage,
  HADashboard,
  TestDashboardPlan,
} from "../src/core/api";
import { DashboardInstaller } from "../src/core/test-dashboard";
import { info } from "./fixture";
const id = "12345678-1234-4234-8234-123456789abc";
const plan: TestDashboardPlan = {
  title: "Fictional guide",
  url_path: `companion-test-${id}`,
  yaml: "title: Fictional guide\nviews: []\n",
  views: ["Guide", "Remote"],
  config: {
    title: "Fictional guide",
    kaleidescape_companion_test: { request_id: id },
    views: [],
  },
};
let metadata: HADashboard | undefined;
let stored: Record<string, unknown> | undefined;
let calls: ApiMessage[];
let client: JournalClient;
let handler: (message: ApiMessage) => Promise<unknown>;
let element: TestDashboard | undefined;
const root = () => element!.shadowRoot!;
const button = (label: string) =>
  [...root().querySelectorAll<HTMLButtonElement>("button")].find(
    (node) => node.textContent?.trim() === label,
  )!;
beforeEach(() => {
  metadata = undefined;
  stored = undefined;
  calls = [];
  handler = async (message) => {
    if (message.type.endsWith("dashboard/preview")) return plan;
    if (message.type.endsWith("dashboard/verify"))
      return { url_path: plan.url_path, views: 7 };
    if (message.type === "lovelace/dashboards/list")
      return metadata ? [metadata] : [];
    if (message.type === "lovelace/dashboards/create") {
      metadata = {
        id: plan.url_path,
        url_path: plan.url_path,
        title: plan.title,
        mode: "storage",
        icon: "mdi:test-tube",
        require_admin: false,
        show_in_sidebar: true,
      };
      return metadata;
    }
    if (message.type === "lovelace/config") {
      if (!stored) throw new ApiError("config_not_found");
      return structuredClone(stored);
    }
    if (message.type === "lovelace/config/save") {
      stored = structuredClone(message.config) as Record<string, unknown>;
      return null;
    }
    throw new Error("Unexpected request");
  };
  client = new JournalClient({
    callWS: async (message) => {
      calls.push(structuredClone(message));
      return (await handler(message)) as never;
    },
    fetchWithAuth: async () => {
      throw new Error("No HTTP expected");
    },
  });
});
afterEach(() => {
  element?.remove();
  element = undefined;
  vi.restoreAllMocks();
});
async function mount(admin = true) {
  element = document.createElement(
    "kaleidescape-test-dashboard",
  ) as TestDashboard;
  element.client = client;
  element.scope = {
    ...info,
    permissions: { read: true, edit: admin, export: admin },
  };
  document.body.append(element);
  await element.updateComplete;
}
it("creates exactly one new dashboard, saves the generated config and verifies it", async () => {
  const installer = new DashboardInstaller(client, plan);
  await installer.install(() => true);
  await installer.install(() => true);
  expect(
    calls.filter((call) => call.type === "lovelace/dashboards/create"),
  ).toHaveLength(1);
  expect(
    calls.filter((call) => call.type === "lovelace/config/save"),
  ).toHaveLength(1);
  expect(stored).toEqual(plan.config);
  expect(calls.some((call) => /delete|control|sync/.test(call.type))).toBe(
    false,
  );
});
it("recovers an unconfirmed create without duplicating or deleting the dashboard", async () => {
  const original = handler;
  let uncertain = true;
  handler = async (message) => {
    const result = await original(message);
    if (uncertain && message.type === "lovelace/dashboards/create") {
      uncertain = false;
      throw new ApiError("connection_lost");
    }
    return result;
  };
  const installer = new DashboardInstaller(client, plan);
  await expect(installer.install(() => true)).rejects.toMatchObject({
    code: "connection_lost",
  });
  await installer.install(() => true);
  expect(
    calls.filter((call) => call.type === "lovelace/dashboards/create"),
  ).toHaveLength(1);
  expect(stored).toEqual(plan.config);
});
it("recovers an unconfirmed save by reading existing content before retrying", async () => {
  const original = handler;
  let uncertain = true;
  handler = async (message) => {
    const result = await original(message);
    if (uncertain && message.type === "lovelace/config/save") {
      uncertain = false;
      throw new ApiError("connection_lost");
    }
    return result;
  };
  const installer = new DashboardInstaller(client, plan);
  await expect(installer.install(() => true)).rejects.toBeDefined();
  await installer.install(() => true);
  expect(
    calls.filter((call) => call.type === "lovelace/config/save"),
  ).toHaveLength(1);
});
it("never replaces pre-existing or subsequently edited dashboard content", async () => {
  await handler({ type: "lovelace/dashboards/create" });
  await expect(
    new DashboardInstaller(client, plan).install(() => true),
  ).rejects.toThrow("already exists");
  metadata = undefined;
  const installer = new DashboardInstaller(client, plan);
  await installer.install(() => true);
  stored = { ...stored, title: "Manually edited" };
  await expect(installer.install(() => true)).rejects.toThrow(
    "different content",
  );
  expect(stored.title).toBe("Manually edited");
  expect(calls.some((call) => call.type.endsWith("/delete"))).toBe(false);
});
it("stops after account changes before issuing a native write", async () => {
  await expect(
    new DashboardInstaller(client, plan).install(() => false),
  ).rejects.toThrow("account or dataset changed");
  expect(calls.map((call) => call.type)).toEqual(["lovelace/dashboards/list"]);
});
it("prompts for the name and exposes Open/YAML only after preparing the scoped guide", async () => {
  await mount();
  button("Generate test dashboard").click();
  await element!.updateComplete;
  const field = root().querySelector<HTMLInputElement>("input")!;
  field.value = "Family guide";
  field.dispatchEvent(new Event("input"));
  button("Create test dashboard").click();
  await vi.waitFor(() =>
    expect(root().textContent).toContain("created and verified"),
  );
  expect(
    calls.find((call) => call.type.endsWith("dashboard/preview")),
  ).toMatchObject({
    entry_id: info.entry_id,
    dataset_id: info.dataset_id,
    name: "Family guide",
  });
  expect(root().querySelector("a")?.getAttribute("href")).toBe(
    `/${plan.url_path}`,
  );
  expect(button("Download YAML")).toBeDefined();
  expect(element!.confirmNavigation()).toBe(true);
});
it("shows actionable preflight errors without creating anything and hides generation from readers", async () => {
  handler = async () => {
    throw {
      code: "dashboard_prerequisites",
      message: "Sync at least one Library movie first.",
    };
  };
  await mount();
  button("Generate test dashboard").click();
  button("Create test dashboard").click();
  await vi.waitFor(() =>
    expect(root().textContent).toContain("Sync at least one Library movie"),
  );
  expect(calls.some((call) => call.type.startsWith("lovelace/"))).toBe(false);
  element!.scope = {
    ...info,
    permissions: { read: true, edit: false, export: false },
  };
  await element!.updateComplete;
  expect(root().querySelector("button")).toBeNull();
});

it("does not issue a second create when an unconfirmed creation is not yet visible", async () => {
  const original = handler;
  handler = async (message) => {
    if (message.type === "lovelace/dashboards/create")
      throw new ApiError("connection_lost");
    return original(message);
  };
  const installer = new DashboardInstaller(client, plan);
  await expect(installer.install(() => true)).rejects.toBeDefined();
  await expect(installer.install(() => true)).rejects.toThrow(
    "no second create was sent",
  );
  expect(
    calls.filter((call) => call.type === "lovelace/dashboards/create"),
  ).toHaveLength(1);
});
