/** Native HA installation, limited to a freshly generated, uniquely named dashboard. */
import { errorCode } from "./api";
import type { JournalClient, TestDashboardPlan } from "./api";

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}
export class DashboardSetupError extends Error {}

export class DashboardInstaller {
  private attempted = false;
  private created = false;
  constructor(
    private client: JournalClient,
    readonly plan: TestDashboardPlan,
  ) {
    if (
      !/^companion-test-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(
        plan.url_path,
      ) ||
      new TextEncoder().encode(plan.yaml).length > 262144
    )
      throw new DashboardSetupError("Invalid generated dashboard artifact");
  }
  async install(current: () => boolean) {
    const active = () => {
      if (!current())
        throw new DashboardSetupError(
          "Dashboard setup stopped because the HA account or dataset changed.",
        );
    };
    const dashboards = await this.client.haDashboards();
    active();
    const existing = dashboards.find(
      (item) => item.url_path === this.plan.url_path,
    );
    if (
      existing &&
      (!this.attempted ||
        existing.title !== this.plan.title ||
        existing.mode !== "storage" ||
        existing.icon !== "mdi:test-tube" ||
        existing.require_admin !== false ||
        existing.show_in_sidebar !== true)
    )
      throw new DashboardSetupError(
        "The dashboard URL already exists or its settings changed. Existing dashboards are never replaced.",
      );
    if (!existing) {
      if (this.created)
        throw new DashboardSetupError(
          "The newly created dashboard was removed. Start a new generation request.",
        );
      if (this.attempted)
        throw new DashboardSetupError(
          "Creation was already attempted, but HA has not exposed the result. Wait and check again or inspect Dashboards; no second create was sent.",
        );
      this.attempted = true;
      await this.client.createHATestDashboard(this.plan);
      active();
      this.created = true;
    }
    let saved: Record<string, unknown> | undefined;
    try {
      saved = await this.client.haTestDashboardConfig(this.plan.url_path);
      active();
    } catch (error) {
      active();
      if (errorCode(error) !== "config_not_found") throw error;
    }
    if (saved) {
      if (canonical(saved) === canonical(this.plan.config)) return;
      throw new DashboardSetupError(
        "This dashboard already contains different content. It was not overwritten. Inspect it in HA dashboard settings.",
      );
    }
    // An uncertain creation is recoverable only at our unique, previously attempted
    // URL with unchanged metadata and no stored content. Never delete on failure.
    if (!this.created && !existing)
      throw new DashboardSetupError("Could not verify the new dashboard");
    await this.client.saveHATestDashboard(this.plan);
    active();
    const verified = await this.client.haTestDashboardConfig(
      this.plan.url_path,
    );
    active();
    if (canonical(verified) !== canonical(this.plan.config))
      throw new DashboardSetupError(
        "The saved dashboard could not be verified. Inspect it before continuing.",
      );
  }
}
