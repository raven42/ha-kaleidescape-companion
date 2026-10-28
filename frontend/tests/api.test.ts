import { expect, it, vi } from "vitest";
import {
  ApiError,
  JournalClient,
  MAX_DOWNLOAD_BYTES,
  MAX_ARTWORK_BYTES,
  errorMessage,
} from "../src/api";
import { FixtureTransport, info } from "./fixture";

it("takes only entry/dataset identifiers from metadata and freezes retry input", async () => {
  const transport = new FixtureTransport(),
    client = transport.client();
  await client.list(info);
  await client.get(info, transport.records[0].id);
  expect(transport.calls[0]).toEqual({
    type: "kaleidescape_companion/journal/list",
    entry_id: info.entry_id,
    dataset_id: info.dataset_id,
    query: "",
    limit: 25,
  });
  const data = { title: "Initial title" };
  const request = client.prepare(info, "create", {
    data,
    request_id: "forged",
    dataset_id: "forged",
  });
  data.title = "Changed after preparation";
  expect(request.message.data).toEqual({ title: "Initial title" });
  expect(request.message.dataset_id).toBe(info.dataset_id);
  expect(request.message.request_id).not.toBe("forged");
});
it("creates secure mutation request UUIDs when randomUUID is unavailable", () => {
  const getRandomValues = crypto.getRandomValues.bind(crypto);
  vi.stubGlobal("crypto", { getRandomValues });
  try {
    const client = new JournalClient({
      callWS: vi.fn(),
      fetchWithAuth: vi.fn(),
    });
    const ids = ["create", "update", "delete"].map(
      (operation) =>
        client.prepare(info, operation as "create" | "update" | "delete", {})
          .message.request_id,
    );
    for (const id of ids)
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
    expect(new Set(ids).size).toBe(3);
  } finally {
    vi.unstubAllGlobals();
  }
});
it("refuses mutation preparation when secure randomness is unavailable", () => {
  vi.stubGlobal("crypto", undefined);
  try {
    const callWS = vi.fn();
    const client = new JournalClient({ callWS, fetchWithAuth: vi.fn() });
    expect(() => client.prepare(info, "delete", {})).toThrowError(
      "request_id_unavailable",
    );
    expect(callWS).not.toHaveBeenCalled();
  } finally {
    vi.unstubAllGlobals();
  }
});
it("bounds requests and treats a timeout as an unconfirmed result", async () => {
  vi.useFakeTimers();
  try {
    const client = new JournalClient({
      callWS: () => new Promise(() => {}),
      fetchWithAuth: vi.fn(),
    });
    const promise = expect(client.info()).rejects.toMatchObject({
      code: "connection_lost",
    });
    await vi.advanceTimersByTimeAsync(15001);
    await promise;
  } finally {
    vi.useRealTimers();
  }
});
it("uses authenticated, uncached exports and cancels readers above the browser limit", async () => {
  const reader = {
    read: vi.fn().mockResolvedValue({
      value: { byteLength: MAX_DOWNLOAD_BYTES + 1 },
      done: false,
    }),
    cancel: vi.fn().mockResolvedValue(undefined),
    releaseLock: vi.fn(),
  };
  const fetchWithAuth = vi
    .fn()
    .mockResolvedValue({ ok: true, body: { getReader: () => reader } });
  const client = new JournalClient({ callWS: vi.fn(), fetchWithAuth });
  const signal = new AbortController().signal;
  await expect(client.download(info, "json", signal)).rejects.toMatchObject({
    code: "export_too_large",
  });
  expect(fetchWithAuth).toHaveBeenCalledWith(
    expect.stringContaining("/export?format=json"),
    { signal, cache: "no-store", redirect: "error" },
  );
  expect(reader.cancel).toHaveBeenCalled();
  expect(reader.releaseLock).toHaveBeenCalled();
});
it("does not render error details or credentials supplied by the server", () => {
  expect(
    errorMessage({
      code: "invalid_request",
      message: "private-token <script>attack</script>",
    }),
  ).not.toContain("private-token");
  expect(errorMessage(new ApiError("unauthorized"))).toContain(
    "Access to this operation is denied",
  );
});
it("fetches only an HA media-player cover without query credentials and rejects active content", async () => {
  const fetchWithAuth = vi
    .fn()
    .mockResolvedValue(
      new Response("fictional", { headers: { "Content-Type": "image/jpeg" } }),
    );
  const client = new JournalClient({ callWS: vi.fn(), fetchWithAuth });
  const signal = new AbortController().signal;
  expect((await client.artwork("media_player.example", signal))?.type).toBe(
    "image/jpeg",
  );
  expect(fetchWithAuth).toHaveBeenCalledWith(
    "/api/media_player_proxy/media_player.example",
    {
      signal,
      cache: "no-store",
      redirect: "error",
    },
  );
  for (const value of [
    "https://untrusted.example/image",
    "media_player.example?token=secret",
    "../auth",
    "sensor.example",
  ]) {
    await expect(client.artwork(value, signal)).rejects.toMatchObject({
      code: "invalid_request",
    });
  }
  expect(fetchWithAuth).toHaveBeenCalledTimes(1);
  fetchWithAuth.mockResolvedValueOnce(
    new Response("<svg></svg>", {
      headers: { "Content-Type": "image/svg+xml" },
    }),
  );
  expect(await client.artwork("media_player.example", signal)).toBeNull();
  const cancel = vi.fn().mockResolvedValue(undefined);
  fetchWithAuth.mockResolvedValueOnce({
    ok: false,
    status: 404,
    body: { cancel },
  });
  expect(await client.artwork("media_player.example", signal)).toBeNull();
  expect(cancel).toHaveBeenCalled();
});
it("bounds cover downloads, cancels overflow, and propagates revoked authentication", async () => {
  const reader = {
    read: vi.fn().mockResolvedValue({
      value: { byteLength: MAX_ARTWORK_BYTES + 1 },
      done: false,
    }),
    cancel: vi.fn().mockResolvedValue(undefined),
    releaseLock: vi.fn(),
  };
  const fetchWithAuth = vi.fn().mockResolvedValue({
    ok: true,
    headers: new Headers({ "Content-Type": "image/png" }),
    body: { getReader: () => reader },
  });
  const client = new JournalClient({ callWS: vi.fn(), fetchWithAuth });
  const signal = new AbortController().signal;
  await expect(
    client.artwork("media_player.example", signal),
  ).rejects.toMatchObject({ code: "export_too_large" });
  expect(reader.cancel).toHaveBeenCalled();
  expect(reader.releaseLock).toHaveBeenCalled();
  fetchWithAuth.mockResolvedValueOnce(new Response(null, { status: 403 }));
  await expect(
    client.artwork("media_player.example", signal),
  ).rejects.toMatchObject({ code: "unauthorized" });
});

it("fetches library covers only from the scoped opaque-key endpoint", async () => {
  const transport = new FixtureTransport(),
    client = transport.client();
  const download = vi.spyOn(transport, "fetchWithAuth").mockResolvedValue(
    new Response(new Uint8Array([137, 80, 78, 71]), {
      headers: { "Content-Type": "image/png" },
    }),
  );
  const signal = new AbortController().signal,
    key = "a".repeat(64);
  const blob = await client.libraryArtwork(info, key, signal);
  expect(blob.type).toBe("image/png");
  expect(download).toHaveBeenCalledWith(
    `/api/kaleidescape_companion/${info.entry_id}/${info.dataset_id}/library/artwork/${key}`,
    { signal, cache: "no-store", redirect: "error" },
  );
  await expect(
    client.libraryArtwork(info, "../../settings", signal),
  ).rejects.toMatchObject({ code: "invalid_request" });
  expect(download).toHaveBeenCalledTimes(1);
});
