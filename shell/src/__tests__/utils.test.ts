// utils.ts 纯函数单测：扩展名识别（标题重命名白名单的地基）
import { describe, expect, it } from 'vitest'
import { extOf, formatSize, hasKnownExt, mimeOf } from '../utils'

describe('extOf', () => {
    it('取最后一个点后的扩展名并小写', () => {
        expect(extOf('报告.DOCX')).toBe('docx')
        expect(extOf('a.b.c.xlsx')).toBe('xlsx')
    })

    it('无点返回空串；点在开头不算扩展名分隔', () => {
        expect(extOf('README')).toBe('')
        expect(extOf('')).toBe('')
    })
})

describe('hasKnownExt（重命名白名单：区分「报告 v1.2」的点与真实扩展名）', () => {
    it('引擎支持的扩展名返回 true', () => {
        expect(hasKnownExt('报告.docx')).toBe(true)
        expect(hasKnownExt('表格.xlsx')).toBe(true)
        expect(hasKnownExt('演示.pptx')).toBe(true)
        expect(hasKnownExt('扫描.pdf')).toBe(true)
        expect(hasKnownExt('notes.txt')).toBe(true)
    })

    it('版本号圆点不是扩展名', () => {
        expect(hasKnownExt('报告 v1.2')).toBe(false)
        expect(hasKnownExt('v2.0 草稿')).toBe(false)
    })

    it('未知扩展名返回 false', () => {
        expect(hasKnownExt('archive.zip')).toBe(false)
        expect(hasKnownExt('noext')).toBe(false)
    })
})

describe('mimeOf', () => {
    it('常见文档类型映射正确', () => {
        expect(mimeOf('docx')).toBe(
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        )
        expect(mimeOf('pdf')).toBe('application/pdf')
    })

    it('未知类型回退 octet-stream', () => {
        expect(mimeOf('xyz')).toBe('application/octet-stream')
    })
})

describe('formatSize', () => {
    it('字节与进位', () => {
        expect(formatSize(0)).toBe('0 B')
        expect(formatSize(512)).toBe('512 B')
        expect(formatSize(2048)).toBe('2.0 KB')
        expect(formatSize(5 * 1024 * 1024)).toBe('5.0 MB')
        expect(formatSize(3 * 1024 ** 3)).toBe('3.0 GB')
    })
})
