import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  createConnection,
  createLongLivedTokenAuth,
} from "home-assistant-js-websocket";
import { connectDevelopment } from "../src/dev-connection";
import { info } from "./fixture";

vi.mock("home-assistant-js-websocket", () => ({
  createConnection: vi.fn(),
  createLongLivedTokenAuth: vi.fn(),
}));
const auth = { data: { access_token: "" } };
let listeners: Record<string, () => void>;
const connection = {
  connected: true,
  close: vi.fn(),
  sendMessagePromise: vi.fn(),
  addEventListener: vi.fn(),
};
beforeEach(() => {
  listeners = {};
  auth.data.access_token = "fictional-dev-token";
  vi.mocked(createLongLivedTokenAuth).mockReturnValue(
    auth as ReturnType<typeof createLongLivedTokenAuth>,
  );
  vi.mocked(createConnection).mockResolvedValue(
    connection as unknown as Awaited<ReturnType<typeof createConnection>>,
  );
  connection.sendMessagePromise.mockResolvedValue({
    name: "Development User",
    is_admin: true,
  });
  connection.addEventListener.mockImplementation(
    (event: string, handler: () => void) => {
      listeners[event] = handler;
    },
  );
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("Tokens must not be stored");
  });
});
afterEach(() => vi.unstubAllGlobals());
it("uses the fixed development instance, stores no token, and clears it on disconnect", async () => {
  const lost = vi.fn(),
    session = await connectDevelopment("fictional-dev-token", lost);
  expect(createLongLivedTokenAuth).toHaveBeenCalledWith(
    "http://127.0.0.1:8123",
    "fictional-dev-token",
  );
  expect(Storage.prototype.setItem).not.toHaveBeenCalled();
  listeners.disconnected();
  expect(connection.close).toHaveBeenCalled();
  expect(auth.data.access_token).toBe("");
  expect(lost).toHaveBeenCalled();
  await expect(session.client.info()).rejects.toMatchObject({
    code: "connection_lost",
  });
});
it("closes non-admin sessions, and never reuses their credentials", async () => {
  connection.sendMessagePromise.mockResolvedValueOnce({ is_admin: false });
  await expect(
    connectDevelopment("fictional-dev-token", vi.fn()),
  ).rejects.toMatchObject({ code: "unauthorized" });
  expect(auth.data.access_token).toBe("");
  expect(connection.close).toHaveBeenCalled();
});
it("forwards only explicit export requests and refuses redirects", async () => {
  const fetch = vi.fn().mockResolvedValue(new Response("{}"));
  vi.stubGlobal("fetch", fetch);
  const session = await connectDevelopment("fictional-dev-token", vi.fn());
  await session.client.download(info, "json", new AbortController().signal);
  expect(fetch).toHaveBeenCalledWith(
    expect.stringContaining("/api/kaleidescape_companion/"),
    expect.objectContaining({
      redirect: "error",
      credentials: "omit",
      method: "GET",
      headers: { Authorization: "Bearer fictional-dev-token" },
    }),
  );
  await expect(
    session.client.download(
      { ...info, entry_id: "../../auth" },
      "json",
      new AbortController().signal,
    ),
  ).rejects.toMatchObject({ code: "unauthorized" });
  expect(fetch).toHaveBeenCalledTimes(1);
  session.close();
});
