// 冒烟测试公共设施：环境变量解析、playwright 模块解析、浏览器启动、断言与汇总
//
// 目标服务（SMOKE_BASE，默认 vite preview）：需先 `npm run build && npm run preview`
// Chromium 可执行文件（SMOKE_CHROMIUM，默认本机 ms-playwright 缓存路径）
//
// playwright 模块解析（不写入 devDependencies——避免 CI `npm ci` 拉取与浏览器下载）：
//   1. SMOKE_PLAYWRIGHT 环境变量，指向 playwright 的 index.mjs 绝对路径
//   2. 常规 node_modules require('playwright')（本机装过即可）
//   3. WorkBuddy 托管安装路径（开发机默认兜底，其他机器请设置 SMOKE_PLAYWRIGHT）
import { createRequire } from 'node:module'
import path from 'node:path'

const require = createRequire(import.meta.url)

export const BASE = process.env.SMOKE_BASE || 'http://localhost:4173'
export const EXECUTABLE =
    process.env.SMOKE_CHROMIUM ||
    path.join(
        process.env.LOCALAPPDATA || '',
        'ms-playwright',
        'chromium-1234',
        'chrome-win64',
        'chrome.exe',
    )

let chromium
if (process.env.SMOKE_PLAYWRIGHT) {
    ;({ chromium } = await import(process.env.SMOKE_PLAYWRIGHT))
} else {
    try {
        ;({ chromium } = require('playwright'))
    } catch {
        ;({ chromium } = await import(
            'file:///C:/Users/remio/.workbuddy/binaries/node/workspace/node_modules/playwright/index.mjs'
        ))
    }
}

export async function launchBrowser() {
    return chromium.launch({ executablePath: EXECUTABLE, headless: true, args: ['--no-proxy-server'] })
}

const results = []

export function check(name, ok, detail = '') {
    results.push({ name, ok, detail })
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -- ' + detail : ''}`)
}

export function summarize() {
    const failed = results.filter((r) => !r.ok)
    console.log(`\n=== 结果: ${results.length - failed.length}/${results.length} 通过 ===`)
    process.exit(failed.length ? 1 : 0)
}
