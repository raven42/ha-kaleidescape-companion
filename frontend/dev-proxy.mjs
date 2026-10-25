/** Fixed local export route; credentials always come from the requesting browser. */
export const HA_TARGET = "http://127.0.0.1:8123";
const exportPath =
  /^\/api\/kaleidescape_companion\/[a-zA-Z0-9_-]{1,64}\/[a-fA-F0-9-]{36}\/export\?format=(json|sqlite)$/;
const origins = new Set(["http://127.0.0.1:5173", "http://localhost:5173"]);
export function localExportGuard() {
  return {
    name: "kaleidescape-local-export-guard",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (!request.url?.startsWith("/api/kaleidescape_companion/"))
          return next();
        let code;
        if (!exportPath.test(request.url)) code = 404;
        else if (request.method !== "GET") code = 405;
        else if (!(
          origins.has(request.headers.origin) ||
          (!request.headers.origin &&
            request.headers["sec-fetch-site"] === "same-origin")
        ))
          code = 403;
        if (code) {
          response.writeHead(code);
          response.end("Development export request rejected");
          return;
        }
        next();
      });
    },
  };
}
