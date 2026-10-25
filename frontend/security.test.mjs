/** Exercise development-server boundaries with fictional data and local requests. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { request } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer, loadEnv } from "vite";
import config from "./vite.config.mjs";

function get(port, path, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = request({ host: "127.0.0.1", port, path, headers }, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        body += chunk;
      });
      response.on("end", () => resolve({
        status: response.statusCode,
        headers: response.headers,
        body,
      }));
    });
    req.setTimeout(2000, () => req.destroy(new Error("Local test request timed out")));
    req.on("error", reject);
    req.end();
  });
}

test("custom environment values are excluded from browser configuration", async () => {
  const directory = await mkdtemp(join(tmpdir(), "kaleidescape-env-"));
  try {
    await writeFile(
      join(directory, ".env"),
      "VITE_TOKEN=fictional-secret\nHA_TOKEN=fictional-secret\n",
    );
    assert.deepEqual(loadEnv("development", directory, config.envPrefix), {});
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("Vite rejects foreign hosts and files outside the frontend, without CORS", async () => {
  const envFile = fileURLToPath(new URL(`.env.security-${randomUUID()}`, import.meta.url));
  await writeFile(envFile, "fictional-secret", { flag: "wx" });
  let server;
  try {
    server = await createServer({
      ...config,
      configFile: false,
      root: fileURLToPath(new URL(".", import.meta.url)),
      logLevel: "silent",
      server: { ...config.server, port: 0, watch: null },
    });
    // An ephemeral listener keeps this test independent of user-run servers.
    await new Promise((resolve, reject) => {
      server.httpServer.once("error", reject);
      server.httpServer.listen(0, "127.0.0.1", resolve);
    });
    const address = server.httpServer.address();
    assert.equal(address.address, "127.0.0.1");
    const foreign = await get(address.port, "/", { Host: "untrusted.example" });
    assert.equal(foreign.status, 403);
    const local = await get(address.port, "/", { Origin: "https://untrusted.example" });
    assert.equal(local.status, 200);
    assert.equal(local.headers["access-control-allow-origin"], undefined);
    const outside = fileURLToPath(new URL("../pyproject.toml", import.meta.url));
    assert.equal((await get(address.port, `/@fs/${outside}`)).status, 403);
    const denied = await get(address.port, `/@fs/${envFile}`);
    assert.equal(denied.status, 403);
    assert.equal(denied.body.includes("fictional-secret"), false);
  } finally {
    await server?.close();
    await rm(envFile, { force: true });
  }
});
