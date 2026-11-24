/** Panel-private Library results; optional browser storage is scoped per user. */
import type { LibraryPage } from "../core/api";

const MAX_BYTES = 8 * 1024 * 1024;
const MAX_ENTRIES = 4;
type Entry = { key: string; page: LibraryPage; bytes: number };

class PersistentPages {
  private db?: Promise<IDBDatabase>;
  constructor(private namespace: string) {}
  private open() {
    return (this.db ??= new Promise((resolve, reject) => {
      const request = indexedDB.open("kaleidescape-companion-library-pages", 1);
      request.onupgradeneeded = () => request.result.createObjectStore("pages");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error("Library storage is blocked"));
    }));
  }
  close() {
    void this.db?.then((db) => db.close()).catch(() => {});
    this.db = undefined;
  }
  async get(key: string): Promise<LibraryPage | undefined> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const request = db
        .transaction("pages", "readonly")
        .objectStore("pages")
        .get(this.namespace);
      request.onsuccess = () => {
        const entries: unknown = request.result;
        const entry = Array.isArray(entries)
          ? entries.find((value) => value?.key === key)
          : undefined;
        const page = entry?.page;
        resolve(
          page &&
            Array.isArray(page.items) &&
            typeof page.revision === "number" &&
            typeof page.cache_revision === "number" &&
            typeof page.cache_context === "string" &&
            page.facets &&
            Array.isArray(page.truncated_facets)
            ? page
            : undefined,
        );
      };
      request.onerror = () => reject(request.error);
    });
  }
  async put(entry: Entry): Promise<void> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("pages", "readwrite");
      const store = transaction.objectStore("pages");
      const request = store.get(this.namespace);
      request.onsuccess = () => {
        const previous: unknown = request.result;
        const entries: Entry[] = Array.isArray(previous)
          ? previous.filter(
              (item) =>
                item &&
                typeof item.key === "string" &&
                item.key !== entry.key &&
                typeof item.bytes === "number" &&
                item.bytes >= 0 &&
                item.bytes <= MAX_BYTES,
            )
          : [];
        entries.push(entry);
        let bytes = entries.reduce((sum, item) => sum + item.bytes, 0);
        while (entries.length > MAX_ENTRIES || bytes > MAX_BYTES)
          bytes -= entries.shift()!.bytes;
        store.put(entries, this.namespace);
      };
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  }
  async clear(): Promise<void> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("pages", "readwrite");
      transaction.objectStore("pages").delete(this.namespace);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  }
}

export class LibraryPageCache {
  private entries = new Map<string, Entry>();
  private bytes = 0;
  private store?: PersistentPages;
  private epoch = 0;
  private closed = false;
  private clearing = false;
  private writes = new Set<Promise<void>>();
  setPersistent(namespace?: string) {
    this.store?.close();
    this.epoch++;
    this.store = namespace ? new PersistentPages(namespace) : undefined;
    const store = this.store,
      epoch = this.epoch;
    if (store)
      this.track(
        (async () => {
          for (const entry of this.entries.values()) {
            if (this.closed || this.clearing || this.epoch !== epoch) return;
            await store.put(entry);
          }
        })().catch(() => {}),
      );
  }
  private track(write: Promise<void>) {
    this.writes.add(write);
    void write.then(() => this.writes.delete(write));
  }
  get(key: string): LibraryPage | undefined {
    const entry = this.entries.get(key);
    if (!entry || this.closed) return undefined;
    this.entries.delete(key);
    this.entries.set(key, entry);
    return structuredClone(entry.page);
  }
  async restore(key: string): Promise<LibraryPage | undefined> {
    const store = this.store,
      epoch = this.epoch;
    if (!store || this.closed) return undefined;
    try {
      let timeout: ReturnType<typeof setTimeout> | undefined;
      const page = await Promise.race([
        store.get(key),
        new Promise<undefined>((resolve) => {
          timeout = setTimeout(() => resolve(undefined), 1500);
        }),
      ]).finally(() => clearTimeout(timeout));
      if (!page || this.closed || epoch !== this.epoch) return undefined;
      this.putMemory(key, page);
      return structuredClone(page);
    } catch {
      return undefined;
    }
  }
  put(key: string, page: LibraryPage) {
    const entry = this.putMemory(key, page);
    if (entry && this.store && !this.clearing)
      this.track(this.store.put(entry).catch(() => {}));
  }
  private putMemory(key: string, page: LibraryPage): Entry | undefined {
    if (this.closed) return;
    const bytes = new TextEncoder().encode(JSON.stringify(page)).byteLength;
    this.remove(key);
    if (bytes > MAX_BYTES) return;
    while (this.entries.size >= MAX_ENTRIES || this.bytes + bytes > MAX_BYTES) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.remove(oldest);
    }
    const entry = { key, page: structuredClone(page), bytes };
    this.entries.set(key, entry);
    this.bytes += bytes;
    return entry;
  }
  private remove(key: string) {
    const entry = this.entries.get(key);
    if (entry) this.bytes -= entry.bytes;
    this.entries.delete(key);
  }
  async clear(namespace?: string) {
    this.epoch++;
    this.clearing = true;
    await Promise.all([...this.writes]);
    this.entries.clear();
    this.bytes = 0;
    try {
      if (namespace) {
        const store = new PersistentPages(namespace);
        try {
          await store.clear();
        } finally {
          store.close();
        }
      }
    } finally {
      this.clearing = false;
    }
  }
  dispose() {
    this.closed = true;
    this.epoch++;
    this.store?.close();
    this.store = undefined;
    this.entries.clear();
    this.bytes = 0;
  }
}
