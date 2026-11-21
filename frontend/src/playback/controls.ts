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
import { settingLabel } from "../ui/settings-hint";
import { settingLabelStyles } from "../ui/settings-styles";
import { actionIcon } from "../ui/action-icons";
import {
  DEFAULT_REMOTE_VISIBILITY,
  remoteControls,
  remoteStyles,
} from "./remote";
import type { RemoteVisibility } from "./remote";
import { closeButton, dismissBackdrop } from "../ui/dialog";
import companionIcon from "../ui/assets/companion-icon.png?inline";

const FAILURE_OUTCOMES: Partial<Record<ControlResult["outcome"], string>> = {
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
    hideRefresh: { type: Boolean },
    hideRemote: { type: Boolean },
    liveTyping: { type: Boolean },
    remoteVisibility: { attribute: false },
    value: {},
    configured: { type: Boolean },
    settingsDisabled: { type: Boolean },
  };
  static styles = [
    styles,
    settingLabelStyles,
    remoteStyles,
    css`
      [hidden] {
        display: none !important;
      }
      .control-card {
        margin-top: 20px;
        padding: 20px;
      }
      .control-card.embedded {
        margin: 0;
        padding: 0 12px 12px;
        border: 0;
        background: transparent;
      }
      .control-card.embedded > .card-head h2 {
        display: none;
      }
      .control-card > .card-head {
        padding: 0;
        flex-wrap: wrap;
      }
      .remote-icon {
        display: none;
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
        .control-card:not(.embedded) {
          margin-top: 12px;
          padding: 12px;
        }
        .remote-icon {
          display: inline-block;
          width: 22px;
          height: 22px;
        }
        .remote-label {
          display: none;
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
  hideRefresh = false;
  hideRemote = false;
  liveTyping = false;
  remoteVisibility: RemoteVisibility = { ...DEFAULT_REMOTE_VISIBILITY };
  value = "";
  configured = true;
  settingsDisabled = false;
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
  private lastOutcome?: ControlResult["outcome"];
  private pending?: PreparedMutation;
  private selectedPlayer = "";
  private dialog = "players";
  private acknowledge = "";
  private busy = false;
  private revalidatingVersion = false;
  private error = "";
  private notice = "";
  private locked = false;

  protected willUpdate(changed: PropertyValues) {
    if (changed.has("liveTyping") && !this.liveTyping)
      clearTimeout(this.searchTimer);
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
      const versionOnly =
        changed.has("versionId") &&
        !changed.has("scope") &&
        !changed.has("client") &&
        !changed.has("playerId") &&
        !!this.key &&
        !!key;
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
      this.revalidatingVersion = versionOnly && !!this.info;
      if (!versionOnly) this.info = this.status = undefined;
      this.pending = undefined;
      this.stopWaking();
      this.stopInputPolling();
      this.busy = false;
      this.acknowledge =
        this.error =
        this.notice =
        this.started =
        this.lastOperation =
          "";
      if (this.playerId) this.selectedPlayer = this.playerId;
      if (key && this.client) void this.load(true, this.revalidatingVersion);
    }
  }
  private inputTimer?: ReturnType<typeof setTimeout>;
  private inputRead?: Promise<unknown>;
  private searchInput?: { prompt: string; entry: string };
  private searchDraft = "";
  private searchDirty = false;
  private searchTimer?: ReturnType<typeof setTimeout>;
  private sendingSearch = false;
  private searchTask?: Promise<void>;
  private finishingSearch = false;
  private stopInputPolling() {
    clearTimeout(this.inputTimer);
    clearTimeout(this.searchTimer);
    this.inputTimer = undefined;
    this.searchInput = undefined;
    this.searchDraft = "";
    this.searchDirty = false;
  }
  private async pollInput() {
    if (
      this.dialog !== "remote" ||
      !this.isConnected ||
      !this.client ||
      !this.scope ||
      !this.selectedPlayer
    )
      return;
    const generation = this.generation,
      player = this.selectedPlayer;
    if (!this.busy && !this.pending) {
      try {
        const read = this.client.controlInputStatus(this.scope, player);
        this.inputRead = read;
        const input = await read;
        if (
          generation !== this.generation ||
          player !== this.selectedPlayer ||
          this.dialog !== "remote"
        )
          return;
        if (this.status && typeof input.playback_mode === "number") {
          this.status = {
            ...this.status,
            state: { ...this.status.state, mode: input.playback_mode },
          };
        }
        const focusSearch = input.active && !this.searchInput;
        if (input.active) {
          if (!this.searchDirty) this.searchDraft = input.entry || "";
          this.searchInput = {
            prompt: input.prompt || "Search",
            entry: input.entry || "",
          };
        } else {
          this.searchInput = undefined;
          this.searchDraft = "";
          this.searchDirty = false;
          clearTimeout(this.searchTimer);
        }
        this.requestUpdate();
        if (focusSearch) {
          await this.updateComplete;
          if (
            generation === this.generation &&
            this.dialog === "remote" &&
            this.searchInput
          )
            this.renderRoot
              .querySelector<HTMLInputElement>("#player-search")
              ?.focus({ preventScroll: true });
        }
      } catch (error) {
        if (errorCode(error) === "unauthorized") {
          this.stopInputPolling();
          this.fail(error);
        }
        /* The remote remains usable if prompt readback is unavailable. */
      } finally {
        this.inputRead = undefined;
      }
    }
    if (
      generation === this.generation &&
      this.dialog === "remote" &&
      this.isConnected
    )
      this.inputTimer = setTimeout(() => void this.pollInput(), 2000);
  }
  private scheduleSearch() {
    clearTimeout(this.searchTimer);
    if (
      this.liveTyping &&
      this.searchDirty &&
      this.dialog === "remote" &&
      !this.info?.blocked_players.includes(this.selectedPlayer)
    )
      this.searchTimer = setTimeout(() => void this.sendSearch(), 350);
  }
  private sendSearch(): Promise<void> {
    if (this.searchTask) return this.searchTask;
    const task = this.sendSearchUpdate();
    this.searchTask = task;
    void task.finally(() => {
      if (this.searchTask === task) this.searchTask = undefined;
    });
    return task;
  }
  private async sendSearchUpdate() {
    clearTimeout(this.searchTimer);
    if (!this.searchDirty || this.sendingSearch || !this.searchInput) return;
    if (this.pending) return;
    if (this.busy) {
      this.scheduleSearch();
      return;
    }
    const generation = this.generation,
      value = this.searchDraft;
    this.sendingSearch = true;
    try {
      await this.prepare("search_text", value);
      if (generation !== this.generation) return;
      if (
        this.lastOutcome === "acknowledged" ||
        this.lastOutcome === "state_observed"
      ) {
        this.searchDirty = this.searchDraft !== value;
        if (this.searchDirty) this.scheduleSearch();
      } else clearTimeout(this.searchTimer);
    } finally {
      this.sendingSearch = false;
      this.requestUpdate();
    }
  }
  private async finishSearch() {
    if (
      this.finishingSearch ||
      !this.searchInput ||
      (this.pending && !this.searchTask)
    )
      return;
    const generation = this.generation;
    this.finishingSearch = true;
    clearTimeout(this.searchTimer);
    try {
      if (this.searchTask) await this.searchTask;
      if (generation !== this.generation || !this.searchInput) return;
      if (this.searchDirty) await this.sendSearch();
      if (
        generation !== this.generation ||
        !this.searchInput ||
        this.searchDirty ||
        this.pending ||
        this.busy
      )
        return;
      await this.prepare("select");
    } finally {
      this.finishingSearch = false;
    }
  }
  private remoteAvailable = false;
  private canOpenRemote() {
    return !!(
      this.scope?.permissions.read &&
      this.info?.enabled &&
      this.selectedPlayer &&
      !this.busy &&
      !this.pending &&
      !this.revalidatingVersion &&
      !this.waking &&
      !this.info.blocked_players.includes(this.selectedPlayer)
    );
  }
  protected updated() {
    const available = this.canOpenRemote();
    if (available !== this.remoteAvailable) {
      this.remoteAvailable = available;
      this.dispatchEvent(
        new CustomEvent("remote-availability", {
          detail: available,
          bubbles: true,
          composed: true,
        }),
      );
    }
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
    this.stopInputPolling();
    this.revalidatingVersion = false;
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
        "Player controls are paused. Ask an administrator to review the player.",
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
  private async load(readState = false, versionRefresh = false) {
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
      if (generation === this.generation) {
        if (versionRefresh) this.info = this.status = undefined;
        this.fail(error);
      }
    }
    if (generation === this.generation) {
      if (versionRefresh) this.revalidatingVersion = false;
      this.requestUpdate();
    }
  }
  private async action(work: () => Promise<void>) {
    if (
      this.busy ||
      this.revalidatingVersion ||
      !this.client ||
      !this.scope?.permissions.read
    )
      return;
    const generation = this.generation;
    this.busy = true;
    this.error = "";
    this.requestUpdate();
    try {
      if (this.inputRead) await this.inputRead.catch(() => undefined);
      if (generation !== this.generation) return;
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
    if (
      !this.scope?.permissions.edit ||
      (this.mode === "settings" && (this.settingsDisabled || !this.configured))
    )
      return;
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
  async refresh() {
    await this.action(async () => {
      await this.readStatus();
      await this.load();
    });
  }
  private async prepare(operation: string, inputText?: string) {
    if (this.pending) return;
    this.lastOutcome = undefined;
    await this.action(async () => {
      const generation = this.generation;
      const review = await this.client!.controlPrepare(
        this.scope!,
        operation,
        operation === "launch" ? this.versionId || undefined : undefined,
        this.selectedPlayer || undefined,
        inputText,
      );
      if (generation !== this.generation) return;
      // Preflight is automatic; the explicit command click is the user's intent.
      this.lastOperation = operation;
      this.pending = this.client!.prepareControl(this.scope!, review.token);
      await this.send();
    });
    if (
      operation === "search" &&
      this.dialog === "remote" &&
      (this.lastOutcome === "acknowledged" ||
        this.lastOutcome === "state_observed")
    ) {
      this.renderRoot
        .querySelector<HTMLInputElement>("#player-search")
        ?.focus({ preventScroll: true });
      clearTimeout(this.inputTimer);
      void this.pollInput();
    }
  }
  private async send() {
    if (!this.pending) return;
    const generation = this.generation;
    const result = await this.client!.controlExecute(this.pending);
    if (generation !== this.generation) return;
    this.lastOutcome = result.outcome;
    this.notice = FAILURE_OUTCOMES[result.outcome] ?? "";
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
    this.stopInputPolling();
    this.generation++;
    this.busy = false;
    this.pending = undefined;
    if (this.client && this.scope) void this.load();
    this.acknowledge = "";
    this.renderRoot.querySelector<HTMLDialogElement>("dialog")?.close();
    this.dialog = "players";
    this.requestUpdate();
  }
  async openRemote() {
    if (!this.canOpenRemote()) return;
    const generation = this.generation;
    this.dialog = "remote";
    this.acknowledge = "";
    this.requestUpdate();
    await this.updateComplete;
    if (generation === this.generation && this.isConnected)
      this.renderRoot.querySelector<HTMLDialogElement>("dialog")?.showModal();
    void this.pollInput();
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
          ? html`<button
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
      return html`<div class="movie-actions">
        <slot name="collection"></slot>
      </div>`;
    const devices = info?.devices?.filter((device) => device.is_player) ?? [];
    const player = info?.players.find(
      (item) => item.id === this.selectedPlayer,
    );
    const blocked = info?.blocked_players.includes(this.selectedPlayer);
    const disabled =
      this.busy ||
      this.revalidatingVersion ||
      this.waking ||
      !info?.enabled ||
      !this.selectedPlayer ||
      !!this.pending ||
      blocked;
    return html`<section
      class=${this.mode === "remote" ? `card control-card${this.hideRemote ? " embedded" : ""}` : "device-controls"}
    >
      ${
        this.mode === "remote"
          ? html`<div class="card-head">
              <h2>Player controls</h2>
              <button
                type="button"
                ?disabled=${disabled}
                ?hidden=${this.inlineRemote || this.hideRemote}
                @click=${this.openRemote}
                aria-label="Open remote"
                title="Open remote"
              >
                <svg
                  class="remote-icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.8"
                  aria-hidden="true"
                >
                  <rect x="6" y="2" width="12" height="20" rx="4" />
                  <circle cx="12" cy="8" r="2" />
                  <path d="M10 14h4M10 17h4" /></svg
                ><span class="remote-label">Remote</span>
              </button>
              <button
                class="refresh-player"
                ?hidden=${this.hideRefresh}
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
                  ?disabled=${this.busy || this.settingsDisabled || !info?.enabled || !this.configured}
                  @click=${this.discover}
                >
                  ${this.busy ? "Discovering…" : "Discover devices"}
                </button>
              </div>
              ${!info?.enabled || !this.configured ? html`<p class="muted">Save the enabled control hostname before discovering devices.</p>` : nothing}
              <div>
                ${settingLabel("control_player", "Default player", "Discover devices using the saved Kaleidescape Player Address, then choose the movie player Companion should use by default. Save this selection to apply it. This does not change the player observed for Journal recording or send a playback command.")}<select
                  name="control_player"
                  id="control_player"
                  aria-describedby="control_player-hint"
                  .value=${this.value}
                  ?disabled=${this.busy || this.settingsDisabled}
                  @change=${(event: Event) => this.dispatchEvent(new CustomEvent("player-selected", { detail: (event.target as HTMLSelectElement).value, bubbles: true, composed: true }))}
                >
                  <option value="" ?selected=${!this.value}>
                    No default player selected
                  </option>
                  ${this.value && !devices.some((device) => device.serial === this.value) ? html`<option value=${this.value} selected>Configured player (${this.value})</option>` : nothing}
                  ${devices.map((device) => html`<option value=${device.serial} ?selected=${device.serial === this.value}>${device.name || device.model || "Movie player"} (${device.serial})</option>`)}
                </select>
              </div>
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
                    ?disabled=${this.busy || this.revalidatingVersion || this.waking || !!this.pending}
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
      ${this.mode === "remote" && this.inlineRemote && info?.enabled ? remoteControls(!!disabled, !!this.status?.ready, this.status?.state.mode !== 0, this.remoteVisibility, (operation) => void this.prepare(operation)) : nothing}
      ${this.dialog !== "remote" || this.acknowledge ? this.feedback() : nothing}
      ${blocked && !(info?.can_manage && this.scope.permissions.edit) ? html`<p class="warning">Player controls are paused. Ask an administrator to review the player.</p>` : nothing}
      ${info?.can_manage && this.scope.permissions.edit ? info.pending.map((item) => html`<p class="warning">Player controls are paused for ${info.players.find((row) => row.id === item.player_id)?.name || "a previously selected player"}. <button type="button" ?disabled=${this.busy} @click=${() => this.reviewPending(item.request_id)}>I inspected the player…</button></p>`) : nothing}
      <dialog
        ?data-admin-dialog=${!!this.acknowledge}
        class=${this.dialog === "remote" && !this.acknowledge ? "database-dialog remote-dialog" : "database-dialog"}
        @click=${dismissBackdrop}
        @cancel=${this.close}
      >
        <div class="card-head">
          <h2>
            ${this.dialog === "remote" && !this.acknowledge ? html`<img class="remote-header-icon" src=${companionIcon} alt="" />` : nothing}
            ${this.acknowledge ? "Restore player controls" : this.dialog === "remote" ? `${player?.name || "Kaleidescape player"} Remote` : "Choose Player"}
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
              ? html`${
                  this.searchInput
                    ? html`<section
                        class="remote-search"
                        aria-label="Player search keyboard"
                      >
                        <label for="player-search"
                          >${this.searchInput.prompt}</label
                        >
                        <div>
                          <input
                            id="player-search"
                            type="text"
                            maxlength="120"
                            autocomplete="off"
                            enterkeyhint="done"
                            @keydown=${(event: KeyboardEvent) => {
                              if (event.key === "Enter" && !event.isComposing) {
                                event.preventDefault();
                                void this.finishSearch();
                              }
                            }}
                            .value=${this.searchDraft}
                            @input=${(event: Event) => {
                              this.searchDraft = (
                                event.target as HTMLInputElement
                              ).value;
                              this.searchDirty = true;
                              this.scheduleSearch();
                              this.requestUpdate();
                            }}
                          />
                          ${
                            !this.liveTyping
                              ? html`<button
                                  type="button"
                                  ?disabled=${!!disabled || !this.searchDirty}
                                  @click=${() => void this.sendSearch()}
                                >
                                  Send
                                </button>`
                              : nothing
                          }
                          <button
                            type="button"
                            ?disabled=${!!disabled || this.searchDirty}
                            @click=${() => void this.finishSearch()}
                          >
                            Done
                          </button>
                        </div>
                        <p class="muted">
                          ${this.liveTyping ? "Text is sent as you type." : "Send text before selecting Done."}
                        </p>
                      </section>`
                    : nothing
                }${remoteControls(
                  !!disabled,
                  !!this.status?.ready,
                  this.status?.state.mode !== 0,
                  this.remoteVisibility,
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
