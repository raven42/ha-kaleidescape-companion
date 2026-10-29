/** Fixed local HA routes; credentials always come from the requesting browser. */
export const HA_TARGET = "http://127.0.0.1:8123";
const exportPath =
  /^\/api\/kaleidescape_companion\/[a-zA-Z0-9_-]{1,64}\/[a-fA-F0-9-]{36}\/export\?format=(json|sqlite)$/;
const artworkPath =
  /^\/api\/media_player_proxy\/media_player\.[a-z0-9_]{1,255}$/;
const libraryArtworkPath =
  /^\/api\/kaleidescape_companion\/[a-zA-Z0-9_-]{1,64}\/[a-fA-F0-9-]{36}\/library\/artwork\/[a-f0-9]{64}$/;
const importPath =
  /^\/api\/kaleidescape_companion\/[a-zA-Z0-9_-]{1,64}\/[a-fA-F0-9-]{36}\/import\?format=(json|sqlite)&request_id=[a-f0-9-]{36}&revision=[0-9]{1,18}$/;
const purchasePreviewPath =
  /^\/api\/kaleidescape_companion\/[a-zA-Z0-9_-]{1,64}\/[a-fA-F0-9-]{36}\/library\/purchases\/preview$/;
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
        const importing =
          importPath.test(request.url) || purchasePreviewPath.test(request.url);
        if (
          !exportPath.test(request.url) &&
          !artworkPath.test(request.url) &&
          !libraryArtworkPath.test(request.url) &&
          !importing
        )
          code = 404;
        else if (request.method !== (importing ? "POST" : "GET")) code = 405;
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
