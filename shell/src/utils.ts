// 通用工具：类型识别、格式化、下载

// 引擎支持的文档扩展名：用于标题重命名场景区分"标题里的点"与"真实扩展名"，
// 如「报告 v1.2」不应被当作带扩展名而丢失 .docx 后缀
const KNOWN_EXTENSIONS = new Set([
    'doc',
    'docx',
    'dot',
    'dotx',
    'docm',
    'dotm',
    'odt',
    'fodt',
    'rtf',
    'txt',
    'html',
    'htm',
    'mht',
    'epub',
    'fb2',
    'xls',
    'xlsx',
    'xlsm',
    'xlt',
    'xltx',
    'xltm',
    'ods',
    'fods',
    'csv',
    'ppt',
    'pptx',
    'pps',
    'ppsx',
    'pot',
    'potx',
    'pptm',
    'potm',
    'odp',
    'fodp',
    'pdf',
    'oxps',
    'xps',
    'djvu',
])

export function extOf(name: string): string {
    const dot = name.lastIndexOf('.')
    return dot > -1 ? name.substring(dot + 1).toLowerCase() : ''
}

/** 名称是否以引擎支持的文档扩展名结尾（区别于 extOf 的"任何点后缀"语义） */
export function hasKnownExt(name: string): boolean {
    return KNOWN_EXTENSIONS.has(extOf(name))
}

export function mimeOf(ext: string): string {
    return (
        {
            docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            pdf: 'application/pdf',
        }[ext] || 'application/octet-stream'
    )
}

export function formatSize(bytes: number): string {
    if (!bytes) return '0 B'
    const units = ['B', 'KB', 'MB', 'GB']
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
    return (bytes / Math.pow(1024, i)).toFixed(i ? 1 : 0) + ' ' + units[i]
}

export function triggerDownload(blob: Blob, name: string): void {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = name
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1500)
}
