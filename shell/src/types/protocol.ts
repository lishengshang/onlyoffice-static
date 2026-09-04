// postMessage 协议类型：
// 1. 引擎文件流（编辑器 iframe -> 壳层/embed 页，x2t_helper.js 抛出）
// 2. 对外集成协议（外部系统 <-> /embed 路由，自 onlyoffice.html 移植，字段保持兼容）
// 注意：x2t_helper 会同时投递 window.parent 与 window.top；直连/embed 场景下
// parent === top（壳层自身）只投递一次；embed 场景 top 是外部系统，会额外直接收到原始流

/** 编辑器 iframe -> 壳层：导出文件流（保存请求结果或编辑器自动保存） */
export interface FileStreamMessage {
    type: 'onlyoffice-file-stream'
    fileName: string
    fileType: string
    buffer: ArrayBuffer
}

/** 收窄未知 postMessage 数据；非 onlyoffice-file-stream 返回 null */
export function parseFileStream(data: unknown): FileStreamMessage | null {
    if (!data || typeof data !== 'object') return null
    const record = data as { type?: unknown; buffer?: unknown }
    if (record.type !== 'onlyoffice-file-stream') return null
    if (!(record.buffer instanceof ArrayBuffer)) return null
    return data as FileStreamMessage
}

// ---------- 对外集成协议（/embed 路由） ----------

/** 外部系统 -> embed：注入文档配置（docConfig 可为 JSON 字符串或对象） */
export interface EmbedConfigMessage {
    type: 'onlyoffice-config'
    docConfig: unknown
    openBuffer?: ArrayBuffer
}

/** 外部系统 -> embed：触发保存，结果经 EmbedSavedMessage 回执 */
export interface EmbedSaveMessage {
    type: 'onlyoffice-save'
    requestId?: unknown
    format?: string
}

export type EmbedInboundMessage = EmbedConfigMessage | EmbedSaveMessage

/** 收窄未知 postMessage 数据为入站协议消息 */
export function parseEmbedInbound(data: unknown): EmbedInboundMessage | null {
    if (!data || typeof data !== 'object') return null
    const type = (data as { type?: unknown }).type
    if (type === 'onlyoffice-config' || type === 'onlyoffice-save') {
        return data as EmbedInboundMessage
    }
    return null
}
