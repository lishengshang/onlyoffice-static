// postMessage 协议类型：壳层 <-> onlyoffice.html（协议契约文件，位于仓库根）
// 契约实现见仓库根 onlyoffice.html；改动需双向对齐
import type { OnlyofficeConfig } from '../config/office-config'

/** 壳层 -> onlyoffice.html */
export type ShellToFrameMessage =
    | { type: 'onlyoffice-config'; docConfig: OnlyofficeConfig; openBuffer?: ArrayBuffer }
    | { type: 'onlyoffice-save'; requestId: string; format: string }

/** onlyoffice.html -> 壳层 */
export type FrameToShellMessage =
    | { type: 'onlyoffice-ready' }
    | { type: 'onlyoffice-document-ready' }
    | { type: 'onlyoffice-open-error'; error?: string }
    | {
          type: 'onlyoffice-saved'
          /** 对应 onlyoffice-save 的 requestId；自动保存流没有 */
          requestId?: string
          ok: boolean
          buffer?: ArrayBuffer
          error?: string
          fileType?: string
          fileName?: string
      }
    | {
          type: 'onlyoffice-saveas'
          ok: boolean
          buffer?: ArrayBuffer
          fileType?: string
          error?: string
      }
    | { type: 'onlyoffice-rename'; title: string }
    | { type: 'onlyoffice-state-change'; modified: boolean }
    | { type: 'onlyoffice-request-close' }

/** 收窄未知 postMessage 数据；非 onlyoffice-* 消息返回 null */
export function parseFrameMessage(data: unknown): FrameToShellMessage | null {
    if (!data || typeof data !== 'object') return null
    const type = (data as { type?: unknown }).type
    return typeof type === 'string' && type.startsWith('onlyoffice-')
        ? (data as FrameToShellMessage)
        : null
}
