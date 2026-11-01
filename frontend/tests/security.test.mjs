/** Exercise development-server boundaries with fictional data and local requests. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { request } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { build, createServer, loadEnv } from "vite";
import config from "../vite.config.mjs";

function get(port, path, headers = {}, method = "GET") {
  return new Promise((resolve, reject) => {
    const req = request(
      { host: "127.0.0.1", port, path, headers, method },
      (response) => {
        let body = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          body += chunk;
        });
        response.on("end", () =>
          resolve({
            status: response.statusCode,
            headers: response.headers,
            body,
          }),
        );
      },
    );
    req.setTimeout(2000, () =>
      req.destroy(new Error("Local test request timed out")),
    );
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

test("the production graph rejects development entry points and fixtures", async () => {
  const output = await mkdtemp(join(tmpdir(), "kaleidescape-build-"));
  try {
    await assert.rejects(
      build({
        ...config,
        configFile: false,
        logLevel: "silent",
        build: {
          ...config.build,
          write: false,
          outDir: output,
          lib: {
            ...config.build.lib,
            entry: fileURLToPath(new URL("../dev/main.ts", import.meta.url)),
          },
        },
      }),
      /must not import development modules or test fixtures/,
    );
  } finally {
    await rm(output, { recursive: true, force: true });
  }
});

test("Vite rejects foreign hosts and files outside the frontend, without CORS", async () => {
  const envFile = fileURLToPath(
    new URL(`.env.security-${randomUUID()}`, import.meta.url),
  );
  await writeFile(envFile, "fictional-secret", { flag: "wx" });
  let server;
  try {
    server = await createServer({
      ...config,
      configFile: false,
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
    const local = await get(address.port, "/", {
      Origin: "https://untrusted.example",
    });
    assert.equal(local.status, 200);
    assert.equal(local.headers["access-control-allow-origin"], undefined);
    const outside = fileURLToPath(
      new URL("../../pyproject.toml", import.meta.url),
    );
    assert.equal((await get(address.port, `/@fs/${outside}`)).status, 403);
    const denied = await get(address.port, `/@fs/${envFile}`);
    assert.equal(denied.status, 403);
    assert.equal(denied.body.includes("fictional-secret"), false);
  } finally {
    await server?.close();
    await rm(envFile, { force: true });
  }
});

test("API proxy accepts only local-origin export/artwork GETs and never supplies credentials", async () => {
  const { createServer: createHttpServer } = await import("node:http");
  const received = [];
  const backend = createHttpServer((request, response) => {
    received.push(request.headers);
    response.writeHead(request.headers.authorization ? 200 : 401, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    });
    response.end("{}");
  });
  let server;
  try {
    await new Promise((resolve) => backend.listen(0, "127.0.0.1", resolve));
    server = await createServer({
      ...config,
      configFile: false,
      logLevel: "silent",
      server: {
        ...config.server,
        watch: null,
        proxy: {
          "^/api/(kaleidescape_companion/|media_player_proxy/)": {
            target: `http://127.0.0.1:${backend.address().port}`,
            ws: false,
          },
        },
      },
    });
    await new Promise((resolve, reject) => {
      server.httpServer.once("error", reject);
      server.httpServer.listen(0, "127.0.0.1", resolve);
    });
    const port = server.httpServer.address().port;
    const path =
      "/api/kaleidescape_companion/test-entry/a323bd20-1b55-4562-87b0-9999944759f3/export?format=json";
    assert.equal(
      (
        await get(port, path, {
          Origin: "https://untrusted.example",
          Authorization: "Bearer fictional",
        })
      ).status,
      403,
    );
    assert.equal(
      (await get(port, path, { Authorization: "Bearer fictional" })).status,
      403,
    );
    assert.equal(
      (
        await get(port, path + "&url=http://untrusted.example", {
          Origin: "http://127.0.0.1:5173",
        })
      ).status,
      404,
    );
    assert.equal(
      (
        await get(port, "/api/kaleidescape_companion/arbitrary", {
          Origin: "http://127.0.0.1:5173",
        })
      ).status,
      404,
    );
    assert.equal(received.length, 0);
    const accepted = await get(port, path, {
      Origin: "http://127.0.0.1:5173",
      Authorization: "Bearer fictional",
    });
    assert.equal(accepted.status, 200);
    assert.equal(received[0].authorization, "Bearer fictional");
    assert.equal(received[0].origin, "http://127.0.0.1:5173");
    assert.equal(
      (await get(port, path, { "Sec-Fetch-Site": "same-origin" })).status,
      401,
    );
    assert.equal(received[1].authorization, undefined);
    const artwork = "/api/media_player_proxy/media_player.example";
    const headers = {
      Origin: "http://127.0.0.1:5173",
      Authorization: "Bearer fictional",
    };
    assert.equal((await get(port, artwork, headers)).status, 200);
    assert.equal(received[2].authorization, "Bearer fictional");
    for (const invalid of [
      artwork + "?token=fictional",
      artwork + "?url=http://untrusted.example",
      "/api/media_player_proxy/sensor.example",
      artwork + "/browse_media/movie/anything",
      "/api/media_player_proxy/../auth",
    ]) {
      assert.equal((await get(port, invalid, headers)).status, 404);
    }
    assert.equal(
      (
        await get(port, artwork, {
          ...headers,
          Origin: "https://untrusted.example",
        })
      ).status,
      403,
    );
    assert.equal(received.length, 3);
    assert.equal((await get(port, artwork, headers, "POST")).status, 405);
    assert.equal(received.length, 3);
    const importing = path.replace(
      /export\?format=json$/,
      "import/preview?format=json",
    );
    assert.equal((await get(port, importing, headers, "GET")).status, 405);
    assert.equal(
      (
        await get(
          port,
          importing,
          { ...headers, Origin: "https://untrusted.example" },
          "POST",
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await get(
          port,
          importing + "&url=http://untrusted.example",
          headers,
          "POST",
        )
      ).status,
      404,
    );
    assert.equal((await get(port, importing, headers, "POST")).status, 200);
    assert.equal(received.length, 4);
    assert.equal(received[3].authorization, "Bearer fictional");
    const cover = path.replace(
      /export\?format=json$/,
      `library/artwork/${"a".repeat(64)}`,
    );
    assert.equal((await get(port, cover, headers)).status, 200);
    assert.equal(received[4].authorization, "Bearer fictional");
    for (const invalid of [
      cover + "?url=http://untrusted.example",
      cover + "/extra",
      cover.replace(/a{64}$/, ".."),
    ]) {
      assert.equal((await get(port, invalid, headers)).status, 404);
    }
    assert.equal(
      (
        await get(port, cover, {
          ...headers,
          Origin: "https://untrusted.example",
        })
      ).status,
      403,
    );
    assert.equal((await get(port, cover, headers, "POST")).status, 405);
    assert.equal(received.length, 5);
    const reviewImage = path.replace(
      /export\?format=json$/,
      "metadata/review/12345678-1234-4234-9234-123456789abc/image/poster-0",
      "metadata/review/12345678-1234-4234-9234-123456789abc/image/match-0",
    );
    assert.equal((await get(port, reviewImage, headers)).status, 200);
    assert.equal(received[5].authorization, "Bearer fictional");
    for (const invalid of [
      reviewImage + "?url=https://untrusted.example",
      reviewImage.replace("poster-0", "../settings"),
      reviewImage + "/extra",
    ]) {
      assert.equal((await get(port, invalid, headers)).status, 404);
    }
    assert.equal(
      (
        await get(port, reviewImage, {
          ...headers,
          Origin: "https://untrusted.example",
        })
      ).status,
      403,
    );
    assert.equal((await get(port, reviewImage, headers, "POST")).status, 405);
    assert.equal(received.length, 6);
    const removed = path.replace(
      /export\?format=json$/,
      "library/purchases/preview",
    );
    assert.equal((await get(port, removed, headers, "POST")).status, 404);
    assert.equal(
      (await get(port, importing + "&url=http://evil.invalid", headers, "POST"))
        .status,
      404,
    );
    assert.equal(received.length, 6);
  } finally {
    await server?.close();
    await new Promise((resolve) => backend.close(resolve));
  }
});
