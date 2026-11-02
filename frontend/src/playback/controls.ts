/** Household playback with private administrator discovery and durable outcomes. */
import { LitElement, css, html, nothing } from "lit";
import type { PropertyValues } from "lit";
import { errorCode, errorMessage } from "../core/api";
import type {
  JournalClient,
  JournalInfo,
  ControlInfo,
  ControlStatus,
  ControlResult,
  PreparedMutation,
} from "../core/api";
import { styles } from "../ui/styles";
import { actionIcon } from "../ui/action-icons";
import { remoteControls, remoteStyles } from "./remote";
import { closeButton, dismissBackdrop } from "../ui/dialog";

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
    playerId: {},
    inlineRemote: { type: Boolean },
    value: {},
    configured: { type: Boolean },
  };
  static styles = [
    styles,
    remoteStyles,
    css`
      [hidden] {
        display: none !important;
      }
      .control-card {
        margin-top: 20px;
        padding: 20px;
      }
      .control-card > .card-head {
        padding: 0;
        flex-wrap: wrap;
      }
      .movie-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        align-items: center;
        margin-bottom: 12px;
      }
      .movie-actions button {
        border-radius: 999px;
        padding: 10px 20px;
        min-height: 44px;
        line-height: 20px;
      }
      .play-movie {
        display: inline-flex;
        align-items: center;
        gap: 10px;
      }
      .play-movie.is-power {
        background: #238548;
        border-color: #238548;
        color: #fff;
      }
      .play-movie.is-play {
        background: #008fb5;
        border-color: #008fb5;
        color: #fff;
      }
      .spinner {
        display: inline-block;
        animation: spin 1s linear infinite;
      }
      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .spinner {
          animation: none;
        }
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
      @media (max-width: 600px) {
        .control-card {
          margin-top: 12px;
          padding: 12px;
        }
        .movie-actions {
          gap: 8px;
        }
        .movie-actions button {
          padding-inline: 12px;
          font-size: 13px;
        }
      }
    `,
  ];
  client?: JournalClient;
  scope?: JournalInfo;
  mode = "remote";
  versionId = "";
  playerId = "";
  inlineRemote = false;
  value = "";
  configured = true;
  private generation = 0;
  private key = "";
  private boundClient?: JournalClient;
  private info?: ControlInfo;
  private status?: ControlStatus;
  private waking = false;
  private wakeTimer?: ReturnType<typeof setTimeout>;
  private wakeDeadline = 0;
  private started = "";
  private lastOperation = "";
  private pending?: PreparedMutation;
  private selectedPlayer = "";
  private dialog = "players";
  private acknowledge = "";
  private busy = false;
  private error = "";
  private notice = "";
  private locked = false;

  protected willUpdate(changed: PropertyValues) {
    if (
      !["scope", "client", "versionId", "playerId"].some((name) =>
        changed.has(name),
      )
    )
      return;
    const key = this.scope?.permissions.read
      ? `${this.scope.entry_id}:${this.scope.dataset_id}:${!!this.scope.permissions.edit}:${this.versionId}:${this.playerId}`
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
      this.info = this.status = this.pending = undefined;
      this.stopWaking();
      this.busy = false;
      this.acknowledge =
        this.error =
        this.notice =
        this.started =
        this.lastOperation =
          "";
      if (this.playerId) this.selectedPlayer = this.playerId;
      if (key && this.client) void this.load(true);
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
    this.stopWaking();
    this.pending = this.info = undefined;
  }
  private fail(error: unknown) {
    const code = errorCode(error);
    const messages: Record<string, string> = {
      control_disabled:
        "Playback controls are disabled. Ask an administrator to enable them.",
      control_player:
        "No player is configured. Ask an administrator to discover and select one.",
      control_not_ready:
        "The player is not ready. Power it on and wait for readiness before playing.",
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
      this.info = this.pending = this.status = undefined;
      this.selectedPlayer = "";
      this.dispatchEvent(
        new CustomEvent("access-denied", { bubbles: true, composed: true }),
      );
    }
  }
  private async load(readState = false) {
    const generation = this.generation;
    try {
      const info = await this.client!.controlInfo(this.scope!);
      if (generation !== this.generation) return;
      this.info = info;
      if (!info.players.some((player) => player.id === this.selectedPlayer))
        this.selectedPlayer = info.default_player || info.players[0]?.id || "";
      if (
        readState &&
        info.enabled &&
        this.selectedPlayer &&
        this.mode !== "settings"
      )
        await this.readStatus();
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
        await this.updateComplete;
        if (this.started) {
          const player = this.started;
          this.started = "";
          this.dispatchEvent(
            new CustomEvent("playback-started", {
              detail: player,
              bubbles: true,
              composed: true,
            }),
          );
        }
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
  private stopWaking() {
    clearTimeout(this.wakeTimer);
    this.wakeTimer = undefined;
    this.waking = false;
  }
  private async readStatus() {
    const generation = this.generation,
      player = this.selectedPlayer;
    const result = await this.client!.controlStatus(
      this.scope!,
      player || undefined,
    );
    if (generation === this.generation && player === this.selectedPlayer) {
      this.status = result;
      if (result.ready) this.stopWaking();
      else if (result.readiness === "starting" && !this.waking) {
        this.waking = true;
        this.wakeDeadline = Date.now() + 120000;
        this.wakeTimer = setTimeout(() => void this.pollWake(), 2000);
      }
      this.requestUpdate();
    }
  }
  private async pollWake() {
    const generation = this.generation;
    let delay = 2000;
    try {
      await this.readStatus();
    } catch {
      delay = 30000;
    } // Standby transitions can reset TCP; never replay the wake.
    if (generation !== this.generation || !this.waking || !this.isConnected)
      return;
    if (Date.now() >= this.wakeDeadline) {
      this.stopWaking();
      this.notice =
        "The player is still starting or unavailable. Check its state before playing.";
    } else this.wakeTimer = setTimeout(() => void this.pollWake(), delay);
    this.requestUpdate();
  }
  private async refresh() {
    await this.action(async () => {
      await this.readStatus();
      await this.load();
    });
  }
  private async prepare(operation: string) {
    if (this.pending) return;
    await this.action(async () => {
      const generation = this.generation;
      const review = await this.client!.controlPrepare(
        this.scope!,
        operation,
        operation === "launch" ? this.versionId || undefined : undefined,
        this.selectedPlayer || undefined,
      );
      if (generation !== this.generation) return;
      // Preflight is automatic; the explicit command click is the user's intent.
      this.lastOperation = operation;
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
    const operation = this.lastOperation;
    if (["state_observed", "acknowledged"].includes(result.outcome)) {
      if (operation === "power_on") {
        this.waking = true;
        this.wakeDeadline = Date.now() + 120000;
        this.wakeTimer = setTimeout(() => void this.pollWake(), 1000);
      } else if (["launch", "play", "resume"].includes(operation))
        this.started = this.selectedPlayer;
    }
    await this.load();
    if (operation !== "power_on") {
      try {
        await this.readStatus();
      } catch {
        this.status = undefined;
      }
    }
  }
  private close(event?: Event) {
    event?.preventDefault();
    // Keep durable server receipts authoritative; closing never replays a command.
    this.stopWaking();
    this.generation++;
    this.busy = false;
    this.pending = undefined;
    if (this.client && this.scope) void this.load();
    this.acknowledge = "";
    this.renderRoot.querySelector<HTMLDialogElement>("dialog")?.close();
    this.dialog = "players";
    this.requestUpdate();
  }
  private async openRemote() {
    if (this.busy || this.pending) return;
    const generation = this.generation;
    this.dialog = "remote";
    this.acknowledge = "";
    this.requestUpdate();
    await this.updateComplete;
    if (generation === this.generation && this.isConnected)
      this.renderRoot.querySelector<HTMLDialogElement>("dialog")?.showModal();
  }
  private async choosePlayer() {
    if (this.busy || this.pending) return;
    const generation = this.generation;
    this.acknowledge = "";
    this.dialog = "players";
    this.requestUpdate();
    await this.updateComplete;
    if (generation !== this.generation || !this.isConnected) return;
    this.renderRoot.querySelector<HTMLDialogElement>("dialog")?.showModal();
  }
  private async reviewPending(request: string) {
    if (!this.scope?.permissions.edit || !this.info?.can_manage) return;
    const generation = this.generation;
    this.acknowledge = request;
    this.requestUpdate();
    await this.updateComplete;
    if (generation !== this.generation || !this.isConnected) return;
    this.renderRoot.querySelector<HTMLDialogElement>("dialog")?.showModal();
  }
  private async confirmReview() {
    if (
      !this.acknowledge ||
      !this.info?.can_manage ||
      !this.scope?.permissions.edit
    )
      return;
    await this.action(async () => {
      const generation = this.generation;
      await this.client!.controlAcknowledge(this.scope!, this.acknowledge);
      if (generation !== this.generation) return;
      this.acknowledge = "";
      this.renderRoot.querySelector<HTMLDialogElement>("dialog")?.close();
      await this.load();
    });
  }
  private feedback() {
    return html`
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
    `;
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
      this.waking ||
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
                type="button"
                ?disabled=${disabled}
                ?hidden=${this.inlineRemote}
                @click=${this.openRemote}
              >
                Remote
              </button>
              <button
                ?disabled=${this.busy || !info?.enabled || !this.selectedPlayer}
                @click=${this.refresh}
              >
                Refresh player state</button
              ><button
                ?disabled=${this.busy || !info?.enabled || !!this.pending}
                ?hidden=${(info?.players.length ?? 0) < 2}
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
                  <option value="" ?selected=${!this.value}>
                    No default player selected
                  </option>
                  ${this.value && !devices.some((device) => device.serial === this.value) ? html`<option value=${this.value} selected>Configured player (${this.value})</option>` : nothing}
                  ${devices.map((device) => html`<option value=${device.serial} ?selected=${device.serial === this.value}>${device.name || device.model || "Movie player"} (${device.serial})</option>`)}
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
                    class=${`primary play-movie ${this.status?.ready ? "is-play" : "is-power"}`}
                    ?disabled=${disabled}
                    aria-busy=${this.waking || this.busy}
                    title=${`${this.status?.ready ? "Play on" : "Power on"} ${player?.name || "the selected player"}`}
                    @click=${() => (this.status && this.status.readiness !== "starting" ? this.prepare(this.status.ready ? "launch" : "power_on") : this.refresh())}
                  >
                    ${actionIcon(this.status?.ready && !this.waking ? "play" : "power")}
                    ${this.waking ? html`<span class="spinner" aria-hidden="true">◌</span> Starting player…` : !this.status || this.status.readiness === "starting" ? "Check player" : this.status.ready ? "Play" : "Power On"}</button
                  ><button
                    type="button"
                    ?disabled=${this.busy || this.waking || !!this.pending}
                    ?hidden=${(info?.players.length ?? 0) < 2}
                    @click=${this.choosePlayer}
                  >
                    Choose Player</button
                  ><slot name="collection"></slot>
                </div>
                ${(info?.players.length ?? 0) > 1 || !player ? html`<p class="muted player-target">${player ? `On ${player.name}` : "Choose a player to start playback"}</p>` : nothing}
              `
            : !info?.enabled
              ? html`<p class="muted">Playback controls are disabled.</p>`
              : html`
                  ${this.waking ? html`<span role="status">◌ Starting player…</span>` : nothing}
                `
      }
      ${this.mode === "remote" && this.inlineRemote && info?.enabled ? remoteControls(player?.name || "Kaleidescape player", !!disabled, !!this.status?.ready, (operation) => void this.prepare(operation)) : nothing}
      ${this.dialog !== "remote" || this.acknowledge ? this.feedback() : nothing}
      ${blocked && !(info?.can_manage && this.scope.permissions.edit) ? html`<p class="warning">This player needs administrator review of an uncertain command before more commands can be sent.</p>` : nothing}
      ${info?.can_manage && this.scope.permissions.edit ? info.pending.map((item) => html`<p class="warning">Unconfirmed ${item.operation} for ${info.players.find((row) => row.id === item.player_id)?.name || "a previously selected player"}. <button type="button" ?disabled=${this.busy} @click=${() => this.reviewPending(item.request_id)}>I inspected the player…</button></p>`) : nothing}
      <dialog
        ?data-admin-dialog=${!!this.acknowledge}
        class=${this.dialog === "remote" && !this.acknowledge ? "database-dialog remote-dialog" : "database-dialog"}
        @click=${dismissBackdrop}
        @cancel=${this.close}
      >
        <div class="card-head">
          <h2>
            ${this.acknowledge ? "Review unconfirmed command" : this.dialog === "remote" ? "Theater Remote" : "Choose Player"}
          </h2>
          ${closeButton((event) => this.close(event))}
        </div>
        ${
          this.acknowledge
            ? html`<p>
                Confirm you inspected the physical player. This permits new
                commands and does not resend the earlier command.
              </p>`
            : this.dialog === "remote"
              ? html`${remoteControls(
                  player?.name || "Kaleidescape player",
                  !!disabled,
                  !!this.status?.ready,
                  (operation) => void this.prepare(operation),
                )}${this.feedback()}`
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
                            this.status = undefined;
                            this.stopWaking();
                            this.close();
                            this.dispatchEvent(
                              new CustomEvent("player-changed", {
                                detail: item.id,
                                bubbles: true,
                                composed: true,
                              }),
                            );
                            void this.refresh();
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
        ${this.acknowledge ? html`<div class="dialog-footer"><button type="button" class="primary" ?disabled=${this.busy} @click=${this.confirmReview}>Acknowledge review</button></div>` : nothing}
      </dialog>
    </section>`;
  }
}
if (!customElements.get("kaleidescape-device-controls"))
  customElements.define("kaleidescape-device-controls", DeviceControls);
