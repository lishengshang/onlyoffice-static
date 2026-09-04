// 直连协议类型：中转层（onlyoffice.html）去除后，壳层与编辑器 iframe 之间
// 仅剩一类 postMessage —— 引擎 x2t_helper.js 抛出的文件流（其余全部走 DocsAPI 事件回调）
// 注意：x2t_helper 会同时投递 window.parent 与 window.top；2 窗口架构下两者都是壳层，
// 因 parent === top 只投递一次，不会重复

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
