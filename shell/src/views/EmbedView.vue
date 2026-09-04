<script setup lang="ts">
// 对外集成入口（自 onlyoffice.html 移植的协议层）：外部系统 iframe 嵌入 /embed，
// 经 postMessage 注入 docConfig 打开文档、触发保存并接收文件流回执。
// 协议消息与原 onlyoffice.html 逐字段兼容（见 docs/使用文档.md），无 IndexedDB、无壳层 UI。
import { useEventListener } from '@vueuse/core'
import { onBeforeUnmount, onMounted, useTemplateRef } from 'vue'
import { normalizeEmbedConfig } from '../config/office-config'
import { DirectEditorBridge } from '../services/bridge'
import type { FileStreamMessage } from '../types/protocol'
import { parseEmbedInbound, parseFileStream } from '../types/protocol'
import { triggerDownload } from '../utils'

const mountEl = useTemplateRef<HTMLDivElement>('mount')

interface PendingSave {
    requestId?: unknown
    format?: string
}

let bridge: DirectEditorBridge | null = null
let frame: HTMLIFrameElement | null = null
let pendingSave: PendingSave | null = null
let pendingOpenBuffer: ArrayBuffer | null = null
let streamFallback = 'autosave'

function postToParent(message: unknown, transfer: ArrayBuffer[] = []): void {
    if (window.parent === window) return
    window.parent.postMessage(message, '*', transfer)
}

function errorMessageOf(error: unknown): string {
    return String((error as Error | null)?.message || error)
}

function postOpenError(error: unknown): void {
    postToParent({ type: 'onlyoffice-open-error', error: errorMessageOf(error) })
}

function postSaveError(requestId: unknown, error: unknown): void {
    postToParent({ type: 'onlyoffice-saved', requestId, ok: false, error: errorMessageOf(error) })
}

async function loadOnlyoffice(
    docConfig: Record<string, unknown>,
    openBuffer?: ArrayBuffer,
): Promise<void> {
    const mount = mountEl.value
    if (!mount) throw new Error('挂载点未就绪')
    bridge?.destroy()
    pendingSave = null
    streamFallback = (docConfig.streamFallback as string) || 'autosave'
    delete docConfig.streamFallback
    const config = normalizeEmbedConfig(docConfig)
    if (config.localOpenFromBinary) {
        if (!openBuffer) throw new Error('本地文档缺少二进制内容')
        pendingOpenBuffer = openBuffer
    }
    const instance = new DirectEditorBridge()
    bridge = instance
    await instance.create(mount, config, {
        onFrameAttached: (attached) => {
            frame = attached
        },
        onAppReady: () => {
            if (!pendingOpenBuffer) return
            const buffer = pendingOpenBuffer
            pendingOpenBuffer = null
            instance.openDocument(buffer)
        },
        onDocumentReady: () => {
            postToParent({ type: 'onlyoffice-document-ready' })
        },
        onError: (message) => {
            const request = pendingSave
            pendingSave = null
            if (request) postSaveError(request.requestId, message)
            else postOpenError(message)
        },
        onRequestClose: () => {
            postToParent({ type: 'onlyoffice-request-close' })
        },
        onStateChange: (modified) => {
            postToParent({ type: 'onlyoffice-state-change', modified })
        },
        onRename: (title) => {
            if (title) postToParent({ type: 'onlyoffice-rename', title })
        },
        onSaveAsSource: (url, fileType) => {
            void handleSaveAs(url, fileType)
        },
    })
}

async function handleSaveAs(url: string, fileType: string): Promise<void> {
    try {
        const response = await fetch(url)
        if (!response.ok) throw new Error(`下载失败 HTTP ${response.status}`)
        const buffer = await response.arrayBuffer()
        postToParent({ type: 'onlyoffice-saveas', ok: true, buffer, fileType }, [buffer])
    } catch (e) {
        postToParent({ type: 'onlyoffice-saveas', ok: false, error: errorMessageOf(e) })
    }
}

function handleSaveCommand(requestId: unknown, format?: string): void {
    if (!bridge) {
        postSaveError(requestId, '编辑器未就绪')
        return
    }
    pendingSave = { requestId, format }
    try {
        bridge.requestSave(format)
    } catch (e) {
        const request = pendingSave
        pendingSave = null
        postSaveError(request?.requestId, e)
    }
}

function handleFileStream(msg: FileStreamMessage): void {
    const request = pendingSave
    pendingSave = null
    if (!msg.buffer) {
        postSaveError(request?.requestId, '未获取到文件流')
        return
    }
    // 无保存请求的流：按 streamFallback 决定下载副本或静默丢弃（原协议语义）
    if (!request && streamFallback === 'download') {
        triggerDownload(
            new Blob([msg.buffer]),
            msg.fileName || `document.${msg.fileType || 'docx'}`,
        )
        return
    }
    postToParent(
        {
            type: 'onlyoffice-saved',
            requestId: request?.requestId,
            ok: true,
            buffer: msg.buffer,
            fileType: msg.fileType || '',
            fileName: msg.fileName || '',
        },
        [msg.buffer],
    )
}

function handleMessage(event: MessageEvent): void {
    // 外部系统 -> embed：配置注入与保存命令
    if (event.source === window.parent) {
        const inbound = parseEmbedInbound(event.data)
        if (inbound?.type === 'onlyoffice-config') {
            const docConfig =
                typeof inbound.docConfig === 'string'
                    ? JSON.parse(inbound.docConfig)
                    : inbound.docConfig
            if (!docConfig || typeof docConfig !== 'object') {
                postOpenError('docConfig 必须是对象或 JSON 字符串')
                return
            }
            loadOnlyoffice(docConfig as Record<string, unknown>, inbound.openBuffer).catch(
                postOpenError,
            )
        } else if (inbound?.type === 'onlyoffice-save') {
            handleSaveCommand(inbound.requestId, inbound.format)
        }
        return
    }
    // 编辑器 iframe -> embed：导出文件流（消息来源过滤）
    if (frame && event.source === frame.contentWindow) {
        const msg = parseFileStream(event.data)
        if (msg) handleFileStream(msg)
    }
}

onMounted(() => {
    // URL 参数方式：?docConfig={json}（与 onlyoffice.html 兼容）
    const raw = new URLSearchParams(window.location.search).get('docConfig')
    if (raw) {
        try {
            loadOnlyoffice(JSON.parse(raw) as Record<string, unknown>).catch(postOpenError)
        } catch (e) {
            postOpenError('docConfig URL 参数不是合法 JSON：' + errorMessageOf(e))
        }
        return
    }
    postToParent({ type: 'onlyoffice-ready' })
})

onBeforeUnmount(() => {
    bridge?.destroy()
    bridge = null
    frame = null
})

useEventListener(window, 'message', handleMessage)
</script>

<template>
    <div class="embed-page">
        <!-- mount 稳定持有；DocsAPI 会替换内层占位符为编辑器 iframe -->
        <div ref="mount" class="editor-mount"></div>
    </div>
</template>

<style scoped>
.embed-page {
    position: fixed;
    inset: 0;
    background: #fff;
}

.editor-mount {
    position: absolute;
    inset: 0;
}
</style>
