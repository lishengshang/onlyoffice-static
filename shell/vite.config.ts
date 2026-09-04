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

// 仅开发模式生效的中间件：把仓库根目录的引擎产物 / 协议契约 / 静态资源
// 挂到 dev server（构建不经过这里，dist 由 copy-static.mjs 组装）
function mountRepoStatic(): Plugin {
    const engineDirs = readdirSync(repoRoot).filter((name) => ENGINE_DIR.test(name))
    const prefixes = new Set([
        '/onlyoffice.html',
        '/assets',
        '/blank',
        ...engineDirs.map((dir) => '/' + dir),
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
    build: {
        outDir: 'dist',
        // 不清空重建：CF 构建机每次从全新 checkout 出发（dist 天然干净）；
        // 本地重建时合并覆盖即可，避免每次删除上万个产物文件
        emptyOutDir: false,
    },
})
