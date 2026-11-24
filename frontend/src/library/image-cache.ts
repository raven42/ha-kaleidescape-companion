import { PersistentCovers } from "./persistent-covers";

/** Private object URLs, with optional persistent blobs scoped to one user. */
type Reader = {
  invalidate: () => void;
  visible: () => boolean;
  refresh?: () => void;
};
export class CoverCache {
  private entries = new Map<
    string,
    { url: string; size: number; blob: Blob }
  >();
  private readers = new Map<string, Set<Reader>>();
  private bytes = 0;
  private closed = false;
  private unlimited = false;
  private persistent?: PersistentCovers;
  private epoch = 0;
  private clearing = false;
  private writes = new Set<Promise<void>>();
  constructor(
    private maxBytes = 512 * 1024 * 1024,
    private maxEntries = 4096,
  ) {}
  get(key: string) {
    const entry = this.entries.get(key);
    if (entry) {
      this.entries.delete(key);
      this.entries.set(key, entry);
    }
    return entry?.url;
  }
  setPersistent(namespace?: string) {
    this.persistent?.close();
    this.epoch++;
    this.persistent = namespace ? new PersistentCovers(namespace) : undefined;
    const store = this.persistent;
    const epoch = this.epoch;
    if (store) {
      const write = (async () => {
        for (const [key, entry] of this.entries) {
          if (this.closed || this.clearing || this.epoch !== epoch) return;
          await store.put(key, entry.blob);
        }
      })().catch(() => {});
      this.trackWrite(write);
    }
  }
  private trackWrite(write: Promise<void>) {
    this.writes.add(write);
    void write.then(() => this.writes.delete(write));
  }
  async restore(key: string) {
    const store = this.persistent;
    const epoch = this.epoch;
    if (!store || this.closed) return undefined;
    try {
      let timeout: ReturnType<typeof setTimeout> | undefined;
      const blob = await Promise.race([
        store.get(key),
        new Promise<undefined>((resolve) => {
          timeout = setTimeout(() => resolve(undefined), 1500);
        }),
      ]).finally(() => clearTimeout(timeout));
      if (!blob || this.closed || epoch !== this.epoch) return undefined;
      return this.putMemory(key, blob);
    } catch {
      return undefined;
    }
  }
  setUnlimited(unlimited: boolean) {
    this.unlimited = unlimited;
    if (!unlimited) this.evictToFit(0, 0);
  }
  put(key: string, blob: Blob) {
    if (!this.closed && !this.clearing && this.persistent) {
      const write = this.persistent.put(key, blob).catch(() => {});
      this.trackWrite(write);
    }
    return this.putMemory(key, blob);
  }
  private putMemory(key: string, blob: Blob) {
    if (this.closed || (!this.unlimited && blob.size > this.maxBytes)) return;
    const existing = this.get(key);
    if (existing) return existing;
    if (!this.unlimited) this.evictToFit(blob.size, 1);
    const entry = { url: URL.createObjectURL(blob), size: blob.size, blob };
    this.entries.set(key, entry);
    this.bytes += entry.size;
    return entry.url;
  }
  private evictToFit(extraBytes: number, extraEntries: number) {
    while (
      this.bytes + extraBytes > this.maxBytes ||
      this.entries.size + extraEntries > this.maxEntries
    ) {
      // Prefer the least recently used offscreen cover. If the visible set
      // alone exceeds the budget, eviction still enforces the hard limit.
      const keys = [...this.entries.keys()];
      const victim =
        keys.find(
          (name) =>
            ![...(this.readers.get(name) ?? [])].some((reader) =>
              reader.visible(),
            ),
        ) ?? keys[0];
      if (victim === undefined) return;
      this.drop(victim);
    }
  }
  async clear(namespace?: string) {
    this.epoch++;
    this.clearing = true;
    await Promise.all([...this.writes]);
    let failure: unknown;
    if (namespace) {
      const store = new PersistentCovers(namespace);
      try {
        await store.clear();
      } catch (error) {
        failure = error;
      } finally {
        store.close();
      }
    }
    this.clearing = false;
    if (this.closed) return;
    for (const key of [...this.entries.keys()]) this.drop(key);
    for (const readers of this.readers.values())
      for (const reader of readers) reader.refresh?.();
    if (failure) throw failure;
  }
  watch(key: string, reader: Reader) {
    if (this.closed) return () => {};
    const readers = this.readers.get(key) ?? new Set<Reader>();
    readers.add(reader);
    this.readers.set(key, readers);
    return () => {
      readers.delete(reader);
      if (!readers.size) this.readers.delete(key);
    };
  }
  drop(key: string) {
    const entry = this.entries.get(key);
    if (!entry) return;
    this.entries.delete(key);
    this.bytes -= entry.size;
    URL.revokeObjectURL(entry.url);
    for (const reader of this.readers.get(key) ?? []) reader.invalidate();
  }
  discard(key: string) {
    this.drop(key);
    if (this.persistent) void this.persistent.remove(key).catch(() => {});
  }
  dispose() {
    this.closed = true;
    this.persistent?.close();
    this.epoch++;
    this.persistent = undefined;
    for (const key of this.entries.keys()) this.drop(key);
    this.readers.clear();
  }
}
