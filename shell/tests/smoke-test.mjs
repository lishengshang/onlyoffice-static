// 冒烟测试：直连 DocsAPI（去除 onlyoffice.html 中转层）后的全链路功能验证
// 流程：主页 4 卡片 → 新建 docx → 编辑器 iframe 全链路 → 保存 → toast + 最近文件
//      → 关闭回主页 → 最近文件深链 /edit/:id 恢复 → 截图
// 已知非回归：plugins.json / themes.json 请求失败（上游快照缺失）
// 运行：npm run build && npm run preview 起服务后，npm run smoke
// 路径配置见 helpers.mjs（SMOKE_BASE / SMOKE_CHROMIUM / SMOKE_PLAYWRIGHT）
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { BASE, check, launchBrowser, summarize } from './helpers.mjs'

const artifacts = path.join(path.dirname(fileURLToPath(import.meta.url)), 'artifacts')
const results_badRequests = []

const browser = await launchBrowser()
const page = await browser.newPage()
page.on('requestfailed', (r) => results_badRequests.push(`FAILED ${r.url().slice(-80)}`))
page.on('response', (r) => {
    if (r.status() >= 400) results_badRequests.push(`${r.status()} ${r.url().slice(-80)}`)
})
const pageErrors = []
page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 120)))

// 1. 主页
await page.goto(BASE, { waitUntil: 'domcontentloaded' })
await page.waitForSelector('.doc-card', { timeout: 15000 })
check('主页 Vue 挂载 + 4 个新建卡片', (await page.locator('.doc-card').count()) === 4)
check('标题', (await page.title()) === 'ONLYOFFICE Personal')

// 2. 新建 docx → 编辑器（直连：挂载点 + DocsAPI 自建 iframe，无 onlyoffice.html 中转）
await page.locator('.doc-card').first().click()
await page.waitForURL('**/edit/**', { timeout: 10000 })
check('路由进入 /edit/:id', /\/edit\/.+/.test(page.url()), page.url())
check('无中转 iframe（直连架构）', (await page.locator('iframe[src="/onlyoffice.html"]').count()) === 0)
await page.waitForSelector('.editor-mount iframe', { timeout: 25000 })
check('编辑器顶栏（保存/下载/关闭）', (await page.locator('.bar-btn').count()) === 3)

// 3. 引擎全链路：编辑器 UI 在 DocsAPI 自建的 iframe（documenteditor）里
const editorFrame = () => page.frames().find((f) => f.url().includes('documenteditor'))
await page.waitForTimeout(18000) // sdk-all.js ~13MB 本地加载 + 引擎初始化
const engineOk = await editorFrame()
    ?.evaluate(() => !!document.querySelector('#editor_sdk') || document.body.innerHTML.length > 5000)
    .catch(() => false)
check('OnlyOffice 引擎加载（documenteditor 帧渲染）', engineOk === true)

// 4. 保存 → toast → 最近文件
await page.locator('.bar-btn.primary').click()
await page.waitForSelector('.toast.show', { timeout: 20000 })
const toastText = await page.locator('.toast').textContent()
check('保存后 toast 提示', !!toastText && toastText.length > 0, toastText?.trim())

// 5. 关闭 → 回主页 → 最近文件有记录
await page.locator('.bar-btn').last().click()
await page.waitForURL(BASE + '/', { timeout: 10000 })
await page.waitForSelector('.file-item', { timeout: 10000 })
check('关闭回主页 + 最近文件有记录', (await page.locator('.file-item').count()) === 1)

// 6. 深链 /edit/:id 恢复
await page.locator('.file-item').first().click()
await page.waitForURL('**/edit/**', { timeout: 10000 })
await page.waitForSelector('.editor-mount iframe', { timeout: 25000 })
await page.waitForTimeout(18000)
const recovered = await editorFrame()
    ?.evaluate(() => !!document.querySelector('#editor_sdk') || document.body.innerHTML.length > 5000)
    .catch(() => false)
check('深链 /edit/:id 恢复文档', recovered === true)

// 7. 截图留证（artifacts/ 已 gitignore）
await page.screenshot({ path: path.join(artifacts, 'smoke-editor.png'), fullPage: false })
await page.goBack()
await page.waitForTimeout(1000)
await page.screenshot({ path: path.join(artifacts, 'smoke-home.png'), fullPage: false })

// 汇总：plugins.json / themes.json 请求失败为已知非回归（上游快照缺失）
const known = results_badRequests.filter((b) => b.includes('plugins.json') || b.includes('themes.json'))
const otherBad = results_badRequests.filter((b) => !known.includes(b))
check('HTTP 异常请求（plugins/themes 404 为已知非回归）', otherBad.length === 0, otherBad.join(' ; ') || '无')
check('页面 JS 运行时错误', pageErrors.length === 0, pageErrors.join(' ; ') || '无')

await browser.close()
summarize()
