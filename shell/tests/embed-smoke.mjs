// embed 协议冒烟：宿主页注入 iframe(/embed) → onlyoffice-config（仅 url，验证配置补全）
// → onlyoffice-document-ready → onlyoffice-save（requestId）→ 断言 onlyoffice-saved 回执
// 同时断言宿主页（top）直接收到引擎原始 onlyoffice-file-stream（原架构一致行为）
// 注意：不再手动预热——EmbedView 自带引擎大资源预热（warmEngineResources），本脚本
// 以"冷缓存直开"验证该缓解措施闭环：保存全链路成功即字体表竞态未发生
// 运行：npm run build && npm run preview 起服务后，npm run smoke:embed
import { BASE, check, launchBrowser, summarize } from './helpers.mjs'

const pageErrors = []

const browser = await launchBrowser()
const page = await browser.newPage()
page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 120)))

// 1. 打开宿主页（复用 Vue 主页作为外部系统页面），冷缓存直接走协议流程
await page.goto(BASE, { waitUntil: 'domcontentloaded' })
await page.waitForSelector('.doc-card', { timeout: 15000 })
check('宿主页（Vue 主页）挂载', true)

// 2. 注入 iframe + 协议握手 + 保存（全部在宿主页上下文里完成）
await page.evaluate(() => {
    const iframe = document.createElement('iframe')
    iframe.src = '/embed'
    iframe.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:99999;border:0'
    document.body.appendChild(iframe)
    window.__embed = { iframe, types: [], saved: null, rawStream: null }
    window.addEventListener('message', (e) => {
        const t = e.data && e.data.type
        if (!t) return
        if (t === 'onlyoffice-file-stream') {
            window.__embed.rawStream = { fileName: e.data.fileName, fileType: e.data.fileType, size: e.data.buffer?.byteLength }
            return // 引擎直接投给 top 的原始流（非 embed 转发）
        }
        window.__embed.types.push(t)
        if (t === 'onlyoffice-ready') {
            iframe.contentWindow.postMessage(
                { type: 'onlyoffice-config', docConfig: { document: { url: '/blank/blank.docx' } } }, // 故意只给 url：验证配置自动补全
                '*',
            )
        }
        if (t === 'onlyoffice-document-ready') {
            iframe.contentWindow.postMessage({ type: 'onlyoffice-save', requestId: 'smoke-save-1' }, '*')
        }
        if (t === 'onlyoffice-saved') window.__embed.saved = e.data
    })
})

// 3. 等待保存回执（引擎加载 ~13MB 本地需要时间）
await page.waitForFunction(() => window.__embed && window.__embed.saved, null, { timeout: 90000 })
// ArrayBuffer 过 CDP 序列化会变 {}，byteLength 需在页面内取出
const embed = await page.evaluate(() => {
    const e = window.__embed
    return {
        types: e.types,
        saved: { ...e.saved, byteLength: e.saved.buffer instanceof ArrayBuffer ? e.saved.buffer.byteLength : 0 },
        rawStream: e.rawStream,
    }
})

check('收到 onlyoffice-ready', embed.types.includes('onlyoffice-ready'))
check('收到 onlyoffice-document-ready', embed.types.includes('onlyoffice-document-ready'))
check('保存回执 ok=true', embed.saved.ok === true, JSON.stringify(embed.saved).slice(0, 80))
check('保存回执 requestId 匹配', embed.saved.requestId === 'smoke-save-1')
check('保存回执含非空 buffer', embed.saved.byteLength > 0, `${embed.saved.byteLength} bytes`)
check('保存回执 fileType=docx（URL 自动补全）', embed.saved.fileType === 'docx')
check('保存回执 fileName 含扩展名', /\.docx$/.test(embed.saved.fileName || ''), embed.saved.fileName)
check('宿主页直接收到引擎原始流（top 投递）', !!embed.rawStream && embed.rawStream.size > 0, JSON.stringify(embed.rawStream))

// 4. 编辑器 iframe 在 embed 内真实渲染（下钻两层：embed iframe -> DocsAPI iframe）
const engineOk = await page
    .evaluate(() => {
        const embedFrame = document.querySelector('iframe[src="/embed"]')
        const doc = embedFrame?.contentDocument
        const inner = doc?.querySelector('.embed-page .editor-mount iframe')
        return !!inner
    })
    .catch(() => false)
check('嵌套结构：宿主页 iframe(/embed) 内 DocsAPI iframe', engineOk === true)

check('页面 JS 运行时错误（含字体表竞态 g_font_infos）', pageErrors.length === 0, pageErrors.join(' ; ') || '无')

await browser.close()
summarize()
