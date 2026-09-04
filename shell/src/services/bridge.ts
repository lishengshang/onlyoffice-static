// postMessage 类型化客户端：壳层 -> onlyoffice.html 方向的发送封装
import type { OnlyofficeConfig } from '../config/office-config'
import type { ShellToFrameMessage } from '../types/protocol'

export class EditorBridge {
    constructor(private frame: HTMLIFrameElement) {}

    send(message: ShellToFrameMessage, transfer?: Transferable[]): void {
        this.frame.contentWindow?.postMessage(message, '*', transfer ?? [])
    }

    // 注入文档配置；本地二进制文档（PDF）随消息 transfer 传输
    sendConfig(docConfig: OnlyofficeConfig, openBuffer?: ArrayBuffer): void {
        const message: ShellToFrameMessage = { type: 'onlyoffice-config', docConfig }
        if (openBuffer) {
            message.openBuffer = openBuffer
            this.send(message, [openBuffer])
        } else {
            this.send(message)
        }
    }

    // 触发保存，取回编辑后的文件流
    requestSave(requestId: string, format: string): void {
        this.send({ type: 'onlyoffice-save', requestId, format })
    }
}
