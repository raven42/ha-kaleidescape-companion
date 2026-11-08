/** HA calendar settings; destructive maintenance needs a dedicated-calendar opt-in. */
import { html, nothing } from "lit";
import { settingLabel } from "./settings-hint";
export function fullSyncSettings(
  draft: Record<string, string | number | boolean | string[]>,
  change: (patch: Record<string, string | number | boolean | string[]>) => void,
) {
  return html`<div class="switch-row">
      ${settingLabel("calendar_full_sync", "Enable Full Sync", "Reconcile a dedicated calendar against completed Journal entries. Unmatched events require repeated successful scans and at least 10 minutes of grace before deletion. Schedule runs in Automations or use Run Full Sync now; enabling this does not create a schedule.")}<input
        type="checkbox"
        role="switch"
        name="calendar_full_sync"
        id="calendar_full_sync"
        aria-describedby="calendar_full_sync-hint"
        .checked=${!!draft.calendar_full_sync}
        @change=${(event: Event) => change({ calendar_full_sync: (event.target as HTMLInputElement).checked, calendar_full_sync_dedicated: false })}
      />
    </div>
    ${
      draft.calendar_full_sync
        ? html`
            <p class="warning">
              <strong
                >Full Sync requires its own separate calendar. Events in the
                selected age window that do not match a completed database
                Journal entry will be permanently deleted.</strong
              >
            </p>
            <div class="check">
              <input
                type="checkbox"
                name="calendar_full_sync_dedicated"
                id="calendar_full_sync_dedicated"
                aria-describedby="calendar_full_sync_dedicated-hint"
                required
                .checked=${!!draft.calendar_full_sync_dedicated}
                @change=${(event: Event) => change({ calendar_full_sync_dedicated: (event.target as HTMLInputElement).checked })}
              />${settingLabel("calendar_full_sync_dedicated", "I assigned a separate dedicated calendar and understand unmatched events will be deleted.", "Use a calendar reserved for Companion. Full Sync may permanently delete unrelated events within its age window; this acknowledgement resets when you change the destination or toggle Full Sync.")}
            </div>
            <div class="grid settings-grid">
              <div class="setting-field">
                ${settingLabel("calendar_full_sync_months", "Full Sync age window · months", "Maintain 1–12 whole months of completed viewings. Older and future events remain outside the window, and recurring events are skipped. Increasing the window makes more events eligible for reconciliation and guarded deletion.")}<input
                  name="calendar_full_sync_months"
                  id="calendar_full_sync_months"
                  aria-describedby="calendar_full_sync_months-hint"
                  type="number"
                  min="1"
                  max="12"
                  step="1"
                  required
                  .value=${String(draft.calendar_full_sync_months ?? 3)}
                  @input=${(event: Event) => change({ calendar_full_sync_months: (event.target as HTMLInputElement).value })}
                />
              </div>
            </div>
          `
        : nothing
    }`;
}
