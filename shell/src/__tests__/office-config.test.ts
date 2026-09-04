// office-config.ts 单测：documentType 判定、docConfig 构造、/embed 配置补全
import { describe, expect, it } from 'vitest'
import type { FileRecord } from '../types/record'
import { buildOnlyofficeConfig, documentTypeOf, fileTypeFromUrl, normalizeEmbedConfig } from '../config/office-config'

function recordOf(overrides: Partial<FileRecord>): FileRecord {
    return { id: 'r1', name: '文档.docx', fileType: 'docx', size: 0, updatedAt: 0, ...overrides } as FileRecord
}

describe('documentTypeOf', () => {
    it('四类映射', () => {
        expect(documentTypeOf('docx')).toBe('word')
        expect(documentTypeOf('XLSX')).toBe('cell')
        expect(documentTypeOf('odp')).toBe('slide')
        expect(documentTypeOf('djvu')).toBe('pdf')
    })

    it('未知扩展名兜底 word；空值兜底 word', () => {
        expect(documentTypeOf('zip')).toBe('word')
        expect(documentTypeOf('')).toBe('word')
    })
})

describe('fileTypeFromUrl', () => {
    it('取 url 尾部扩展名，忽略 query 与 hash', () => {
        expect(fileTypeFromUrl('/files/报告.docx?v=1')).toBe('docx')
        expect(fileTypeFromUrl('/a/b.PPTX#page=2')).toBe('pptx')
    })

    it('无扩展名与空值返回空串', () => {
        expect(fileTypeFromUrl('/files/doc')).toBe('')
        expect(fileTypeFromUrl(undefined)).toBe('')
    })
})

describe('buildOnlyofficeConfig', () => {
    it('基础字段完整（key = id-updatedAt，默认中文编辑态）', () => {
        const config = buildOnlyofficeConfig({
            record: recordOf({ id: 'abc', updatedAt: 42, name: '文档.docx', fileType: 'docx' }),
            blobUrl: 'blob:http://localhost/x',
        })
        expect(config.documentType).toBe('word')
        expect(config.document.key).toBe('abc-42')
        expect(config.document.title).toBe('文档.docx')
        expect(config.document.url).toBe('blob:http://localhost/x')
        expect(config.editorConfig.lang).toBe('zh-CN')
        expect(config.editorConfig.mode).toBe('edit')
        expect(config.localOpenFromBinary).toBeUndefined()
    })

    it('pdf + blob 来源走二进制打开：url 置空 + localOpenFromBinary 标记', () => {
        const config = buildOnlyofficeConfig({
            record: recordOf({ fileType: 'pdf', name: '扫描.pdf' }),
            blobUrl: 'blob:x',
        })
        expect(config.documentType).toBe('pdf')
        expect(config.document.url).toBeUndefined()
        expect(config.document.localOpenFromBinary).toBe(true)
        expect(config.localOpenFromBinary).toBe(true)
        expect(config.document.isForm).toBe(false)
    })

    it('record 缺字段直接抛错（外部边界运行时校验）', () => {
        expect(() => buildOnlyofficeConfig({})).toThrow()
        expect(() => buildOnlyofficeConfig({ record: { id: '', name: 'a', fileType: 'docx' } as FileRecord })).toThrow(
            'record.id is required',
        )
    })
})

describe('normalizeEmbedConfig（/embed 配置补全，与原 onlyoffice.html normalizeConfig 对齐）', () => {
    it('只给 url：fileType/documentType/key/directUrl/title 全部自动补全', () => {
        const config = normalizeEmbedConfig({
            document: { url: '/blank/blank.docx' },
        })
        expect(config.document.fileType).toBe('docx')
        expect(config.documentType).toBe('word')
        expect(config.document.directUrl).toBe('/blank/blank.docx')
        expect(config.document.title).toBe('文档.docx')
        expect(config.document.key).toMatch(/^doc-\d+$/)
    })

    it('只给 fileType 无 url：documentType 按扩展名，key 稳定（空 url 哈希），title 兜底扩展名', () => {
        const config = normalizeEmbedConfig({ document: { fileType: 'xlsx' } })
        expect(config.documentType).toBe('cell')
        expect(config.document.title).toBe('文档.xlsx')
        // key 只依赖 url|title：同输入同输出（稳定哈希，刷新不丢会话）
        expect(config.document.key).toBe(normalizeEmbedConfig({ document: { fileType: 'xlsx' } }).document.key)
    })

    it('已有字段不被覆盖（补全语义，非重置语义）', () => {
        const config = normalizeEmbedConfig({
            document: { url: '/a.docx', fileType: 'docx', key: 'custom-key', title: '自定义' },
        })
        expect(config.document.fileType).toBe('docx')
        expect(config.document.key).toBe('custom-key')
        expect(config.document.title).toBe('自定义')
    })

    it('docConfig 无 document 字段不抛错（空壳补全）', () => {
        const config = normalizeEmbedConfig({})
        expect(config.document.title).toBe('文档.docx')
    })
})
