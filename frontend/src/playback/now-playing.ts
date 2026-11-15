/** Read-only context for the configured player, using HA's existing artwork route. */
import { counted } from "../core/text";
import { LitElement, css, html, nothing } from "lit";
import type { PropertyValues } from "lit";
import { errorCode, JournalClient } from "../core/api";
import type { JournalInfo, NowPlayingPlayer } from "../core/api";
import { styles } from "../ui/styles";
import "./controls";
import { DeviceControls } from "./controls";
import { actionIcon } from "../ui/action-icons";

const PLAYBACK: Record<string, string> = {
  playing: "Playing",
  paused: "Paused",
  forward: "Scanning forward",
  reverse: "Scanning backward",
  stopped: "Stopped",
  none: "Stopped",
};
const LOCATION: Record<string, string> = {
  content: "Main content",
  credits: "Credits",
  intermission: "Intermission",
  disc_menu: "Disc menu",
  none: "No active content",
};

export class KaleidescapeNowPlaying extends LitElement {
  static properties = {
    client: { attribute: false },
    scope: { attribute: false },
    playerId: {},
    compact: { type: Boolean, reflect: true },
    showControls: { type: Boolean },
    remoteAvailable: { state: true },
  };
  static styles = [
    styles,
    css`
      :host([compact]) .now-playing {
        min-height: 0;
        margin: 0;
      }
      :host([compact]) .playback-layout {
        padding: 12px;
        gap: 16px;
      }
      :host([compact]) .playback-detail h3 {
        font-size: clamp(22px, 3vw, 36px);
      }
      .now-playing {
        min-height: min(60dvh, 640px);
      }
      .playback-layout {
        grid-template-columns: minmax(160px, 30%) minmax(0, 1fr);
        align-items: center;
        gap: clamp(24px, 4vw, 64px);
        padding: 24px;
      }
      .cover {
        width: 100%;
        height: auto;
        aspect-ratio: 2 / 3;
        max-height: min(56dvh, 560px);
        background: var(--secondary-background-color, #222);
      }
      .player-actions {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .refresh-button svg {
        width: 22px;
        height: 22px;
      }
      .refresh-button {
        display: inline-grid;
        place-items: center;
        width: 44px;
        height: 44px;
        min-height: 44px;
        padding: 9px;
      }
      .cover img {
        width: 100%;
        height: 100%;
        object-fit: contain;
      }
      .playback-detail h3 {
        font-size: clamp(28px, 4vw, 64px);
        line-height: 1.15;
        margin: 16px 0;
      }
      .playback-detail > p {
        font-size: clamp(16px, 1.6vw, 24px);
      }
      @media (max-width: 560px) {
        .now-playing {
          min-height: 0;
          margin-top: 12px;
        }
        .playback-layout {
          grid-template-columns: minmax(100px, 40%) minmax(0, 1fr);
          gap: 12px;
          padding: 12px;
        }
        .playback-detail h3 {
          font-size: clamp(21px, 5vw, 28px);
          margin-block: 8px;
        }
        .playback-detail > p {
          font-size: 14px;
        }
      }
      @media (max-height: 540px) {
        .now-playing {
          min-height: 0;
        }
        .cover {
          max-height: 52dvh;
        }
        .playback-layout {
          padding: 12px;
          gap: 20px;
        }
        .playback-detail h3 {
          font-size: 26px;
        }
      }
    `,
  ];
  client?: JournalClient;
  scope?: JournalInfo;
  playerId = "";
  compact = false;
  showControls = true;
  private remoteAvailable = false;
  private boundClient?: JournalClient;
  private boundScope = "";
  private generation = 0;
  private timer?: ReturnType<typeof setTimeout>;
  private abort?: AbortController;
  private player: NowPlayingPlayer | null = null;
  private loading = false;
  private denied = false;
  private error = "";
  private image = "";
  private imageKey = "";
  private readonly visibility = () => {
    this.reset();
    if (!document.hidden) void this.refresh();
  };

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener("visibilitychange", this.visibility);
    this.requestUpdate("client");
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener("visibilitychange", this.visibility);
    this.reset();
  }
  protected willUpdate(changed: PropertyValues) {
    if (!["client", "scope", "playerId"].some((name) => changed.has(name)))
      return;
    const key = this.scope?.permissions.read
      ? `${this.scope.entry_id}:${this.scope.dataset_id}:${!!this.scope.permissions.edit}:${this.playerId}`
      : "";
    if (this.boundClient !== this.client || this.boundScope !== key) {
      this.reset();
      this.boundClient = this.client;
      this.boundScope = key;
      void this.refresh();
    } else if (changed.has("client") && !this.timer && !this.loading) {
      void this.refresh();
    }
  }
  private clearImage() {
    if (this.image) URL.revokeObjectURL(this.image);
    this.image = "";
    this.imageKey = "";
  }
  private reset() {
    this.generation++;
    clearTimeout(this.timer);
    this.timer = undefined;
    this.abort?.abort();
    this.abort = undefined;
    this.clearImage();
    this.player = null;
    this.loading = this.denied = false;
    this.error = "";
    this.requestUpdate();
  }
  private async refresh() {
    if (
      !this.isConnected ||
      document.hidden ||
      !this.client ||
      !this.boundScope ||
      this.loading
    )
      return;
    clearTimeout(this.timer);
    const client = this.client,
      scope = this.scope!,
      generation = ++this.generation;
    this.loading = true;
    this.denied = false;
    this.error = "";
    this.requestUpdate();
    try {
      const { players } = await client.nowPlaying(
        scope,
        this.playerId || undefined,
      );
      if (generation !== this.generation) return;
      this.player = players[0] ?? null;
      const player = this.player;
      const key =
        player?.available && player.artwork_key && player.entity_id
          ? `${player.entity_id}:${player.content_key ?? player.raw_content_id ?? ""}:${player.artwork_key}`
          : "";
      if (key !== this.imageKey) {
        this.clearImage();
        this.imageKey = key;
        this.requestUpdate();
        if (key) {
          const controller = (this.abort = new AbortController());
          const timeout = setTimeout(() => controller.abort(), 5000);
          try {
            const blob = await client.artwork(
              player!.entity_id!,
              controller.signal,
            );
            if (generation === this.generation && blob)
              this.image = URL.createObjectURL(blob);
          } catch (error) {
            if (errorCode(error) === "unauthorized") throw error;
            // Missing, invalid, or slow artwork must not hide playback context.
          } finally {
            clearTimeout(timeout);
            if (this.abort === controller) this.abort = undefined;
          }
        }
      }
    } catch (error) {
      if (generation !== this.generation) return;
      this.player = null;
      this.clearImage();
      this.denied = errorCode(error) === "unauthorized";
      this.error = this.denied
        ? "Now Playing access is unavailable. Check your account and source permissions."
        : "Now Playing could not refresh. Check the connection or refresh again.";
    } finally {
      if (generation === this.generation) {
        this.loading = false;
        this.requestUpdate();
        if (!this.denied && this.isConnected && !document.hidden)
          this.timer = setTimeout(() => void this.refresh(), 5000);
      }
    }
  }
  private recordingStatus(player: NowPlayingPlayer, active: boolean): string {
    if (player.recording_error)
      return "Recording needs attention. Check HA diagnostics.";
    if (player.recording_paused) return "Recording paused for backup.";
    if (!player.available) return "Recording waiting for source entities.";
    if (active && player.recording_exclusion === "below_minimum_runtime")
      return `Not recording: runtime is below the minimum of ${counted(player.minimum_runtime_minutes!, "minute")}.`;
    if (active && player.recording_exclusion === "runtime_unknown")
      return "Waiting for a known runtime before recording.";
    return "Recording enabled.";
  }
  protected render() {
    const player = this.player;
    const active =
      player?.available && !["stopped", "none"].includes(player.play_status);
    return html`<section class="card now-playing" aria-label="Now Playing">
      <div class="card-head">
        <h2>Now Playing</h2>
        <div class="player-actions">
          ${
            this.showControls
              ? html`<button
                  class="refresh-button"
                  type="button"
                  aria-label="Open remote"
                  title="Open remote"
                  ?disabled=${!this.remoteAvailable}
                  @click=${() => void this.renderRoot.querySelector<DeviceControls>("kaleidescape-device-controls")?.openRemote()}
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                    aria-hidden="true"
                  >
                    <rect x="6" y="2" width="12" height="20" rx="4" />
                    <circle cx="12" cy="8" r="2" />
                    <path d="M10 14h4M10 17h4" />
                  </svg>
                </button>`
              : nothing
          }
          <button
            class="refresh-button"
            type="button"
            aria-label="Refresh playback and player state"
            title="Refresh playback and player state"
            ?disabled=${this.loading || !this.boundScope}
            @click=${() => {
              this.imageKey = "";
              void this.refresh();
              void this.renderRoot
                .querySelector<DeviceControls>("kaleidescape-device-controls")
                ?.refresh();
            }}
          >
            ${actionIcon("refresh")}
          </button>
        </div>
      </div>
      ${
        this.error
          ? html`<p class="playback-message" role="alert">${this.error}</p>`
          : !player
            ? html`<p class="playback-message" role="status">
                ${
                  this.loading
                    ? "Loading playback…"
                    : "Automatic tracking is off. Configure a player in the integration options to show Now Playing."
                }
              </p>`
            : html`<div class="playback-layout">
                <div class="cover">
                  ${
                    this.image
                      ? html`<img
                          src=${this.image}
                          alt="Current movie cover"
                          @error=${() => {
                            const key = this.imageKey;
                            this.clearImage();
                            this.imageKey = key;
                            this.requestUpdate();
                          }}
                        />`
                      : html`<span>No artwork available</span>`
                  }
                </div>
                <div class="playback-detail">
                  <small>${player.name ?? "Configured player"}</small>
                  <h3>
                    ${!player.available ? "Player unavailable" : active ? (player.title ?? "Unknown title") : "No movie playing"}
                  </h3>
                  ${player.available ? html`<p>${PLAYBACK[player.play_status] ?? "Unknown playback state"} · ${LOCATION[player.location] ?? "Unknown location"}</p>` : nothing}
                  ${active && player.duration_seconds != null ? html`<p>Runtime · ${(player.duration_seconds / 60).toFixed(2)} min</p>` : nothing}
                  ${
                    this.scope?.permissions.edit && active && player.session
                      ? html`<p>
                            This session ·
                            ${(player.session.watched_seconds / 60).toFixed(2)}
                            min counted
                          </p>
                          <small
                            >Pauses and scans are excluded.
                            ${player.session.credits_confirmed ? "Credits confirmed; journal completion also requires the configured watch threshold." : "Credits not yet confirmed."}
                            ${player.session.gap_count ? html` ${counted(player.session.gap_count, "timing gap")}.` : nothing}</small
                          >`
                      : nothing
                  }
                  ${
                    this.scope?.permissions.edit &&
                    player.recording_paused !== undefined
                      ? html`<p role="status">
                          ${this.recordingStatus(player, Boolean(active))}
                          ${player.buffered_observations ? html` ${counted(player.buffered_observations, "update")} buffered.` : nothing}
                        </p>`
                      : nothing
                  }
                  <small
                    >Live snapshot refreshes about every 5 seconds while
                    visible.</small
                  >
                </div>
              </div>`
      }
      ${
        this.showControls
          ? html` <kaleidescape-device-controls
              .client=${this.client}
              .scope=${this.scope}
              .playerId=${this.playerId}
              .hideRefresh=${true}
              .hideRemote=${true}
              @remote-availability=${(event: CustomEvent<boolean>) => {
                this.remoteAvailable = event.detail;
              }}
              @player-changed=${(event: CustomEvent<string>) => {
                this.playerId = event.detail;
              }}
            ></kaleidescape-device-controls>`
          : nothing
      }
    </section>`;
  }
}
if (!customElements.get("kaleidescape-now-playing"))
  customElements.define("kaleidescape-now-playing", KaleidescapeNowPlaying);
