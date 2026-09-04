// IndexedDB 存储：最近文件（含真实文件字节，刷新后仍可打开）
import type { FileRecord } from '../types/record'

const DB_NAME = 'onlyoffice-personal'
const STORE = 'files'
let dbPromise: Promise<IDBDatabase> | null = null

function openDB(): Promise<IDBDatabase> {
    if (dbPromise) return dbPromise
    dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1)
        req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' })
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
    })
    return dbPromise
}

function idbRequest<T>(
    mode: IDBTransactionMode,
    fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
    return openDB().then(
        (db) =>
            new Promise<T>((resolve, reject) => {
                const tx = db.transaction(STORE, mode)
                const req = fn(tx.objectStore(STORE))
                req.onsuccess = () => resolve(req.result)
                req.onerror = () => reject(req.error)
            }),
    )
}

export const idb = {
    put: (record: FileRecord) => idbRequest('readwrite', (s) => s.put(record)),
    get: (id: string) =>
        idbRequest<FileRecord | undefined>(
            'readonly',
            (s) => s.get(id) as IDBRequest<FileRecord | undefined>,
        ),
    del: (id: string) =>
        idbRequest<undefined>('readwrite', (s) => s.delete(id) as unknown as IDBRequest<undefined>),
    all: () => idbRequest<FileRecord[]>('readonly', (s) => s.getAll() as IDBRequest<FileRecord[]>),
}
