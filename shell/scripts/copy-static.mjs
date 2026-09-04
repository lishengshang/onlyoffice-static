// 构建后处理：把仓库根目录的静态资源拷入 Vite 产物 dist/
// - 编译产物目录（9.3.0.x-<hash>/）、blank/、docs/、LICENSE.txt 整体拷贝
// - assets/ 与 dist/assets 合并（Vite 已从 shell/public 带入 favicon）
// - onlyoffice.html 逐字节原样复制（postMessage 协议契约，不进打包器）
// - _headers / _redirects 是 Cloudflare Pages 配置，必须位于部署根
import { cpSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const shellDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const repoRoot = resolve(shellDir, '..')
const dist = resolve(shellDir, 'dist')

const PRODUCT_DIR = /^9\.\d+\.\d+\.\d+-[0-9a-f]+$/

function copyIn(src, dest) {
    cpSync(src, dest, { recursive: true })
    console.log(`copied  ${src} -> ${dest}`)
}

// 1. 编译产物目录
const productDirs = readdirSync(repoRoot).filter((name) => {
    try {
        return PRODUCT_DIR.test(name) && statSync(join(repoRoot, name)).isDirectory()
    } catch {
        return false
    }
})
if (productDirs.length === 0) {
    console.error('错误：仓库根目录找不到 9.x.x.x-<hash> 编译产物目录')
    process.exit(1)
}
for (const dir of productDirs) copyIn(join(repoRoot, dir), join(dist, dir))

// 2. 其他静态资源
for (const name of ['blank', 'docs', 'LICENSE.txt']) {
    copyIn(join(repoRoot, name), join(dist, name))
}

// 3. assets/ 合并进 dist/assets（favicon 已由 Vite public 目录带入）
copyIn(join(repoRoot, 'assets'), join(dist, 'assets'))

// 4. 协议契约文件与 Cloudflare 配置，逐字节复制
for (const name of ['onlyoffice.html', '_headers', '_redirects']) {
    cpSync(join(repoRoot, name), join(dist, name))
    console.log(`copied  ${name}（原样）`)
}

console.log('copy-static 完成')
