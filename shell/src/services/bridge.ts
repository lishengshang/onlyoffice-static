// 直连桥：壳层直接加载 api.js 并创建 DocsAPI.DocEditor，不再经过 onlyoffice.html 中转
// - DocsAPI 事件回调直达（保存/重命名/另存为/关闭/修改状态/错误）
// - 文件流由引擎 x2t_helper.js 直接 postMessage 到本窗口（见 types/protocol.ts），
//   由 store 的 window message 监听接收；本类只负责创建/销毁编辑器与触发导出
// - OO_FILE_STREAM_ONLY 标志设在本窗口：x2t_helper 沿父窗口链检查，命中则只给流不弹下载
import type { OnlyofficeConfig, OnlyofficeDocumentConfig } from '../config/office-config'

export interface DirectEditorCallbacks {
    /** DocsAPI 在挂载点注入编辑器 iframe 后回填（store 用它过滤消息来源） */
    onFrameAttached(frame: HTMLIFrameElement): void
    /** 编辑器应用就绪；本地二进制文档需在此刻 openDocument */
    onAppReady(): void
    onDocumentReady(): void
    onError(message: string): void
    onRequestClose(): void
    onStateChange(modified: boolean): void
    onRename(title: string): void
    /** 用户在编辑器里"保存副本"，引擎回调给的是一个临时文件 URL */
    onSaveAsSource(url: string, fileType: string): void
}

type DocsApiEvent = { data?: unknown }

/** DocsAPI 配置（在 docConfig 基础上补布局与 directUrl，对齐原 onlyoffice.html 的 normalizeConfig） */
type DirectEditorConfig = OnlyofficeConfig & {
    height?: string
    width?: string
    document: OnlyofficeDocumentConfig & { directUrl?: string }
    events: Record<string, (event?: DocsApiEvent) => void>
}

let apiPromise: Promise<void> | null = null

function loadDocsApi(): Promise<void> {
    if (window.DocsAPI) return Promise.resolve()
    if (apiPromise) return apiPromise
    apiPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script')
        script.src = `${__ENGINE_VENDOR__}/web-apps/apps/api/documents/api.js`
        script.onload = () => resolve()
        script.onerror = () => {
            apiPromise = null
            reject(new Error(`api.js 加载失败（${__ENGINE_VENDOR__}）`))
        }
        document.head.appendChild(script)
    })
    return apiPromise
}

function eventNameOf(event: DocsApiEvent | undefined): string {
    return JSON.stringify(event?.data ?? null)
}

function renameTitleOf(event: DocsApiEvent | undefined): string {
    const data = event?.data
    if (typeof data === 'string') return data
    const record = data as { title?: string; name?: string } | undefined
    return record?.title || record?.name || ''
}

export class DirectEditorBridge {
    private docEditor: DocsApiEditor | null = null
    private frameObserver: MutationObserver | null = null

    async create(
        mount: HTMLElement,
        docConfig: OnlyofficeConfig,
        callbacks: DirectEditorCallbacks,
    ): Promise<void> {
        await loadDocsApi()
        if (!window.DocsAPI) throw new Error('DocsAPI 未加载')
        if (this.docEditor) this.destroy()

        // 沿用原 onlyoffice.html 的 normalizeConfig：补 directUrl 与 100% 布局
        const config = docConfig as DirectEditorConfig
        if (!config.document.directUrl && config.document.url) {
            config.document.directUrl = config.document.url
        }
        config.height = '100%'
        config.width = '100%'

        // 引擎沿父窗口链找这个标志；命中则 x2t_helper 只回传文件流、不触发浏览器下载
        window.OO_FILE_STREAM_ONLY = true

        config.events = {
            onAppReady: () => callbacks.onAppReady(),
            onDocumentReady: () => callbacks.onDocumentReady(),
            onDownloadAs: () => {}, // 导出走文件流劫持，屏蔽 DocsAPI 默认下载行为
            onError: (event) => callbacks.onError(`编辑器错误: ${eventNameOf(event)}`),
            onRequestClose: () => callbacks.onRequestClose(),
            onDocumentStateChange: (event) => callbacks.onStateChange(!!event?.data),
            onMetaChange: (event) => {
                const title = renameTitleOf(event)
                if (title) callbacks.onRename(title)
            },
            onRequestRename: (event) => {
                const title = renameTitleOf(event)
                if (!title) return
                this.docEditor?.setMetaData?.({ title })
                callbacks.onRename(title)
            },
            onRequestSaveAs: (event) => {
                const data = event?.data
                const url =
                    typeof data === 'string'
                        ? data
                        : ((data as { url?: string; fileUrl?: string } | undefined)?.url ??
                          (data as { fileUrl?: string } | undefined)?.fileUrl)
                const fileType = (data as { fileType?: string } | undefined)?.fileType || ''
                if (url) callbacks.onSaveAsSource(url, fileType)
            },
        }

        // DocsAPI 会"替换"占位元素本身，因此占位符挂在 Vue 稳定持有的 mount 内层，
        // 被替换后 iframe 成为 mount 的直接子节点，mount 的样式与 ref 都不受影响
        let placeholder = mount.querySelector<HTMLDivElement>('.oo-placeholder')
        if (!placeholder) {
            placeholder = document.createElement('div')
            placeholder.className = 'oo-placeholder'
            mount.appendChild(placeholder)
        }
        const placeholderId = 'oo-editor-mount'
        placeholder.id = placeholderId

        this.docEditor = new window.DocsAPI.DocEditor(
            placeholderId,
            config as unknown as Record<string, unknown>,
        )
        this.watchMountIframe(mount, callbacks)
    }

    // DocsAPI 会在挂载点内自建 iframe；MutationObserver 在占位符被替换的瞬间回填给 store
    // （消息来源过滤依赖它；轮询方案有 5 秒静默失败窗口，DOM 事件无此问题）
    private watchMountIframe(mount: HTMLElement, callbacks: DirectEditorCallbacks): void {
        this.frameObserver?.disconnect()
        const observer = new MutationObserver(() => {
            const frame = mount.querySelector('iframe')
            if (frame instanceof HTMLIFrameElement) {
                observer.disconnect()
                this.frameObserver = null
                callbacks.onFrameAttached(frame)
            }
        })
        observer.observe(mount, { childList: true, subtree: true })
        this.frameObserver = observer
    }

    /** 触发导出；结果经 onlyoffice-file-stream 消息回到 store */
    requestSave(format?: string): void {
        if (!this.docEditor) throw new Error('编辑器未就绪')
        if (format) this.docEditor.downloadAs(format)
        else this.docEditor.downloadAs()
    }

    /** 本地二进制文档（pdf）打开：必须在 onAppReady 之后调用 */
    openDocument(buffer: ArrayBuffer): void {
        if (!this.docEditor) throw new Error('编辑器未就绪')
        this.docEditor.openDocument({ buffer })
    }

    destroy(): void {
        this.frameObserver?.disconnect()
        this.frameObserver = null
        if (!this.docEditor) return
        try {
            this.docEditor.destroyEditor()
        } catch {
            /* 引擎未完成初始化时销毁可能抛错，忽略 */
        }
        this.docEditor = null
    }
}
