// 验证 EditorView 深链恢复后立即保存是否受 forEach bug 影响（url 打开路径的回归探针）
// 运行：npm run build && npm run preview 起服务后，npm run smoke:deeplink
import { BASE, launchBrowser } from './helpers.mjs'

const browser = await launchBrowser()
const page = await browser.newPage()
const errors = []
page.on('console', (m) => {
    if (m.type() === 'error' && m.text().includes('forEach')) errors.push(m.text().slice(0, 80))
})

await page.goto(BASE, { waitUntil: 'domcontentloaded' })
await page.waitForSelector('.doc-card', { timeout: 15000 })
await page.locator('.doc-card').first().click()
await page.waitForSelector('.editor-mount iframe', { timeout: 25000 })
await page.waitForTimeout(18000)
await page.locator('.bar-btn.primary').click()
await page.waitForSelector('.toast.show', { timeout: 20000 })
console.log('第一次保存:', (await page.locator('.toast').textContent())?.trim())
await page.locator('.bar-btn').last().click()
await page.waitForSelector('.file-item', { timeout: 10000 })

// 深链恢复（url 打开路径）
await page.locator('.file-item').first().click()
await page.waitForSelector('.editor-mount iframe', { timeout: 25000 })
await page.waitForTimeout(18000)

// 恢复后立即保存：若 forEach bug 影响 url 打开，保存会超时/失败
await page.locator('.bar-btn.primary').click()
await page.waitForSelector('.toast.show', { timeout: 35000 })
console.log('深链恢复后保存:', (await page.locator('.toast').textContent())?.trim())
console.log('forEach 错误出现次数:', errors.length)

await browser.close()
process.exit(errors.length ? 1 : 0)
