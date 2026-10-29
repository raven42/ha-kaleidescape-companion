/** The preview shell and proxy share this exact, fixed-local-HA route contract. */
export const HA_TARGET = "http://127.0.0.1:8123";
const scope =
  "/api/kaleidescape_companion/[a-zA-Z0-9_-]{1,64}/[a-fA-F0-9-]{36}";
const reads = [
  new RegExp(`^${scope}/export\\?format=(json|sqlite)$`),
  /^\/api\/media_player_proxy\/media_player\.[a-z0-9_]{1,255}$/,
  new RegExp(`^${scope}/library/artwork/[a-f0-9]{64}$`),
];
const writes = [new RegExp(`^${scope}/import/preview\\?format=(json|sqlite)$`)];

/** @param {string} path @returns {"GET" | "POST" | undefined} */
export function requestMethod(path) {
  if (reads.some((route) => route.test(path))) return "GET";
  if (writes.some((route) => route.test(path))) return "POST";
  return undefined;
}
