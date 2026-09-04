// 通用工具：类型识别、格式化、下载

export function extOf(name: string): string {
    const dot = name.lastIndexOf('.')
    return dot > -1 ? name.substring(dot + 1).toLowerCase() : ''
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
