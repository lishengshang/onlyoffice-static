// 编辑器会话：iframe + postMessage 协议（原 editor.js 的状态机部分）
// 协议契约见仓库根 onlyoffice.html；改动需双向对齐
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { buildOnlyofficeConfig } from '../config/office-config'
import router from '../router'
import { EditorBridge } from '../services/bridge'
import { parseFrameMessage } from '../types/protocol'
import type { FileRecord } from '../types/record'
import { mimeOf, triggerDownload } from '../utils'
import { useRecentStore } from './recent'
import { useToastStore } from './toast'

interface PendingSave {
    resolve: (blob: Blob) => void
    reject: (err: Error) => void
}

interface Session {
    record: FileRecord
    frame: HTMLIFrameElement | null
    bridge: EditorBridge | null
    blobUrl: string
    saveSeq: number
    pending: Map<string, PendingSave>
}

export const useEditorStore = defineStore('editor', () => {
    const toast = useToastStore()
    const recent = useRecentStore()

    // 响应式 UI 状态（EditorBar 消费）
    const active = ref(false)
    const title = ref('')
    const modified = ref(false)
    const saving = ref(false)

    // 非响应式会话（含 iframe / Blob 等原生对象，不能进响应式系统）
    let session: Session | null = null

    function open(record: FileRecord): void {
        teardown()
        session = {
            record,
            frame: null,
            bridge: null,
            blobUrl: record.blob ? URL.createObjectURL(record.blob) : '',
            saveSeq: 0,
            pending: new Map(),
        }
        title.value = record.name
        modified.value = false
        active.value = true
    }

    // EditorView 渲染出 iframe 后回填引用
    function attachFrame(frame: HTMLIFrameElement): void {
        if (!session) return
        session.frame = frame
        session.bridge = new EditorBridge(frame)
    }

    async function pushConfig(): Promise<void> {
        const s = session
        if (!s?.bridge) return
        const docConfig = buildOnlyofficeConfig({ record: s.record, blobUrl: s.blobUrl })
        let openBuffer: ArrayBuffer | null = null
        if (docConfig.localOpenFromBinary) {
            if (!s.record.blob) throw new Error('本地文档缺少文件内容')
            openBuffer = await s.record.blob.arrayBuffer()
        }
        s.bridge.sendConfig(docConfig, openBuffer ?? undefined)
    }

    function reportOpenError(error: unknown): void {
        console.error(error)
        toast.show('打开失败：' + ((error as Error)?.message || error))
    }

    // 触发保存，取回编辑后的文件流（ArrayBuffer -> Blob）
    function requestSave(): Promise<Blob> {
        const s = session
        const bridge = s?.bridge
        if (!s || !bridge) return Promise.reject(new Error('编辑器未打开'))
        const requestId = 'save-' + ++s.saveSeq
        return new Promise<Blob>((resolve, reject) => {
            const timer = setTimeout(() => {
                s.pending.delete(requestId)
                reject(new Error('保存超时'))
            }, 30000)
            s.pending.set(requestId, {
                resolve: (blob) => {
                    clearTimeout(timer)
                    resolve(blob)
                },
                reject: (err) => {
                    clearTimeout(timer)
                    reject(err)
                },
            })
            bridge.requestSave(requestId, s.record.fileType)
        })
    }

    // 把文件流写回 IndexedDB
    async function persistBlob(blob: Blob): Promise<void> {
        const s = session
        if (!s) return
        s.record.blob = blob
        s.record.size = blob.size
        await recent.saveRecord(s.record)
        modified.value = false
    }

    async function saveCurrent(): Promise<void> {
        if (saving.value) return
        saving.value = true
        try {
            await persistBlob(await requestSave())
            toast.show('已保存到最近文件')
        } catch (e) {
            toast.show('保存失败：' + (e as Error).message)
        } finally {
            saving.value = false
        }
    }

    async function downloadCurrent(): Promise<void> {
        const s = session
        if (!s) return
        try {
            const blob = await requestSave()
            await persistBlob(blob)
            triggerDownload(new Blob([blob], { type: mimeOf(s.record.fileType) }), s.record.name)
        } catch (e) {
            toast.show('下载失败：' + (e as Error).message)
        }
    }

    // 有未保存修改时确认；离开 /edit 路由前调用（EditorView 的路由守卫）
    function confirmLeave(): boolean {
        if (session && modified.value && !confirm('文档有未保存的修改，确定关闭？')) return false
        return true
    }

    // 关闭：确认 -> 清理会话 -> 回主页（编辑器自带关闭按钮 / 顶栏关闭按钮共用）
    function close(): void {
        if (!confirmLeave()) return
        teardown()
        router.push({ name: 'home' })
    }

    function teardown(): void {
        const s = session
        if (!s) return
        s.pending.forEach((p) => p.reject(new Error('编辑器已关闭')))
        if (s.blobUrl) URL.revokeObjectURL(s.blobUrl)
        session = null
        active.value = false
        modified.value = false
    }

    // 接收 onlyoffice.html 的协议消息（由 EditorView 挂到 window 上）
    async function handleMessage(event: MessageEvent): Promise<void> {
        const s = session
        const msg = parseFrameMessage(event.data)
        if (!msg || !s || !s.frame || event.source !== s.frame.contentWindow) return

        switch (msg.type) {
            case 'onlyoffice-ready': // iframe 就绪 -> 注入文档配置
                pushConfig().catch(reportOpenError)
                break
            case 'onlyoffice-open-error':
                toast.show('打开失败：' + (msg.error || '未知错误'))
                break
            case 'onlyoffice-saved': {
                // 保存结果（带 requestId）或自动保存流
                const p = msg.requestId ? s.pending.get(msg.requestId) : undefined
                if (p) {
                    if (msg.requestId) s.pending.delete(msg.requestId)
                    if (msg.ok && msg.buffer) p.resolve(new Blob([msg.buffer]))
                    else p.reject(new Error(msg.error || '保存失败'))
                } else if (msg.ok && msg.buffer) {
                    await persistBlob(new Blob([msg.buffer]))
                    toast.show('已自动保存')
                }
                break
            }
            case 'onlyoffice-saveas': // 用户在编辑器里"保存副本"
                if (msg.ok && msg.buffer) {
                    const ext = msg.fileType || s.record.fileType
                    const base = s.record.name.replace(/\.[^.]+$/, '')
                    triggerDownload(
                        new Blob([msg.buffer], { type: mimeOf(ext) }),
                        `${base}-副本.${ext}`,
                    )
                }
                break
            case 'onlyoffice-rename': // 用户在编辑器里重命名
                if (msg.title) {
                    s.record.name = /\.[^.]+$/.test(msg.title)
                        ? msg.title
                        : `${msg.title}.${s.record.fileType}`
                    title.value = s.record.name
                    recent.saveRecord(s.record)
                }
                break
            case 'onlyoffice-state-change':
                modified.value = !!msg.modified
                break
            case 'onlyoffice-request-close': // 编辑器自带的关闭按钮
                close()
                break
        }
    }

    return {
        active,
        title,
        modified,
        saving,
        open,
        attachFrame,
        saveCurrent,
        downloadCurrent,
        close,
        confirmLeave,
        teardown,
        handleMessage,
    }
})
