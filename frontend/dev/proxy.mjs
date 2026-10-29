/** Fixed local HA routes; credentials always come from the requesting browser. */
import { requestMethod } from "./routes.mjs";
export { HA_TARGET } from "./routes.mjs";
const origins = new Set(["http://127.0.0.1:5173", "http://localhost:5173"]);
export function localApiGuard() {
  return {
    name: "kaleidescape-local-api-guard",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (
          !request.url?.startsWith("/api/kaleidescape_companion/") &&
          !request.url?.startsWith("/api/media_player_proxy/")
        )
          return next();
        let code;
        const method = requestMethod(request.url);
        if (!method) code = 404;
        else if (request.method !== method) code = 405;
        else if (!(
          origins.has(request.headers.origin) ||
          (!request.headers.origin &&
            request.headers["sec-fetch-site"] === "same-origin")
        ))
          code = 403;
        if (code) {
          response.writeHead(code);
          response.end("Development API request rejected");
          return;
        }
        next();
      });
    },
  };
}
