// protocol.ts 单测：postMessage 消息收窄（引擎文件流 + /embed 入站协议）
import { describe, expect, it } from 'vitest'
import { parseEmbedInbound, parseFileStream } from '../types/protocol'

describe('parseFileStream（引擎 x2t_helper 抛出的文件流）', () => {
    it('合法消息原样通过', () => {
        const msg = {
            type: 'onlyoffice-file-stream',
            fileName: '文档.docx',
            fileType: 'docx',
            buffer: new ArrayBuffer(8),
        }
        expect(parseFileStream(msg)).toBe(msg)
    })

    it('非对象 / 无 type / type 不符 / buffer 非 ArrayBuffer 均拒绝', () => {
        expect(parseFileStream(null)).toBeNull()
        expect(parseFileStream('onlyoffice-file-stream')).toBeNull()
        expect(parseFileStream({})).toBeNull()
        expect(parseFileStream({ type: 'other', buffer: new ArrayBuffer(1) })).toBeNull()
        expect(parseFileStream({ type: 'onlyoffice-file-stream', buffer: new Uint8Array(4) })).toBeNull()
    })
})

describe('parseEmbedInbound（外部系统 -> /embed 入站）', () => {
    it('config 与 save 两种类型放行（docConfig 保持 unknown，由 EmbedView 二次校验）', () => {
        expect(parseEmbedInbound({ type: 'onlyoffice-config', docConfig: {} })?.type).toBe(
            'onlyoffice-config',
        )
        expect(parseEmbedInbound({ type: 'onlyoffice-save', requestId: 'r1' })?.type).toBe(
            'onlyoffice-save',
        )
    })

    it('其他类型与非对象拒绝（防伪造消息注入）', () => {
        expect(parseEmbedInbound({ type: 'onlyoffice-saved' })).toBeNull()
        expect(parseEmbedInbound({ type: 'onlyoffice-file-stream' })).toBeNull()
        expect(parseEmbedInbound('onlyoffice-save')).toBeNull()
        expect(parseEmbedInbound(undefined)).toBeNull()
    })
})
