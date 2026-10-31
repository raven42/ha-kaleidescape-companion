import { afterEach, beforeEach, expect, it, vi } from "vitest";
import "../src/playback/now-playing";
import type { KaleidescapeNowPlaying } from "../src/playback/now-playing";
import type { NowPlayingPlayer } from "../src/core/api";
import { FixtureTransport, info, playing } from "./fixture";

let element: KaleidescapeNowPlaying;
let transport: FixtureTransport;
const content = () => element.shadowRoot!.textContent!.replace(/\s+/g, " ");
const refresh = () => element.shadowRoot!.querySelector("button")!.click();
const flush = async () => {
  await Promise.resolve();
  await element.updateComplete;
  await Promise.resolve();
};
beforeEach(async () => {
  vi.useFakeTimers();
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:fictional-cover");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  transport = new FixtureTransport();
  element = document.createElement(
    "kaleidescape-now-playing",
  ) as KaleidescapeNowPlaying;
  element.client = transport.client();
  element.scope = info;
});
afterEach(() => {
  element.remove();
  vi.useRealTimers();
});
async function mount(player?: NowPlayingPlayer) {
  transport.players = player ? [player] : [];
  document.body.append(element);
  await flush();
  await flush();
}
it("shows source/session context as text without playback controls or invented progress", async () => {
  await mount(
    playing({
      title: "<script>fictional</script>",
      play_status: "forward",
      location: "credits",
    }),
  );
  expect(content()).toContain("<script>fictional</script>");
  expect(content()).toContain("Scanning forward");
  expect(content()).toContain("Credits");
  expect(content()).toContain("10.00 min counted");
  expect(
    element.shadowRoot!.querySelector("script,iframe,progress,input"),
  ).toBeNull();
  expect(element.shadowRoot!.querySelectorAll("button")).toHaveLength(1);
  expect(
    transport.calls.every(
      (call) =>
        call.type.endsWith("/now_playing") ||
        call.type.endsWith("/control/info"),
    ),
  ).toBe(true);
});
it("handles unconfigured, idle, unavailable, and degraded recording snapshots", async () => {
  await mount();
  expect(content()).toContain("Automatic tracking is off");
  transport.players = [playing({ available: false })];
  refresh();
  await flush();
  expect(content()).toContain("Player unavailable");
  expect(content()).not.toContain("The Lantern Voyage");
  transport.players = [
    playing({ play_status: "stopped", recording_paused: true }),
  ];
  refresh();
  await flush();
  expect(content()).toContain("No movie playing");
  expect(content()).toContain("Recording paused for backup");
  transport.players = [playing({ recording_error: "storage_error" })];
  refresh();
  await flush();
  expect(content()).toContain("Recording needs attention");
});
it("explains ignored trailers and unknown runtime while leaving playback visible", async () => {
  await mount(
    playing({
      title: "Fictional trailer",
      duration_seconds: 120,
      session: null,
      recording_exclusion: "below_minimum_runtime",
      minimum_runtime_minutes: 10,
    }),
  );
  expect(content()).toContain("Fictional trailer");
  expect(content()).toContain(
    "Not recording: runtime is below the minimum of 10 minutes",
  );
  expect(content()).not.toContain("This session");
  transport.players = [
    playing({
      duration_seconds: null,
      session: null,
      recording_exclusion: "runtime_unknown",
    }),
  ];
  refresh();
  await flush();
  expect(content()).toContain("Waiting for a known runtime before recording");
  transport.players = [
    playing({ minimum_runtime_minutes: 0, duration_seconds: null }),
  ];
  refresh();
  await flush();
  expect(content()).toContain("Recording enabled");
});
it("polls only while attached and visible, then refreshes on return", async () => {
  await mount(playing());
  const observations = () =>
    transport.calls.filter((call) => call.type.endsWith("/now_playing"));
  expect(observations()).toHaveLength(1);
  await vi.advanceTimersByTimeAsync(5000);
  expect(observations()).toHaveLength(2);
  const hidden = vi.spyOn(document, "hidden", "get").mockReturnValue(true);
  document.dispatchEvent(new Event("visibilitychange"));
  await vi.advanceTimersByTimeAsync(20000);
  expect(observations()).toHaveLength(2);
  hidden.mockReturnValue(false);
  document.dispatchEvent(new Event("visibilitychange"));
  await flush();
  expect(observations()).toHaveLength(3);
  element.remove();
  await vi.advanceTimersByTimeAsync(20000);
  expect(observations()).toHaveLength(3);
});
it("ignores old snapshots after switching dataset/client", async () => {
  let resolve!: (value: { players: NowPlayingPlayer[] }) => void;
  vi.spyOn(element.client!, "nowPlaying").mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  await mount(playing());
  const other = new FixtureTransport();
  other.players = [playing({ title: "Different connection" })];
  element.client = other.client();
  element.scope = { ...info, dataset_id: "different-dataset" };
  await flush();
  await flush();
  resolve({ players: [playing()] });
  await flush();
  expect(content()).toContain("Different connection");
  expect(content()).not.toContain("The Lantern Voyage");
});
it("clears denied data and stops automatic retries until an explicit refresh", async () => {
  await mount(playing());
  transport.failure = "unauthorized";
  refresh();
  await flush();
  expect(content()).not.toContain("The Lantern Voyage");
  expect(content()).toContain("Now Playing access is unavailable");
  const count = transport.calls.length;
  await vi.advanceTimersByTimeAsync(20000);
  expect(transport.calls).toHaveLength(count);
  transport.failure = null;
  refresh();
  await flush();
  expect(content()).toContain("The Lantern Voyage");
});
it("uses one bounded cover fetch per image version and revokes it on movie changes/unmount", async () => {
  const artwork = vi
    .spyOn(element.client!, "artwork")
    .mockResolvedValue(new Blob(["fictional"], { type: "image/jpeg" }));
  await mount(playing({ artwork_key: "cover-a" }));
  await flush();
  expect(element.shadowRoot!.querySelector("img")?.src).toBe(
    "blob:fictional-cover",
  );
  expect(artwork).toHaveBeenCalledWith(
    "media_player.example",
    expect.any(AbortSignal),
  );
  await vi.advanceTimersByTimeAsync(5000);
  expect(artwork).toHaveBeenCalledTimes(1);
  transport.players = [
    playing({ raw_content_id: "different", artwork_key: "cover-b" }),
  ];
  await vi.advanceTimersByTimeAsync(5000);
  expect(artwork).toHaveBeenCalledTimes(2);
  expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:fictional-cover");
  element.remove();
  expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2);
});
it("aborts and ignores a late cover after disconnect", async () => {
  let resolve!: (blob: Blob) => void;
  const artwork = vi.spyOn(element.client!, "artwork").mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  await mount(playing({ artwork_key: "cover-a" }));
  const signal = artwork.mock.calls[0][1];
  element.remove();
  expect(signal.aborted).toBe(true);
  resolve(new Blob(["fictional"], { type: "image/jpeg" }));
  await flush();
  expect(URL.createObjectURL).not.toHaveBeenCalled();
});
it("falls back to a placeholder for slow/broken artwork without hiding playback", async () => {
  vi.spyOn(element.client!, "artwork").mockImplementation(
    (_entity, signal) =>
      new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () =>
          reject(new DOMException("Aborted", "AbortError")),
        );
      }),
  );
  await mount(playing({ artwork_key: "cover-a" }));
  await vi.advanceTimersByTimeAsync(5000);
  expect(content()).toContain("The Lantern Voyage");
  expect(content()).toContain("No artwork available");
});
