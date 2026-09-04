// 最近文件：IndexedDB CRUD + 列表状态（原 recent-store.js / recent-ui.js 的数据与状态部分）
import { defineStore } from 'pinia'
import { ref, shallowRef } from 'vue'
import { idb } from '../services/idb'
import type { FileRecord } from '../types/record'

export const useRecentStore = defineStore('recent', () => {
    // 记录内含 Blob（原生对象不能被深度代理，否则方法调用报 Illegal invocation），
    // 列表一律整体替换，不做逐项响应式
    const records = shallowRef<FileRecord[]>([])
    const idbAvailable = ref(true)

    async function refresh(): Promise<void> {
        try {
            records.value = (await idb.all()).sort(
                (a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0),
            )
            idbAvailable.value = true
        } catch {
            idbAvailable.value = false
        }
    }

    async function saveRecord(record: FileRecord): Promise<void> {
        record.updatedAt = Date.now()
        await idb.put(record)
        await refresh()
    }

    function getRecord(id: string): Promise<FileRecord | undefined> {
        return idb.get(id)
    }

    async function deleteRecord(id: string): Promise<void> {
        await idb.del(id)
        await refresh()
    }

    // 同名文件自动加序号
    async function uniqueName(name: string): Promise<string> {
        const files = await idb.all().catch(() => [] as FileRecord[])
        const names = new Set(files.map((f) => f.name))
        if (!names.has(name)) return name
        const dot = name.lastIndexOf('.')
        const base = dot > -1 ? name.substring(0, dot) : name
        const ext = dot > -1 ? name.substring(dot) : ''
        for (let i = 1; ; i++) {
            const candidate = `${base}(${i})${ext}`
            if (!names.has(candidate)) return candidate
        }
    }

    return { records, idbAvailable, refresh, saveRecord, getRecord, deleteRecord, uniqueName }
})
