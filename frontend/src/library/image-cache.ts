/** Private, bounded object URLs shared only by one mounted Library session. */
type Reader = { invalidate: () => void; visible: () => boolean };
export class CoverCache {
  private entries = new Map<string, { url: string; size: number }>();
  private readers = new Map<string, Set<Reader>>();
  private bytes = 0;
  private closed = false;
  constructor(
    private maxBytes = 128 * 1024 * 1024,
    private maxEntries = 1000,
  ) {}
  get(key: string) {
    const entry = this.entries.get(key);
    if (entry) {
      this.entries.delete(key);
      this.entries.set(key, entry);
    }
    return entry?.url;
  }
  put(key: string, blob: Blob) {
    if (this.closed || blob.size > this.maxBytes) return;
    const existing = this.get(key);
    if (existing) return existing;
    while (
      this.bytes + blob.size > this.maxBytes ||
      this.entries.size >= this.maxEntries
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
    const entry = { url: URL.createObjectURL(blob), size: blob.size };
    this.entries.set(key, entry);
    this.bytes += entry.size;
    return entry.url;
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
  dispose() {
    this.closed = true;
    for (const key of this.entries.keys()) this.drop(key);
    this.readers.clear();
  }
}
