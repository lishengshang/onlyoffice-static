/// <reference types="vite/client" />

// 引擎 vendor 绝对路径，由 vite.config.ts 扫描引擎目录后 define 注入
declare const __ENGINE_VENDOR__: string

// api.js 暴露的全局 DocsAPI（无官方类型，这里声明用到的最小接口）
interface DocsApiEditor {
    destroyEditor(): void
    downloadAs(format?: string): void
    openDocument(options: { buffer: ArrayBuffer }): void
    setMetaData?(options: { title: string }): void
}

interface Window {
    /** api.js 暴露的命名空间；真正的构造器是 DocsAPI.DocEditor */
    DocsAPI?: {
        DocEditor: new (elementId: string, config: Record<string, unknown>) => DocsApiEditor
    }
    /** 壳层声明"只要文件流"：x2t_helper.js 沿父窗口链检查此标志 */
    OO_FILE_STREAM_ONLY?: boolean
}
