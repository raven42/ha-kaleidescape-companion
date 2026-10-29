/** Local development only. No saved tokens, arbitrary HA targets, or auth proxy. */
import {
  createConnection,
  createLongLivedTokenAuth,
} from "home-assistant-js-websocket";
import { ApiError, JournalClient, withRequestDeadline } from "../src/core/api";

import { HA_TARGET, requestMethod } from "./routes.mjs";

export const DEVELOPMENT_HA = HA_TARGET;
export interface DevelopmentSession {
  client: JournalClient;
  name: string;
  close(): void;
}

export async function connectDevelopment(
  token: string,
  disconnected: () => void,
): Promise<DevelopmentSession> {
  const auth = createLongLivedTokenAuth(DEVELOPMENT_HA, token);
  const connection = await createConnection({
    auth,
    setupRetry: 0,
    connectTimeout: 10000,
  });
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    connection.close();
    auth.data.access_token = "";
  };
  try {
    const user = await withRequestDeadline(
      connection.sendMessagePromise<{
        name: string;
        is_admin: boolean;
      }>({ type: "auth/current_user" }),
    );
    connection.addEventListener("disconnected", () => {
      close();
      disconnected();
    });
    connection.addEventListener("reconnect-error", () => {
      close();
      disconnected();
    });
    return {
      name: user.name,
      close,
      client: new JournalClient({
        callWS: (message) => {
          if (closed || !connection.connected)
            return Promise.reject(new ApiError("connection_lost"));
          return connection.sendMessagePromise(message);
        },
        fetchWithAuth: (path, init) => {
          const method = requestMethod(path);
          if (closed || !method || (init?.method ?? "GET") !== method) {
            return Promise.reject(new ApiError("unauthorized"));
          }
          return fetch(path, {
            ...init,
            method,
            redirect: "error",
            credentials: "omit",
            mode: "same-origin",
            headers: {
              Authorization: `Bearer ${auth.data.access_token}`,
              ...(method === "POST"
                ? { "Content-Type": "application/octet-stream" }
                : {}),
            },
          });
        },
      }),
    };
  } catch (error) {
    close();
    throw error;
  }
}
