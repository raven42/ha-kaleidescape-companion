/** Browser-private artwork blobs, partitioned by authenticated user and dataset. */
export class PersistentCovers {
  private db?: Promise<IDBDatabase>;
  constructor(private namespace: string) {}
  private open(): Promise<IDBDatabase> {
    return (this.db ??= new Promise((resolve, reject) => {
      const request = indexedDB.open("kaleidescape-companion-covers", 1);
      request.onupgradeneeded = () =>
        request.result.createObjectStore("covers");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error("Cover storage is blocked"));
    }));
  }
  private key(key: string) {
    return JSON.stringify([this.namespace, key]);
  }
  close() {
    void this.db?.then((db) => db.close()).catch(() => {});
    this.db = undefined;
  }
  async get(key: string): Promise<Blob | undefined> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const request = db
        .transaction("covers", "readonly")
        .objectStore("covers")
        .get(this.key(key));
      request.onsuccess = () =>
        resolve(request.result instanceof Blob ? request.result : undefined);
      request.onerror = () => reject(request.error);
    });
  }
  async remove(key: string): Promise<void> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("covers", "readwrite");
      transaction.objectStore("covers").delete(this.key(key));
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  }
  async clear(): Promise<void> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("covers", "readwrite");
      const request = transaction.objectStore("covers").openCursor();
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) return;
        try {
          const key =
            typeof cursor.key === "string" ? JSON.parse(cursor.key) : null;
          if (Array.isArray(key) && key[0] === this.namespace) cursor.delete();
        } catch {
          /* Ignore entries owned by other formats. */
        }
        cursor.continue();
      };
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  }
  async put(key: string, blob: Blob): Promise<void> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("covers", "readwrite");
      transaction.objectStore("covers").put(blob, this.key(key));
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  }
}
