/**
 * Lightweight IndexedDB-backed write queue.
 * Use for non-critical writes (meal logs, mindset reps, check-ins) so a flaky
 * connection never loses user input. Caller registers a drain handler per kind;
 * the queue replays items in order and removes them on success.
 */
const DB_NAME = "rebuilt-offline";
const STORE = "writes";
const VERSION = 1;

export type QueuedWrite<T = unknown> = {
  id: string;
  kind: string;
  payload: T;
  enqueuedAt: number;
  attempts: number;
};

type DrainHandler = (item: QueuedWrite) => Promise<void>;
const handlers = new Map<string, DrainHandler>();

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => Promise<T> | T): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const store = t.objectStore(STORE);
    let result: T | undefined;
    Promise.resolve(fn(store)).then((r) => (result = r)).catch(reject);
    t.oncomplete = () => resolve(result as T);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

export async function enqueue<T>(kind: string, payload: T): Promise<QueuedWrite<T>> {
  const item: QueuedWrite<T> = {
    id: `${kind}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
    kind,
    payload,
    enqueuedAt: Date.now(),
    attempts: 0,
  };
  await tx("readwrite", (s) => {
    s.put(item);
  });
  return item;
}

export async function list(): Promise<QueuedWrite[]> {
  return tx("readonly", (s) => new Promise<QueuedWrite[]>((resolve) => {
    const req = s.getAll();
    req.onsuccess = () => resolve((req.result as QueuedWrite[]) ?? []);
    req.onerror = () => resolve([]);
  }));
}

export async function remove(id: string) {
  await tx("readwrite", (s) => { s.delete(id); });
}

export async function bump(id: string) {
  await tx("readwrite", (s) => new Promise<void>((resolve) => {
    const req = s.get(id);
    req.onsuccess = () => {
      const item = req.result as QueuedWrite | undefined;
      if (item) {
        item.attempts += 1;
        s.put(item);
      }
      resolve();
    };
    req.onerror = () => resolve();
  }));
}

export function registerHandler(kind: string, handler: DrainHandler) {
  handlers.set(kind, handler);
}

let draining = false;
export async function drain(): Promise<{ drained: number; failed: number }> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return { drained: 0, failed: 0 };
  if (draining) return { drained: 0, failed: 0 };
  draining = true;
  let drained = 0;
  let failed = 0;
  try {
    const items = await list();
    for (const item of items) {
      const handler = handlers.get(item.kind);
      if (!handler) continue;
      try {
        await handler(item);
        await remove(item.id);
        drained += 1;
      } catch {
        await bump(item.id);
        failed += 1;
        if (item.attempts >= 5) await remove(item.id); // give up after 5
      }
    }
  } finally {
    draining = false;
  }
  return { drained, failed };
}

let installed = false;
export function installAutoDrain() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  window.addEventListener("online", () => { void drain(); });
  // Drain on app focus + every 60s as a safety net
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void drain();
  });
  setInterval(() => { void drain(); }, 60_000);
}
