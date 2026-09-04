// 构建后处理：把仓库根目录的静态资源拷入 Vite 产物 dist/
// - 编译产物目录（9.3.0.x-<hash>/）整体拷贝，但排除帮助文档（约 500MB / 1.5 万文件，
//   编辑器仅在点击"帮助"按钮时按需加载，中文壳层用不到，且 CF Pages 部署有 2 万文件上限）
// - blank/、LICENSE.txt 整体拷贝；docs/ 只留在仓库供 GitHub 阅读，不进部署产物
// - assets/ 与 dist/assets 合并（Vite 产物输出在 dist/app/，互不混淆）
// - onlyoffice.html 逐字节原样复制（postMessage 协议契约，不进打包器）
// - _headers / _redirects 是 Cloudflare Pages 配置，必须位于部署根
// - 引擎目录按版本目录名做 sentinel 增量拷贝：同名目录且排除规则未变则跳过，
//   CF 全新 checkout 不受影响，本地重建从 ~6 分钟降到秒级
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const shellDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const repoRoot = resolve(shellDir, '..')
const dist = resolve(shellDir, 'dist')

const PRODUCT_DIR = /^9\.\d+\.\d+\.\d+-[0-9a-f]+$/
// 帮助文档：web-apps/apps/<editor>/main/resources/help（含 common 的共享帮助）
const HELP_DIR = /[\\/]web-apps[\\/]apps[\\/][^\\/]+[\\/]main[\\/]resources[\\/]help([\\/]|$)/
// 排除规则变化时递增，触发引擎目录强制重新拷贝（避免 dist 里残留已排除的旧文件）
const COPY_VERSION = 'v1-strip-help'

const statePath = join(dist, '.copy-static-state.json')
let state = {}
try {
    state = JSON.parse(readFileSync(statePath, 'utf8'))
} catch {
    /* 首次构建或文件损坏，全量拷贝 */
}

function saveState() {
    mkdirSync(dist, { recursive: true })
    writeFileSync(statePath, JSON.stringify(state, null, 2))
}

function copyIn(src, dest) {
    cpSync(src, dest, { recursive: true })
    console.log(`copied  ${src} -> ${dest}`)
}

// 1. 编译产物目录（增量 + 排除帮助文档）
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
for (const dir of productDirs) {
    const dest = join(dist, dir)
    if (state[dir] === COPY_VERSION && existsSync(dest)) {
        console.log(`skipped ${dir}（已拷贝，规则 ${COPY_VERSION}）`)
        continue
    }
    // 先删后拷：排除规则变化时清掉 dist 里残留的旧文件（如上一版未排除的帮助文档）。
    // 某些环境（本地沙箱护栏）会拦截万级文件的 rmSync：此时明确退出并提示手动清理，
    // 绝不带残留合并拷贝；CF 构建机为全新 checkout，dist 不存在，不会走到这里
    try {
        rmSync(dest, { recursive: true, force: true })
    } catch (err) {
        console.error(
            `错误：无法清理旧目录 ${dest}（排除规则已更新，不能带残留合并拷贝）。\n` +
                '请手动删除 shell/dist 后重新构建。原因：' +
                err.message,
        )
        process.exit(1)
    }
    cpSync(join(repoRoot, dir), dest, {
        recursive: true,
        filter: (src) => !HELP_DIR.test(src),
    })
    state[dir] = COPY_VERSION
    console.log(`copied  ${dir}（已排除帮助文档）`)
}
saveState()

// 2. 其他静态资源（docs/ 不进部署产物）
for (const name of ['blank', 'LICENSE.txt']) {
    copyIn(join(repoRoot, name), join(dist, name))
}
const staleDocs = join(dist, 'docs')
if (existsSync(staleDocs)) {
    rmSync(staleDocs, { recursive: true, force: true })
    console.log('removed dist/docs（历史残留）')
}

// 3. assets/ 合并进 dist/assets（引擎契约静态文件：favicon、empty*.pdf）
copyIn(join(repoRoot, 'assets'), join(dist, 'assets'))

// 4. 协议契约文件与 Cloudflare 配置，逐字节复制
for (const name of ['onlyoffice.html', '_headers', '_redirects']) {
    cpSync(join(repoRoot, name), join(dist, name))
    console.log(`copied  ${name}（原样）`)
}

console.log('copy-static 完成')
