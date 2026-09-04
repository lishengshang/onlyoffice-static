import { readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import vue from '@vitejs/plugin-vue'
import sirv from 'sirv'
import { defineConfig, type Plugin } from 'vite'

// 壳层 SPA 工程说明：
// - 单入口 index.html（Vue SPA，history 路由：/ 主页、/edit/:id 编辑器）
// - onlyoffice.html 是 postMessage 协议契约文件，不进打包器，构建后由 copy-static.mjs 原样复制
// - 引擎产物（9.3.0.x-<hash>/、assets/、blank/ 等）不参与打包，构建后统一拷入 dist
// - 部署时 CF Pages 构建命令：cd shell && npm ci && npm run build，输出目录 shell/dist

const repoRoot = fileURLToPath(new URL('..', import.meta.url))
const ENGINE_DIR = /^9\.\d+\.\d+\.\d+-[0-9a-f]+$/

// 引擎 vendor 绝对路径（如 /9.3.0.133-<hash>/vendor），注入 __ENGINE_VENDOR__
// 供壳层直连 DocsAPI（api.js）；引擎换目录时自动跟随，无需手改任何引用
const engineDirs = readdirSync(repoRoot).filter((name) => ENGINE_DIR.test(name))
if (engineDirs.length !== 1) {
    throw new Error(`期望恰好一个 9.x.x.x-<hash> 引擎目录，实际找到 ${engineDirs.length} 个`)
}
const ENGINE_VENDOR = `/${engineDirs[0]}/vendor`

// 仅开发模式生效的中间件：把仓库根目录的引擎产物 / 协议契约 / 静态资源
// 挂到 dev server（构建不经过这里，dist 由 copy-static.mjs 组装）
function mountRepoStatic(): Plugin {
    const mounts = readdirSync(repoRoot).filter((name) => ENGINE_DIR.test(name))
    const prefixes = new Set([
        '/onlyoffice.html',
        '/assets',
        '/blank',
        ...mounts.map((dir) => '/' + dir),
    ])
    const serve = sirv(repoRoot, { dev: true })
    return {
        name: 'mount-repo-static',
        apply: 'serve',
        configureServer(server) {
            server.middlewares.use((req, res, next) => {
                const path = (req.url ?? '').split('?')[0]
                const first = '/' + (path.split('/')[1] ?? '')
                if (prefixes.has(first)) serve(req, res, next)
                else next()
            })
        },
    }
}

export default defineConfig({
    appType: 'spa',
    plugins: [vue(), mountRepoStatic()],
    define: {
        __ENGINE_VENDOR__: JSON.stringify(ENGINE_VENDOR),
    },
    build: {
        outDir: 'dist',
        // 带 hash 的应用产物输出到 /app/，与引擎静态文件 /assets/ 分离：
        // /app/* 内容寻址可上 immutable 长缓存，/assets/* 保持短缓存
        assetsDir: 'app',
        // 不清空重建：CF 构建机每次从全新 checkout 出发（dist 天然干净）；
        // 本地重建时合并覆盖即可，避免每次删除上万个产物文件
        emptyOutDir: false,
    },
})
