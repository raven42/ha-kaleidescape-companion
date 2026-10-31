/** Household playback with private administrator discovery and durable outcomes. */
import { LitElement, css, html, nothing } from "lit";
import type { PropertyValues } from "lit";
import { errorCode, errorMessage } from "../core/api";
import type {
  JournalClient,
  JournalInfo,
  ControlInfo,
  ControlReview,
  ControlResult,
  PreparedMutation,
} from "../core/api";
import { styles } from "../ui/styles";
import { dismissBackdrop } from "../ui/dialog";

const COMMANDS = [
  ["play", "Play selection"],
  ["pause", "Pause"],
  ["resume", "Resume"],
  ["stop", "Stop"],
  ["previous", "Previous chapter"],
  ["next", "Next chapter"],
  ["up", "Up"],
  ["left", "Left"],
  ["select", "Select"],
  ["right", "Right"],
  ["down", "Down"],
  ["back", "Back"],
  ["menu", "Menu"],
  ["movies", "Movie covers"],
  ["power_on", "Power on"],
  ["power_off", "Standby"],
];
const OUTCOMES: Record<ControlResult["outcome"], string> = {
  state_observed: "The requested playback state was observed.",
  acknowledged:
    "The player accepted the command; its final state is not confirmed.",
  unconfirmed:
    "The command may have executed. An administrator must inspect the player before more commands can be sent. Nothing will be replayed automatically.",
  rejected: "The player rejected the command. Nothing was retried.",
  not_sent:
    "Settings or access changed before sending. The command was not sent.",
};

export class DeviceControls extends LitElement {
  static properties = {
    client: { attribute: false },
    scope: { attribute: false },
    mode: {},
    versionId: {},
    value: {},
    configured: { type: Boolean },
  };
  static styles = [
    styles,
    css`
      .control-card {
        margin-top: 20px;
        padding: 20px;
      }
      .control-card > .card-head {
        padding: 0 0 16px;
        flex-wrap: wrap;
      }
      .movie-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        align-items: center;
      }
      .movie-actions button {
        border-radius: 999px;
        padding: 10px 20px;
      }
      .play-movie {
        display: inline-flex;
        align-items: center;
        gap: 10px;
      }
      .play-movie svg {
        width: 20px;
        height: 20px;
      }
      .player-options {
        display: grid;
        gap: 10px;
        margin: 20px 0;
      }
      .player-choice {
        text-align: left;
        padding: 14px;
        border-radius: 10px;
      }
      .player-choice small {
        display: block;
      }
      .player-target {
        margin: 8px 0 0;
        font-size: 12px;
      }
    `,
  ];
  client?: JournalClient;
  scope?: JournalInfo;
  mode = "remote";
  versionId = "";
  value = "";
  configured = true;
  private generation = 0;
  private key = "";
  private boundClient?: JournalClient;
  private info?: ControlInfo;
  private state?: ControlReview["before"];
  private pending?: PreparedMutation;
  private selectedPlayer = "";
  private acknowledge = "";
  private busy = false;
  private error = "";
  private notice = "";
  private locked = false;

  protected willUpdate(changed: PropertyValues) {
    if (!["scope", "client", "versionId"].some((name) => changed.has(name)))
      return;
    const key = this.scope?.permissions.read
      ? `${this.scope.entry_id}:${this.scope.dataset_id}:${!!this.scope.permissions.edit}:${this.versionId}`
      : "";
    if (key !== this.key || this.client !== this.boundClient) {
      // Changing the version invalidates its preflight, but retains the chosen player.
      if (
        this.client !== this.boundClient ||
        !this.key ||
        !key ||
        this.key.split(":").slice(0, 3).join(":") !==
          key.split(":").slice(0, 3).join(":")
      )
        this.selectedPlayer = "";
      this.generation++;
      this.key = key;
      this.boundClient = this.client;
      this.info = this.state = this.pending = undefined;
      this.busy = false;
      this.acknowledge = this.error = this.notice = "";
      if (key && this.client) void this.load();
    }
  }
  protected updated() {
    const locked = this.busy || !!this.pending;
    if (locked === this.locked) return;
    this.locked = locked;
    this.dispatchEvent(
      new CustomEvent("control-lock", {
        detail: locked,
        bubbles: true,
        composed: true,
      }),
    );
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    this.generation++;
    this.pending = this.info = undefined;
  }
  private fail(error: unknown) {
    const code = errorCode(error);
    const messages: Record<string, string> = {
      control_disabled:
        "Playback controls are disabled. Ask an administrator to enable them.",
      control_player:
        "No player is configured. Ask an administrator to discover and select one.",
      control_unreachable:
        "The player could not be reached. Inspect its connection and state.",
      control_identity:
        "Live device/movie identity did not match. Refresh the selected player.",
      control_source:
        "Title playback requires the control seed to match the Library host.",
      control_handle:
        "This version has no verified playback-handle mapping yet.",
      control_launch_disabled:
        "Experimental Library playback is disabled in integration settings.",
      control_uncertain:
        "An administrator must inspect and acknowledge the previous uncertain command.",
      control_limit:
        "Control receipt storage is full. Administrator maintenance is required.",
    };
    this.error = messages[code] ?? errorMessage(error);
    if (code === "unauthorized") {
      this.generation++;
      this.info = this.pending = this.state = undefined;
      this.selectedPlayer = "";
      this.dispatchEvent(
        new CustomEvent("access-denied", { bubbles: true, composed: true }),
      );
    }
  }
  private async load() {
    const generation = this.generation;
    try {
      const info = await this.client!.controlInfo(this.scope!);
      if (generation !== this.generation) return;
      this.info = info;
      if (!info.players.some((player) => player.id === this.selectedPlayer))
        this.selectedPlayer = info.default_player;
    } catch (error) {
      if (generation === this.generation) this.fail(error);
    }
    if (generation === this.generation) this.requestUpdate();
  }
  private async action(work: () => Promise<void>) {
    if (this.busy || !this.client || !this.scope?.permissions.read) return;
    const generation = this.generation;
    this.busy = true;
    this.error = "";
    this.requestUpdate();
    try {
      await work();
    } catch (error) {
      if (generation === this.generation) this.fail(error);
    } finally {
      if (generation === this.generation) {
        this.busy = false;
        this.requestUpdate();
      }
    }
  }
  private async discover() {
    if (!this.scope?.permissions.edit) return;
    await this.action(async () => {
      const generation = this.generation;
      const info = await this.client!.controlDiscover(this.scope!);
      if (generation === this.generation) this.info = info;
    });
  }
  private async refresh() {
    await this.action(async () => {
      const generation = this.generation;
      const result = await this.client!.controlStatus(
        this.scope!,
        this.selectedPlayer || undefined,
      );
      if (generation === this.generation) {
        this.state = result.state;
        await this.load();
      }
    });
  }
  private async prepare(operation: string) {
    if (this.pending) return;
    await this.action(async () => {
      const generation = this.generation;
      const review = await this.client!.controlPrepare(
        this.scope!,
        operation,
        this.versionId || undefined,
        this.selectedPlayer || undefined,
      );
      if (generation !== this.generation) return;
      // Preflight is automatic; the explicit command click is the user's intent.
      this.pending = this.client!.prepareControl(this.scope!, review.token);
      await this.send();
    });
  }
  private async send() {
    if (!this.pending) return;
    const generation = this.generation;
    const result = await this.client!.controlExecute(this.pending);
    if (generation !== this.generation) return;
    this.notice = OUTCOMES[result.outcome];
    this.pending = undefined;
    await this.load();
  }
  private close(event?: Event) {
    if (this.busy) {
      event?.preventDefault();
      return;
    }
    this.acknowledge = "";
    this.renderRoot.querySelector<HTMLDialogElement>("dialog")?.close();
  }
  private async choosePlayer() {
    if (this.busy || this.pending) return;
    const generation = this.generation;
    this.acknowledge = "";
    this.requestUpdate();
    await this.updateComplete;
    if (generation !== this.generation || !this.isConnected) return;
    this.renderRoot.querySelector<HTMLDialogElement>("dialog")?.showModal();
  }
  private async reviewPending(request: string) {
    const generation = this.generation;
    this.acknowledge = request;
    this.requestUpdate();
    await this.updateComplete;
    if (generation !== this.generation || !this.isConnected) return;
    this.renderRoot.querySelector<HTMLDialogElement>("dialog")?.showModal();
  }
  private async confirmReview() {
    if (!this.acknowledge || !this.info?.can_manage) return;
    await this.action(async () => {
      const generation = this.generation;
      await this.client!.controlAcknowledge(this.scope!, this.acknowledge);
      if (generation !== this.generation) return;
      this.acknowledge = "";
      this.renderRoot.querySelector<HTMLDialogElement>("dialog")?.close();
      await this.load();
    });
  }
  protected render() {
    if (
      !this.scope?.permissions.read ||
      (this.mode === "settings" && !this.scope.permissions.edit)
    )
      return nothing;
    const info = this.info;
    if (this.mode === "movie" && (!info?.enabled || !info.allow_launch))
      return html`<slot name="collection"></slot>`;
    const devices = info?.devices?.filter((device) => device.is_player) ?? [];
    const player = info?.players.find(
      (item) => item.id === this.selectedPlayer,
    );
    const blocked = info?.blocked_players.includes(this.selectedPlayer);
    const disabled =
      this.busy ||
      !info?.enabled ||
      !this.selectedPlayer ||
      !!this.pending ||
      blocked;
    return html`<section
      class=${this.mode === "remote" ? "card control-card" : "device-controls"}
    >
      ${
        this.mode === "remote"
          ? html`<div class="card-head">
              <h2>Player controls</h2>
              <button
                ?disabled=${this.busy || !info?.enabled || !this.selectedPlayer}
                @click=${this.refresh}
              >
                Refresh player state</button
              ><button
                ?disabled=${this.busy || !info?.enabled || !!this.pending}
                @click=${this.choosePlayer}
              >
                Choose Player
              </button>
            </div>`
          : nothing
      }
      ${
        this.mode === "settings"
          ? html`
              <div class="actions">
                <button
                  type="button"
                  ?disabled=${this.busy || !info?.enabled || !this.configured}
                  @click=${this.discover}
                >
                  ${this.busy ? "Discovering…" : "Discover devices"}
                </button>
              </div>
              ${!info?.enabled || !this.configured ? html`<p class="muted">Save the enabled control hostname before discovering devices.</p>` : nothing}
              <label
                >Default player<select
                  name="control_player"
                  .value=${this.value}
                  ?disabled=${this.busy}
                  @change=${(event: Event) => this.dispatchEvent(new CustomEvent("player-selected", { detail: (event.target as HTMLSelectElement).value, bubbles: true, composed: true }))}
                >
                  <option value="">No default player selected</option>
                  ${this.value && !devices.some((device) => device.serial === this.value) ? html`<option value=${this.value}>Configured player (${this.value})</option>` : nothing}
                  ${devices.map((device) => html`<option value=${device.serial}>${device.name} (${device.serial})</option>`)}
                </select></label
              >
              ${
                info?.devices?.length
                  ? html`<details>
                      <summary>
                        Discovered components (${info.devices.length})
                      </summary>
                      <ul>
                        ${info.devices.map((device) => html`<li>${device.name} · ${device.model} · ${device.ipaddress} · ${device.is_player ? "Player" : "Server/component"}</li>`)}
                      </ul>
                    </details>`
                  : nothing
              }
            `
          : this.mode === "movie"
            ? html`
                <div class="movie-actions">
                  <button
                    type="button"
                    class="primary play-movie"
                    ?disabled=${disabled}
                    title=${`Play on ${player?.name || "the selected player"}`}
                    @click=${() => this.prepare("launch")}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <circle
                        cx="12"
                        cy="12"
                        r="10"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                      />
                      <path d="M10 7v10l7-5z" fill="currentColor" /></svg
                    >Play Movie</button
                  ><button
                    type="button"
                    ?disabled=${this.busy || !!this.pending}
                    @click=${this.choosePlayer}
                  >
                    Choose Player</button
                  ><slot name="collection"></slot>
                </div>
                <p class="muted player-target">
                  ${player ? `On ${player.name}` : "Choose a player to start playback"}
                </p>
              `
            : !info?.enabled
              ? html`<p class="muted">Playback controls are disabled.</p>`
              : html`
                  <p>Target: ${player?.name || "No player selected"}</p>
                  ${this.state ? html`<p>${this.state.title || "No movie playing"} · ${({ 0: "Stopped", 1: "Paused", 2: "Playing", 4: "Forward scan", 6: "Reverse scan" } as Record<number, string>)[this.state.mode] ?? "Unknown state"}</p>` : nothing}
                  <div class="actions">
                    ${COMMANDS.map(([operation, label]) => html`<button type="button" ?disabled=${disabled} @click=${() => this.prepare(operation)}>${label}</button>`)}
                  </div>
                `
      }
      ${this.error ? html`<p class="error" role="alert">${this.error}</p>` : nothing}
      ${
        this.pending
          ? html`<p class="warning">
                The result is not confirmed. Check the same request; it will not
                replay an accepted command.
              </p>
              <button
                ?disabled=${this.busy}
                @click=${() => this.action(() => this.send())}
              >
                Check command result
              </button>`
          : nothing
      }
      ${this.notice ? html`<p role="status">${this.notice}</p>` : nothing}
      ${blocked && !info?.can_manage ? html`<p class="warning">This player needs administrator review of an uncertain command before more commands can be sent.</p>` : nothing}
      ${info?.can_manage ? info.pending.map((item) => html`<p class="warning">Unconfirmed ${item.operation} for ${info.players.find((row) => row.id === item.player_id)?.name || "a previously selected player"}. <button type="button" ?disabled=${this.busy} @click=${() => this.reviewPending(item.request_id)}>I inspected the player…</button></p>`) : nothing}
      <dialog
        class="database-dialog"
        @click=${dismissBackdrop}
        @cancel=${this.close}
      >
        <div class="card-head">
          <h2>
            ${this.acknowledge ? "Review unconfirmed command" : "Choose Player"}
          </h2>
        </div>
        ${
          this.acknowledge
            ? html`<p>
                Confirm you inspected the physical player. This permits new
                commands and does not resend the earlier command.
              </p>`
            : html`
                <p class="muted">
                  Choose where to play. This does not change the household
                  default player or Journal tracking.
                </p>
                <div class="player-options">
                  ${info?.players.map(
                    (item) =>
                      html`<button
                        class="player-choice"
                        type="button"
                        aria-pressed=${item.id === this.selectedPlayer}
                        @click=${() => {
                          this.selectedPlayer = item.id;
                          this.state = undefined;
                          this.close();
                          this.requestUpdate();
                        }}
                      >
                        ${item.name}${item.model ? html`<small>${item.model}</small>` : nothing}${item.id === info.default_player ? html`<small>Household default</small>` : nothing}
                      </button>`,
                  )}
                </div>
                ${!info?.players.length ? html`<p>No players are available. Ask an administrator to discover devices in Settings.</p>` : nothing}
              `
        }
        <div class="dialog-footer">
          <button type="button" ?disabled=${this.busy} @click=${this.close}>
            Done</button
          >${this.acknowledge ? html`<button type="button" class="primary" ?disabled=${this.busy} @click=${this.confirmReview}>Acknowledge review</button>` : nothing}
        </div>
      </dialog>
    </section>`;
  }
}
if (!customElements.get("kaleidescape-device-controls"))
  customElements.define("kaleidescape-device-controls", DeviceControls);
