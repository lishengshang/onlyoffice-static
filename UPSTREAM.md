# 上游来源档案

| 项 | 值 |
|---|---|
| 来源仓库 | https://github.com/fernfei/OnlyofficePersonal |
| 快照分支 | `9.3.0.133`（默认分支） |
| 快照 commit | `7583158067fb0c9bdb312cbdc76d4f9fa32ef6c9` |
| 快照时间 | 2026-09-03（本地落盘） |
| 引擎版本 | ONLYOFFICE 9.3 编译产物，x2t.wasm 已升至 9.4 |
| 产物目录 | `9.3.0.133-24e34b4f401d86dfb31def637358e2fa/` |
| 许可证 | AGPL-3.0（ONLYOFFICE 组件版权归 ONLYOFFICE 所有） |

## 与上游的关系

**本仓库定义为 [fernfei/OnlyofficePersonal](https://github.com/fernfei/OnlyofficePersonal) 的 fork**：以 tarball 快照方式建立，不含上游 git 历史，因此不是 GitHub 意义上的 fork 按钮 derived 仓库，但来源、致谢与升级路径均按 fork 对待（见根 README 致谢一节）。
上游停更不影响本仓库运行——产物是可用快照；本 fork 的全部改动见根 README「与上游的差异」。

## 以后升级引擎的三条路径

1. **同步上游**：盯 fernfei 的新产物，下载新版 tarball 替换 `9.3.0.x-<hash>/` 目录，改 onlyoffice.html 的版本引用
2. **自己编译**：sdkjs 用官方 `build/build.py`（纯拼接，只需 Python 3）；web-apps 用 build/ 下 grunt；
   x2t.wasm 用 https://github.com/cryptpad/onlyoffice-x2t-wasm 的 Docker 管线
3. **换集成方案**：ranuts/document 或 electroluxcode/onlyoffice-web-comp（均基于 OnlyOffice 静态 SDK）

## 部署备忘

- `precompress.sh` 生成的 .br/.gz 仅供 Nginx `brotli_static`/`gzip_static`；
  **GitHub Pages 模式不要提交 sidecar 文件**（体积翻倍且无效）
- 入口页全部相对路径，可部署在任意子路径（如 `lishengshang.github.io/onlyoffice-static/`）
