# ONLYOFFICE Personal（fork）

[![License](https://img.shields.io/badge/license-AGPL--3.0-blue.svg)](LICENSE.txt)
[![Upstream](https://img.shields.io/badge/fork%20of-fernfei%2FOnlyofficePersonal-blueviolet.svg)](https://github.com/fernfei/OnlyofficePersonal)

在浏览器里跑的离线版 ONLYOFFICE。基于 `x2t.wasm` 做文档转换，不需要 Document Server，也不需要任何后端——打开一个静态页面就能编辑 Word、Excel、PPT 和 PDF，文件全程留在本地。

> **关于本 fork**：本项目 fork 自 [fernfei/OnlyofficePersonal](https://github.com/fernfei/OnlyofficePersonal)（`9.3.0.133` 编译产物快照，快照档案见 [UPSTREAM.md](UPSTREAM.md)），在其基础上将原生 JS 演示页重构为 Vue 3 壳层工程，并对部署产物与缓存策略做了瘦身优化。

[English](README_EN.md)

![主界面](docs/imgs/img.png)

## 与上游的差异

- **壳层重构**：原生 JS 演示页 `office.html` → Vue 3 + TypeScript + Pinia + Vue Router 的 SPA（`shell/`），新建/打开/最近文件/编辑器全部组件化，最近文件存 IndexedDB，深链 `/edit/:id` 刷新可恢复。
- **部署产物瘦身**：构建时排除引擎内置帮助文档（-504MB / -15,000 文件，帮助面板内容不可用为已知取舍），部署文件数 17,686 → 2,645。
- **缓存策略**：Vite 带 hash 产物独立 `/app/` 目录上 immutable 长缓存，引擎目录按版本内容寻址。
- **工程化**：TypeScript strict + vue-tsc、ESLint 9 flat、Prettier、postMessage 协议 TS 判别联合类型化。

## 特点

- **无服务器**：文档的打开、编辑、导出都在浏览器内完成，不上传任何文件。
- **格式支持**：docx / xlsx / pptx 及对应的 ODF、CSV 等，PDF 支持注释、表单填写和文本编辑。
- **可集成**：`onlyoffice.html` 提供一套 postMessage 协议，能嵌进你自己的系统，取回编辑后的文件流。
- **纯静态**：任意静态服务器都能托管，也可以直接打包进前端工程。

基于 ONLYOFFICE 9.3 编译产物，**内置 `x2t.wasm` 已升级为最新的 9.4 版本**。

## 快速开始

壳层工程在 `shell/`，需要 Node.js 22+：

```bash
cd shell
npm install

npm run dev        # 开发模式，http://localhost:5173（引擎等静态资源由 dev 中间件挂载）
npm run build      # 完整构建：类型检查 + vite build + 引擎拷贝 → shell/dist/
npm run preview    # 预览构建产物，http://localhost:4173
```

> `npm run build` 会把仓库根的引擎产物（约 660MB）拷入 `shell/dist/`，构建出的目录即完整可部署站点。引擎目录不变时重复构建走增量拷贝，秒级完成。

## 界面

Word 文档

![Word 编辑器](docs/imgs/img_1.png)

Excel 表格

![Excel 编辑器](docs/imgs/img_2.png)

PowerPoint 演示

![PowerPoint 编辑器](docs/imgs/img_3.png)

PDF 编辑

![PDF 编辑器](docs/imgs/img_5.png)

## 集成到自己的系统

把仓库整体（`shell/dist/` 构建产物）放到前端工程的静态目录下，用 iframe 嵌入 `/embed` 路由，通过 postMessage 注入文档、取回文件流。

- **[使用文档](docs/使用文档.md)**：三种集成方式、docConfig 配置、消息协议、保存文件流、文件名与重命名、另存为、连接器（Automation API），以及一份 Vue 组件封装。
- **[文件流提取原理](docs/集成教程-文件流提取.md)**：离线版没有保存回调，这篇讲清楚字节是怎么从 `x2t.downloadFile` 里取出来的。
- **[部署优化 - 资源压缩](docs/部署优化-资源压缩.md)**：`x2t.wasm` 有 40M，预压缩 + 强缓存能把传输体积降到 6.6M（-84%），附 `precompress.sh` 用法和 Nginx 配置。

## 目录结构

```
onlyoffice-static/
├── 9.3.0.133-*/          # ONLYOFFICE 编译产物（web-apps / sdkjs / fonts）
├── assets/               # favicon、空白 PDF 等静态资源（引擎契约路径）
├── blank/                # 新建文档用的空白模板
├── docs/                 # 文档与截图
├── shell/                # 壳层工程：Vue 3 + TS SPA（主页 /、编辑器 /edit/:id、集成 /embed）
│   └── dist/             # 构建产物 = 完整可部署站点
├── _headers / _redirects # Cloudflare Pages 缓存与 SPA 回退规则（配置已就绪，暂未启用）
└── precompress.sh        # 静态资源预压缩脚本（Nginx brotli_static 用）
```

## 部署

产物是纯静态站点，任意静态服务器可托管。`shell/dist/` 即部署目录：Nginx 配置与压缩优化见 [部署优化 - 资源压缩](docs/部署优化-资源压缩.md)；Cloudflare Pages 的配置（`_headers` / `_redirects`、SPA 回退、x2t.wasm 41MB 的 brotli rewrite）已备好，计划等项目完善后再上线。

## 致谢

- [fernfei/OnlyofficePersonal](https://github.com/fernfei/OnlyofficePersonal) —— 本项目的上游，提供了 ONLYOFFICE 9.3 静态编译产物与 `onlyoffice.html` 集成方案的初始实现。
- [ONLYOFFICE](https://www.onlyoffice.com/) —— 编辑器与 `x2t.wasm` 转换引擎的作者。
- [cryptpad/onlyoffice-x2t-wasm](https://github.com/cryptpad/onlyoffice-x2t-wasm) —— 上游 x2t.wasm 构建管线的来源。

## 许可证

[AGPL-3.0](LICENSE.txt)。ONLYOFFICE 相关组件版权归 [ONLYOFFICE](https://www.onlyoffice.com/) 所有。
