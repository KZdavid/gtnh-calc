const DB_NAME = "gtnh-local-data";
const STORE = "files";

export type LocalFileKey = "data.bin" | "atlas.webp";

let _db: IDBDatabase | null = null;

function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(STORE);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function getDB(): Promise<IDBDatabase> {
    return (_db ??= await openDB());
}

function idbOp<T>(db: IDBDatabase, mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
        const req = fn(db.transaction(STORE, mode).objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

function validate(key: LocalFileKey, buf: ArrayBuffer): boolean {
    const v = new Uint8Array(buf);
    if (key === "data.bin")   return v[0] === 0x1f && v[1] === 0x8b;
    if (key === "atlas.webp") return v[0] === 0x52 && v[1] === 0x49 && v[2] === 0x46 && v[3] === 0x46;
    return false;
}

export async function getLocalFile(key: LocalFileKey): Promise<ArrayBuffer | undefined> {
    try {
        const db = await getDB();
        return await idbOp<ArrayBuffer | undefined>(db, "readonly", s => s.get(key));
    } catch {
        return undefined;
    }
}

export async function pickAndStoreFile(key: LocalFileKey): Promise<void> {
    const accept = key === "data.bin"
        ? { "application/octet-stream": [".bin"] }
        : { "image/webp": [".webp"] };
    const [handle] = await (window as any).showOpenFilePicker({ types: [{ accept }], multiple: false });
    const buf: ArrayBuffer = await (await handle.getFile()).arrayBuffer();
    if (!validate(key, buf)) throw new Error(`文件格式不符合预期 (${key})`);
    const db = await getDB();
    await idbOp(db, "readwrite", s => s.put(buf, key));
}

export async function clearLocalFile(key: LocalFileKey): Promise<void> {
    const db = await getDB();
    await idbOp(db, "readwrite", s => s.delete(key));
}

export async function hasLocalFile(key: LocalFileKey): Promise<boolean> {
    return (await getLocalFile(key)) !== undefined;
}
