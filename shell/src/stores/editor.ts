// 编辑器会话：直连 DocsAPI（不再经过 onlyoffice.html 中转）
// - DocsAPI 事件回调由 bridge 直达本 store
// - 文件流（onlyoffice-file-stream）由引擎 x2t_helper.js 直接 postMessage 到本窗口
// - 引擎文件流不带 requestId：保存请求用单槽 pending 匹配，未匹配的流视为编辑器自动保存
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { buildOnlyofficeConfig } from '../config/office-config'
import router from '../router'
import { DirectEditorBridge } from '../services/bridge'
import { parseFileStream } from '../types/protocol'
import type { FileRecord } from '../types/record'
import { hasKnownExt, mimeOf, triggerDownload } from '../utils'
import { useRecentStore } from './recent'
import { useToastStore } from './toast'

interface PendingSave {
    resolve: (blob: Blob) => void
    reject: (err: Error) => void
}

interface Session {
    record: FileRecord
    bridge: DirectEditorBridge | null
    frame: HTMLIFrameElement | null
    blobUrl: string
    /** 单槽：同一时刻至多一个进行中的保存请求（引擎文件流不带请求标识，靠槽位匹配） */
    pending: PendingSave | null
    pendingOpenBuffer: ArrayBuffer | null
    documentReady: boolean
}

export const useEditorStore = defineStore('editor', () => {
    const toast = useToastStore()
    const recent = useRecentStore()

    // 响应式 UI 状态（EditorBar 消费）
    const active = ref(false)
    const title = ref('')
    const modified = ref(false)
    const saving = ref(false)

    // 非响应式会话（含 iframe / Blob / DocsAPI 实例等原生对象，不能进响应式系统）
    let session: Session | null = null

    function open(record: FileRecord): void {
        teardown()
        session = {
            record,
            bridge: null,
            frame: null,
            blobUrl: record.blob ? URL.createObjectURL(record.blob) : '',
            pending: null,
            pendingOpenBuffer: null,
            documentReady: false,
        }
        title.value = record.name
        modified.value = false
        active.value = true
    }

    // EditorView 渲染出挂载点后创建编辑器（替代旧的 iframe + attachFrame 流程）
    function attachMount(mount: HTMLElement): void {
        const s = session
        if (!s) return
        createEditorSession(s, mount).catch(reportOpenError)
    }

    async function createEditorSession(s: Session, mount: HTMLElement): Promise<void> {
        const docConfig = buildOnlyofficeConfig({ record: s.record, blobUrl: s.blobUrl })
        if (docConfig.localOpenFromBinary) {
            if (!s.record.blob) throw new Error('本地文档缺少文件内容')
            s.pendingOpenBuffer = await s.record.blob.arrayBuffer()
        }

        const bridge = new DirectEditorBridge()
        s.bridge = bridge
        await bridge.create(mount, docConfig, {
            onFrameAttached: (frame) => {
                if (session === s) s.frame = frame
            },
            onAppReady: () => {
                if (session !== s) return
                // 本地二进制文档（pdf）在应用就绪后注入字节
                if (s.pendingOpenBuffer) {
                    const buffer = s.pendingOpenBuffer
                    s.pendingOpenBuffer = null
                    bridge.openDocument(buffer)
                }
            },
            onDocumentReady: () => {
                if (session === s) s.documentReady = true
            },
            onError: (message) => {
                if (session !== s) return
                const pending = s.pending
                s.pending = null
                if (pending) pending.reject(new Error(message))
                else reportOpenError(new Error(message))
            },
            onRequestClose: () => close(), // 编辑器自带的关闭按钮
            onStateChange: (modifiedNow) => {
                if (session === s) modified.value = modifiedNow
            },
            onRename: (newTitle) => {
                if (session !== s || !newTitle) return
                // 标题以已知文档扩展名结尾才视为完整文件名，否则补当前类型后缀
                // （「报告 v1.2」的点不是扩展名，需补 .docx）
                s.record.name = hasKnownExt(newTitle)
                    ? newTitle
                    : `${newTitle}.${s.record.fileType}`
                title.value = s.record.name
                recent.saveRecord(s.record)
            },
            onSaveAsSource: (url, fileType) => {
                void handleSaveAsSource(s, url, fileType)
            },
        })
    }

    // 用户在编辑器里"保存副本"：拉取引擎给的临时文件地址并下载副本
    async function handleSaveAsSource(s: Session, url: string, fileType: string): Promise<void> {
        try {
            const response = await fetch(url)
            if (!response.ok) throw new Error(`下载失败 HTTP ${response.status}`)
            const buffer = await response.arrayBuffer()
            const ext = fileType || s.record.fileType
            const base = s.record.name.replace(/\.[^.]+$/, '')
            triggerDownload(new Blob([buffer], { type: mimeOf(ext) }), `${base}-副本.${ext}`)
        } catch (e) {
            toast.show('另存为失败：' + (e as Error).message)
        }
    }

    function reportOpenError(error: unknown): void {
        console.error(error)
        toast.show('打开失败：' + ((error as Error)?.message || error))
    }

    // 触发保存，取回编辑后的文件流（ArrayBuffer -> Blob）
    function requestSave(): Promise<Blob> {
        const s = session
        if (!s || !s.bridge) return Promise.reject(new Error('编辑器未打开'))
        if (!s.documentReady) return Promise.reject(new Error('编辑器尚未就绪'))
        return new Promise<Blob>((resolve, reject) => {
            const pending: PendingSave = {
                resolve: (blob) => {
                    clearTimeout(timer)
                    resolve(blob)
                },
                reject: (err) => {
                    clearTimeout(timer)
                    reject(err)
                },
            }
            const timer = setTimeout(() => {
                if (s.pending === pending) s.pending = null
                reject(new Error('保存超时'))
            }, 30000)
            s.pending = pending
            try {
                s.bridge!.requestSave(s.record.fileType)
            } catch (e) {
                if (s.pending === pending) s.pending = null
                reject(e as Error)
            }
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
        s.pending?.reject(new Error('编辑器已关闭'))
        s.bridge?.destroy()
        if (s.blobUrl) URL.revokeObjectURL(s.blobUrl)
        session = null
        active.value = false
        modified.value = false
    }

    // 接收引擎 x2t_helper.js 的文件流（由 EditorView 挂到 window 上）
    async function handleMessage(event: MessageEvent): Promise<void> {
        const s = session
        if (!s || !s.frame || event.source !== s.frame.contentWindow) return
        const msg = parseFileStream(event.data)
        if (!msg) return

        // 单槽匹配：有进行中的保存请求则归它，否则是编辑器自动保存
        const pending = s.pending
        s.pending = null
        const blob = new Blob([msg.buffer])
        if (pending) {
            pending.resolve(blob)
        } else {
            await persistBlob(blob)
            toast.show('已自动保存')
        }
    }

    return {
        active,
        title,
        modified,
        saving,
        open,
        attachMount,
        saveCurrent,
        downloadCurrent,
        close,
        confirmLeave,
        teardown,
        handleMessage,
    }
})
