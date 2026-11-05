/** HA calendar settings; destructive maintenance needs a dedicated-calendar opt-in. */
import { html, nothing } from "lit";
export function fullSyncSettings(
  draft: Record<string, string | number | boolean | string[]>,
  change: (patch: Record<string, string | number | boolean | string[]>) => void,
) {
  return html`<label class="check"
      ><input
        type="checkbox"
        name="calendar_full_sync"
        .checked=${!!draft.calendar_full_sync}
        @change=${(event: Event) => change({ calendar_full_sync: (event.target as HTMLInputElement).checked, calendar_full_sync_dedicated: false })}
      />Full Sync · maintain the assigned calendar</label
    >
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
            <label class="check"
              ><input
                type="checkbox"
                name="calendar_full_sync_dedicated"
                required
                .checked=${!!draft.calendar_full_sync_dedicated}
                @change=${(event: Event) => change({ calendar_full_sync_dedicated: (event.target as HTMLInputElement).checked })}
              />I assigned a separate dedicated calendar and understand
              unmatched events will be deleted.</label
            >
            <div class="grid settings-grid">
              <label
                >Full Sync age window · months<input
                  name="calendar_full_sync_months"
                  type="number"
                  min="1"
                  max="12"
                  step="1"
                  required
                  .value=${String(draft.calendar_full_sync_months ?? 3)}
                  @input=${(event: Event) => change({ calendar_full_sync_months: Number((event.target as HTMLInputElement).value) })}
              /></label>
            </div>
            <p class="muted">
              Run Full Sync using its button or install the optional calendar
              automation below. Unmatched events require repeated successful
              scans and at least 10 minutes of grace before deletion. Older and
              future events are left outside this window; recurring events are
              skipped. Providers without event editing receive a verified
              replacement before the old event is removed.
            </p>
          `
        : nothing
    }`;
}
