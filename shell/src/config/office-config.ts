// 编辑器配置：格式映射、documentType、docConfig 构造
// 由根目录 assets/office-config.js（UMD）→ ESM → TS 化，逻辑保持一致

import type { FileRecord } from '../types/record'

export type DocumentType = 'word' | 'cell' | 'slide' | 'pdf'

export interface OnlyofficeDocumentConfig {
    url?: string
    title: string
    fileType: string
    key: string
    permissions: { edit: boolean; download: boolean; print: boolean }
    /** 仅 pdf */
    isForm?: boolean
    localOpenFromBinary?: boolean
}

export interface OnlyofficeConfig {
    document: OnlyofficeDocumentConfig
    documentType: DocumentType
    editorConfig: {
        mode: string
        lang: string
        user: { id: string; name: string }
    }
    localOpenFromBinary?: boolean
}

const DEFAULT_LANG = 'zh-CN'
const DEFAULT_MODE = 'edit'
const LOCAL_USER_ID = 'local-user'
const LOCAL_USER_NAME = '本地用户'
const EMPTY_UPDATED_AT = 0
const LOCAL_BLOB_URL_PREFIX = 'blob:'

const CELL_EXTENSIONS = new Set(['xls', 'xlsx', 'xlsm', 'ods', 'csv'])
const SLIDE_EXTENSIONS = new Set(['ppt', 'pptx', 'odp', 'pps', 'ppsx'])
const PDF_EXTENSIONS = new Set(['pdf', 'oxps', 'xps', 'djvu'])

export function documentTypeOf(ext: string): DocumentType {
    const normalized = normalizeExtension(ext)
    if (CELL_EXTENSIONS.has(normalized)) return 'cell'
    if (SLIDE_EXTENSIONS.has(normalized)) return 'slide'
    if (PDF_EXTENSIONS.has(normalized)) return 'pdf'
    return 'word'
}

function normalizeExtension(ext: string): string {
    return String(ext || '').toLowerCase()
}

function isLocalBlobUrl(url: string): boolean {
    return String(url || '').startsWith(LOCAL_BLOB_URL_PREFIX)
}

function shouldOpenFromBinary(documentType: DocumentType, blobUrl: string): boolean {
    return documentType === 'pdf' && isLocalBlobUrl(blobUrl)
}

// record 来自 IndexedDB（外部边界），保留运行时校验
function requireRecord(options: { record?: FileRecord }): FileRecord {
    if (!options || !options.record) {
        throw new Error('record is required')
    }
    if (!options.record.id) {
        throw new Error('record.id is required')
    }
    if (!options.record.name) {
        throw new Error('record.name is required')
    }
    if (!options.record.fileType) {
        throw new Error('record.fileType is required')
    }
    return options.record
}

function documentKeyOf(record: FileRecord): string {
    return `${record.id}-${record.updatedAt || EMPTY_UPDATED_AT}`
}

function documentPermissions(): { edit: boolean; download: boolean; print: boolean } {
    return { edit: true, download: true, print: true }
}

function localUser(): { id: string; name: string } {
    return { id: LOCAL_USER_ID, name: LOCAL_USER_NAME }
}

function buildDocumentConfig(record: FileRecord, blobUrl: string): OnlyofficeDocumentConfig {
    const documentType = documentTypeOf(record.fileType)
    const openFromBinary = shouldOpenFromBinary(documentType, blobUrl)
    const config: OnlyofficeDocumentConfig = {
        url: openFromBinary ? undefined : blobUrl || undefined,
        title: record.name,
        fileType: normalizeExtension(record.fileType),
        key: documentKeyOf(record),
        permissions: documentPermissions(),
    }

    if (documentType === 'pdf') {
        const pdfConfig: OnlyofficeDocumentConfig = Object.assign({}, config, { isForm: false })
        if (openFromBinary) pdfConfig.localOpenFromBinary = true
        return pdfConfig
    }
    return config
}

export function buildOnlyofficeConfig(options: {
    record?: FileRecord
    blobUrl?: string
}): OnlyofficeConfig {
    const record = requireRecord(options)
    const blobUrl = options.blobUrl ?? ''
    const documentType = documentTypeOf(record.fileType)
    const config: OnlyofficeConfig = {
        document: buildDocumentConfig(record, blobUrl),
        documentType,
        editorConfig: { mode: DEFAULT_MODE, lang: DEFAULT_LANG, user: localUser() },
    }
    if (shouldOpenFromBinary(documentType, blobUrl)) {
        config.localOpenFromBinary = true
    }
    return config
}

// ---------- 对外集成（/embed 路由）：配置补全，移植自 onlyoffice.html normalizeConfig ----------

/** 从文档 URL 尾部推断扩展名（去掉 query/hash） */
export function fileTypeFromUrl(url: string | undefined): string {
    if (!url) return ''
    const clean = url.split('?')[0].split('#')[0]
    const dot = clean.lastIndexOf('.')
    return dot > -1 ? clean.substring(dot + 1).toLowerCase() : ''
}

function hashOf(value: string): string {
    let hash = 0
    for (let index = 0; index < value.length; index += 1) {
        hash = (hash << 5) - hash + value.charCodeAt(index)
        hash |= 0
    }
    return String(Math.abs(hash))
}

/**
 * 外部系统注入的 docConfig 往往只给 url 或 fileType，其余字段自动补全。
 * 与原 onlyoffice.html 的 normalizeConfig 行为一致（pdf 扩展名集合统一采用本文件更全的判定）。
 */
export function normalizeEmbedConfig(docConfig: Record<string, unknown>): OnlyofficeConfig {
    const config = { ...docConfig } as Record<string, unknown>
    const document = { ...((config.document as Record<string, unknown>) ?? {}) }
    if (!document.fileType) {
        document.fileType = fileTypeFromUrl(document.url as string | undefined)
    }
    if (!config.documentType) {
        config.documentType = documentTypeOf(String(document.fileType ?? ''))
    }
    if (!document.key) {
        document.key = 'doc-' + hashOf(`${document.url || ''}|${document.title || ''}`)
    }
    if (!document.title) {
        document.title = `文档.${document.fileType || 'docx'}`
    }
    if (!document.directUrl && document.url) {
        document.directUrl = document.url
    }
    config.document = document
    return config as unknown as OnlyofficeConfig
}
