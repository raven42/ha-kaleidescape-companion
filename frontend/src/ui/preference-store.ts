/** Actor-scoped UI setters save immediately; no browsing data goes into URLs. */
import { displayProfile } from "../core/display-profile";
import type { JournalClient, Scope } from "../core/api";

export class PreferenceStore {
  values: Record<string, unknown> = {};
  private revision = 0;
  readonly profile = displayProfile();
  private active = true;
  private inflight = 0;
  get unsettled() {
    return this.inflight > 0 || Object.keys(this.failed).length > 0;
  }
  private sequence = 0;
  private versions = new Map<string, number>();
  private failed: Record<string, unknown> = {};
  constructor(
    private client: JournalClient,
    private scope: Scope,
    private shared: boolean,
    private error: (error: unknown | null) => void,
    private area = "library",
  ) {}
  async load() {
    const data = await this.client.uiPreferences(
      this.scope,
      this.shared,
      this.area,
      this.profile,
    );
    if (this.active) {
      this.values = structuredClone(data.values);
      this.revision = data.revision;
    }
    return this.values;
  }
  set(patch: Record<string, unknown>) {
    if (!this.active) return;
    Object.assign(this.values, structuredClone(patch));
    const sequence = ++this.sequence;
    for (const key of Object.keys(patch)) {
      this.versions.set(key, sequence);
      delete this.failed[key];
    }
    let operation: Promise<{ revision: number }>;
    try {
      operation = this.client.saveUIPreferences(
        this.client.prepareUIPreferences(
          this.scope,
          this.shared,
          this.revision,
          patch,
          this.area,
          this.profile,
        ),
      );
    } catch (error) {
      operation = Promise.reject(error);
    }
    this.inflight++;
    void operation
      .then((result) => {
        if (!this.active) return;
        this.revision = Math.max(this.revision, result.revision);
        if (!Object.keys(this.failed).length) this.error(null);
      })
      .catch((error) => {
        if (!this.active) return;
        for (const [key, value] of Object.entries(patch))
          if (this.versions.get(key) === sequence) this.failed[key] = value;
        if (Object.keys(this.failed).length) this.error(error);
      })
      .finally(() => {
        this.inflight--;
      });
  }
  retry() {
    const patch = this.failed;
    this.failed = {};
    if (Object.keys(patch).length) this.set(patch);
  }
  dispose() {
    this.active = false;
    this.values = {};
    this.failed = {};
    this.versions.clear();
  }
}
