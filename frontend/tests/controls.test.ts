import { afterEach, beforeEach, expect, it, vi } from "vitest";
import "../src/playback/controls";
import type { DeviceControls } from "../src/playback/controls";
import { ApiError, JournalClient } from "../src/core/api";
import type { ApiMessage, ControlInfo, ControlReview } from "../src/core/api";
import { info } from "./fixture";

let element: DeviceControls;
let calls: ApiMessage[];
let data: ControlInfo;
let handler: (message: ApiMessage) => Promise<unknown>;
const review: ControlReview = {
  token: "a".repeat(64),
  operation: "pause",
  player_id: "1A2B",
  title: "A Fictional Film",
  year: "2025",
  before: {
    title: "Previous film",
    mode: 2,
    duration_seconds: 7200,
    position_seconds: 10,
  },
  exact_version_confirmed: false,
};
const button = (label: string) =>
  [...element.shadowRoot!.querySelectorAll<HTMLButtonElement>("button")].find(
    (item) => item.textContent?.trim() === label,
  )!;
const flush = async () => {
  await Promise.resolve();
  await element.updateComplete;
  await Promise.resolve();
  await element.updateComplete;
};
const mount = async (label: string) => {
  document.body.append(element);
  await vi.waitFor(() => expect(button(label)?.disabled).toBe(false));
};
beforeEach(() => {
  calls = [];
  data = {
    enabled: true,
    allow_launch: true,
    default_player: "1A2B",
    players: [
      { id: "1A2B", name: "Example cinema", model: "Fictional player" },
    ],
    can_manage: true,
    blocked_players: [],
    devices: [],
    pending: [],
  };
  handler = async (message) => {
    const operation = message.type.split("/").slice(1).join("/");
    if (operation === "control/info" || operation === "control/discover")
      return data;
    if (operation === "control/prepare")
      return { ...review, operation: message.operation };
    if (operation === "control/execute")
      return {
        request_id: message.request_id,
        outcome: "state_observed",
        acknowledged: true,
        exact_version_confirmed: false,
      };
    throw new ApiError("invalid_request");
  };
  element = document.createElement(
    "kaleidescape-device-controls",
  ) as DeviceControls;
  element.scope = { ...info };
  element.client = new JournalClient({
    callWS: async <T>(message: ApiMessage) => {
      calls.push(message);
      return (await handler(message)) as T;
    },
    fetchWithAuth: vi.fn(),
  });
});
afterEach(() => element.remove());

it("lets household users control playback without administrator endpoints", async () => {
  element.scope = {
    ...info,
    permissions: { read: true, edit: false, export: false },
  };
  data.can_manage = false;
  delete data.devices;
  await mount("Pause");
  button("Pause").click();
  await vi.waitFor(() =>
    expect(calls.some((call) => call.type.endsWith("/control/execute"))).toBe(
      true,
    ),
  );
  expect(
    calls.some((call) => /control\/(discover|acknowledge)$/.test(call.type)),
  ).toBe(false);
  expect(
    element.shadowRoot!.querySelector('[name="control_player"]'),
  ).toBeNull();
});
it("loads only passive configuration until an explicit control click", async () => {
  await mount("Pause");
  expect(calls.map((call) => call.type)).toEqual([
    "kaleidescape_companion/control/info",
  ]);
  button("Pause").click();
  await vi.waitFor(() =>
    expect(
      calls.filter((call) => call.type.endsWith("/control/execute")),
    ).toHaveLength(1),
  );
  expect(
    calls.find((call) => call.type.endsWith("/control/prepare"))!.operation,
  ).toBe("pause");
  expect(element.shadowRoot!.textContent).toContain(
    "requested playback state was observed",
  );
});
it("starts the selected Library movie with automatic preflight and no confirmation", async () => {
  element.mode = "movie";
  element.versionId = "b".repeat(64);
  await mount("Play Movie");
  button("Play Movie").click();
  await vi.waitFor(() =>
    expect(
      calls.filter((call) => call.type.endsWith("/control/execute")),
    ).toHaveLength(1),
  );
  expect(
    calls.find((call) => call.type.endsWith("/control/prepare")),
  ).toMatchObject({
    title_id: element.versionId,
    player_id: data.default_player,
  });
  expect(element.shadowRoot!.querySelector("dialog")!.open).toBe(false);
  expect(
    calls.find((call) => call.type.endsWith("/control/execute")),
  ).not.toHaveProperty("confirmation");
});
it("chooses a player for this launch without changing household settings", async () => {
  element.mode = "movie";
  element.versionId = "b".repeat(64);
  data.players.push({
    id: "other-player",
    name: "Den",
    model: "Fictional player",
  });
  await mount("Play Movie");
  button("Choose Player").click();
  await vi.waitFor(() =>
    expect(element.shadowRoot!.querySelector("dialog")!.open).toBe(true),
  );
  const den = [
    ...element.shadowRoot!.querySelectorAll<HTMLButtonElement>(
      ".player-choice",
    ),
  ].find((item) => item.textContent!.includes("Den"))!;
  den.click();
  await flush();
  button("Play Movie").click();
  await vi.waitFor(() =>
    expect(calls.some((call) => call.type.endsWith("/control/execute"))).toBe(
      true,
    ),
  );
  expect(
    calls.find((call) => call.type.endsWith("/control/prepare")),
  ).toMatchObject({ player_id: "other-player" });
  expect(
    calls.some(
      (call) =>
        call.type.includes("settings/") ||
        call.type.endsWith("/control/discover"),
    ),
  ).toBe(false);
});
it("preserves the request ID when checking a lost command response", async () => {
  const original = handler;
  let first = true;
  handler = async (message) => {
    if (message.type.endsWith("/control/execute") && first) {
      first = false;
      throw new ApiError("connection_lost");
    }
    return original(message);
  };
  await mount("Pause");
  button("Pause").click();
  await vi.waitFor(() => expect(button("Check command result")).toBeTruthy());
  button("Check command result").click();
  await vi.waitFor(() =>
    expect(
      calls.filter((call) => call.type.endsWith("/control/execute")),
    ).toHaveLength(2),
  );
  const requests = calls.filter((call) =>
    call.type.endsWith("/control/execute"),
  );
  expect(requests[0].request_id).toBe(requests[1].request_id);
  expect(requests[0].token).toBe(requests[1].token);
});
it("does not open a late player picker after the view loses access", async () => {
  await mount("Choose Player");
  button("Choose Player").click();
  element.scope = {
    ...info,
    permissions: { read: false, edit: false, export: false },
  };
  await flush();
  expect(element.shadowRoot!.querySelector("dialog")).toBeNull();
});
it("drops late preparation when access changes, without executing it", async () => {
  const original = handler;
  let resolve!: (value: ControlReview) => void;
  handler = (message) =>
    message.type.endsWith("/control/prepare")
      ? new Promise<ControlReview>((done) => {
          resolve = done;
        })
      : original(message);
  await mount("Pause");
  button("Pause").click();
  await vi.waitFor(() => expect(resolve).toBeDefined());
  element.scope = {
    ...info,
    permissions: { read: false, edit: false, export: false },
  };
  await flush();
  resolve(review);
  await flush();
  expect(calls.some((call) => call.type.endsWith("/control/execute"))).toBe(
    false,
  );
  expect(element.shadowRoot!.querySelector("button")).toBeNull();
});
it("blocks uncertain writes only for their player and refreshes receipts", async () => {
  data.pending = [
    {
      request_id: "fictional-receipt",
      player_id: "2C3D",
      operation: "stop",
      created_at: "2026-10-30T12:00:00+00:00",
    },
  ];
  await mount("Pause");
  const original = handler;
  handler = async (message) => {
    if (message.type.endsWith("/control/status"))
      return { state: review.before };
    return original(message);
  };
  data.pending[0].player_id = data.default_player;
  data.blocked_players = [data.default_player];
  button("Refresh player state").click();
  await vi.waitFor(() => expect(button("Pause").disabled).toBe(true));
  data.pending = [];
  data.blocked_players = [];
  await vi.waitFor(() =>
    expect(button("Refresh player state").disabled).toBe(false),
  );
  button("Refresh player state").click();
  await vi.waitFor(() => expect(button("Pause").disabled).toBe(false));
});
it("discovers explicitly and offers players rather than servers as defaults", async () => {
  element.mode = "settings";
  data.devices = [
    {
      serial: "1A2B",
      name: "Example cinema",
      model: "Fictional player",
      ipaddress: "10.0.0.25",
      is_player: true,
    },
    {
      serial: "2C3D",
      name: "Example server",
      model: "Fictional server",
      ipaddress: "10.0.0.10",
      is_player: false,
    },
  ];
  await mount("Discover devices");
  button("Discover devices").click();
  await vi.waitFor(() =>
    expect(calls.some((call) => call.type.endsWith("/control/discover"))).toBe(
      true,
    ),
  );
  const values = [...element.shadowRoot!.querySelectorAll("option")].map(
    (option) => option.value,
  );
  expect(values).toContain("1A2B");
  expect(values).not.toContain("2C3D");
});
