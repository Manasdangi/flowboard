/**
 * Where attachment bytes live. DataState keeps only each file's metadata, so the
 * saved data stays small; the files themselves go here, keyed by attachment id.
 * The app uses IndexedDB (survives a reload, roomy enough for video); tests use
 * the in-memory version.
 */
import type { ID } from '@/domain/types';

export interface BlobStore {
  put(id: ID, blob: Blob): Promise<void>;
  get(id: ID): Promise<Blob | undefined>;
  delete(ids: ID[]): Promise<void>;
  clear(): Promise<void>;
  keys(): Promise<ID[]>;
}

/** A BlobStore that forgets everything on reload. Used by tests and as the default. */
export function createMemoryBlobStore(): BlobStore {
  const files = new Map<ID, Blob>();
  return {
    put: async (id, blob) => void files.set(id, blob),
    get: async (id) => files.get(id),
    delete: async (ids) => ids.forEach((id) => files.delete(id)),
    clear: async () => files.clear(),
    keys: async () => [...files.keys()],
  };
}

const DB_NAME = 'flowboard';
const STORE = 'attachments';

/** A BlobStore backed by the browser's IndexedDB. */
export function createIndexedDbBlobStore(): BlobStore {
  let opened: Promise<IDBDatabase> | undefined;
  const open = () =>
    (opened ??= new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    }));

  /** Run one request inside a transaction and resolve once the transaction commits. */
  const run = async <T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
    const db = await open();
    return new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const request = work(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  };

  return {
    put: async (id, blob) => void (await run('readwrite', (s) => s.put(blob, id))),
    get: async (id) => (await run<Blob | undefined>('readonly', (s) => s.get(id))) ?? undefined,
    delete: async (ids) => {
      const db = await open();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        for (const id of ids) tx.objectStore(STORE).delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
    },
    clear: async () => void (await run('readwrite', (s) => s.clear())),
    keys: async () => (await run<IDBValidKey[]>('readonly', (s) => s.getAllKeys())).map(String),
  };
}

/** Delete stored files that no attachment record points to (for example after localStorage was cleared). */
export async function pruneBlobs(blobs: BlobStore, keep: Set<ID>): Promise<void> {
  const orphans = (await blobs.keys()).filter((id) => !keep.has(id));
  if (orphans.length > 0) await blobs.delete(orphans);
}
