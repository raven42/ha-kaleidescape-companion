/** Local development only. No saved tokens, arbitrary HA targets, or auth proxy. */
import {
  createConnection,
  createLongLivedTokenAuth,
} from "home-assistant-js-websocket";
import { ApiError, JournalClient, withRequestDeadline } from "./api";

export const DEVELOPMENT_HA = "http://127.0.0.1:8123";
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
    if (!user.is_admin) throw new ApiError("unauthorized");
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
          if (
            closed ||
            !/^\/api\/kaleidescape_companion\/[a-zA-Z0-9_-]{1,64}\/[a-fA-F0-9-]{36}\/export\?format=(json|sqlite)$/.test(
              path,
            )
          ) {
            return Promise.reject(new ApiError("unauthorized"));
          }
          return fetch(path, {
            ...init,
            method: "GET",
            redirect: "error",
            credentials: "omit",
            mode: "same-origin",
            headers: { Authorization: `Bearer ${auth.data.access_token}` },
          });
        },
      }),
    };
  } catch (error) {
    close();
    throw error;
  }
}
