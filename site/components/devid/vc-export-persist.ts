/**
 * Persists `FileSystemDirectoryHandle` for the VC export folder across reloads (IndexedDB).
 * Same-origin only; Chromium File System Access API.
 */

const DB_NAME = "get-anything-done-vc-export";
const DB_VERSION = 1;
const STORE = "handles";
const KEY = "directory";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error ?? new Error("indexedDB.open failed"));
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
  });
}

export async function persistVcExportDirectoryHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("persist transaction failed"));
    tx.objectStore(STORE).put(handle, KEY);
  });
}

export async function restoreVcExportDirectoryHandle(): Promise<FileSystemDirectoryHandle | null> {
  if (typeof indexedDB === "undefined") return null;
  try {
    const db = await openDb();
    if (!db.objectStoreNames.contains(STORE)) return null;
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const r = tx.objectStore(STORE).get(KEY);
      r.onerror = () => reject(r.error ?? new Error("get failed"));
      r.onsuccess = () => resolve((r.result as FileSystemDirectoryHandle | undefined) ?? null);
    });
  } catch {
    return null;
  }
}

export async function clearPersistedVcExportDirectory(): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  try {
    const db = await openDb();
    if (!db.objectStoreNames.contains(STORE)) return;
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("clear transaction failed"));
      tx.objectStore(STORE).delete(KEY);
    });
  } catch {
    // ignore
  }
}
