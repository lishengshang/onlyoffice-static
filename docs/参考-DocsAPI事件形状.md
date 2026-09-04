# 参考：DocsAPI 事件形状（官方实锤）

> 目的：把壳层"实证拼凑"的 DocsAPI 事件处理固化为有官方出处的对照表。
> 壳层所有事件回调均由 api.js 统一分发：`handler({target, data: msg.data})`（宿主端只透传，
> 负载形状由编辑器内部构造）。核对来源见文末。
> 核对时间：2026-09-04，引擎 9.3.0.133。

## 壳层用到的事件

| 事件 | 官方 data 形状 | 触发时机 | 壳层处理 | 判定 |
|---|---|---|---|---|
| `onAppReady` | 官方未定义负载 | 应用加载进浏览器 | 本地 pdf 在此 openDocument | ✅ |
| `onDocumentReady` | 官方未定义负载 | 文档加载进编辑器 | 解锁保存 / embed 回执 | ✅ |
| `onDocumentStateChange` | **boolean**（true=用户正在编辑；false=变更已送编辑服务） | 修改状态变化 | `!!event?.data` → 顶栏修改点 | ✅ 与官方逐字一致 |
| `onError` | **{errorCode, errorDescription}**（错误码表见 sdkjs common/errorCodes.js） | 错误发生 | errorDescription 优先透出，非预期形状 JSON 兜底 | ✅ 已结构化 |
| `onMetaChange` | **{title, favorite}** | meta 命令改文档名 | 取 title 走重命名 | ✅ 一致 |
| `onRequestRename` | **string，且不含文件扩展名** | 用户点"重命名…" | `hasKnownExt` 判定后补 `.${fileType}`——正是对"无扩展名"语义的正确处理 | ✅ 官方文档实锤 |
| `onRequestSaveAs` | **{url, title, fileType}** | 用户点"Save Copy as…" | 取 url 下载副本；fileUrl 双兼容为防御分支（官方无此字段） | ✅ 一致 |
| `onDownloadAs` | **{url, fileType}**（downloadAs 的响应） | 调 downloadAs 后 | 空实现：屏蔽默认下载，导出走文件流劫持 | ✅ |
| `onRequestClose` | 无负载 | 编辑器请求关闭 | 关闭会话回主页 | ✅ |

## 关键确认

1. **重命名双订阅是必要的**：`onRequestRename`（用户主动改名，data 为无扩展名字符串）与
   `onMetaChange`（meta 回执，data.title 为完整名）是两条独立链路，官方流程图明确区分。
   壳层两者都接，且都调 `recent.saveRecord` 持久化——语义正确。
2. **`setMetaData({title})` 的角色**：官方流程里集成方改名后发 meta 命令给协同服务；
   本地单机场景下 setMetaData 即本地等价物（让引擎记录新标题）。
3. **fileUrl 兼容分支可留可删**：官方从未发过 fileUrl，留作防御不碍事，但不要据此猜测有别的形状。

## 分发机制（api.js 源码，web-apps@develop）

- iframe → 宿主消息经 `MessageDispatcher` `JSON.parse` 后到 `_onMessage`；
  仅 `msg.frameEditorId == placeholderId` 的消息分发给 config.events 回调。
- 唯一特例：`onSaveDocument` 在 parse 前短路（对象直传）。壳层未订阅，不影响。
- postMessage 未指定 origin（源码标注 `TODO: specify explicit origin`）——官方自身也未做来源校验。

## 核对来源

- 宿主端源码：https://github.com/ONLYOFFICE/web-apps/blob/develop/apps/api/documents/api.js
- 重命名流程：https://api.onlyoffice.com/docs/docs-api/get-started/how-it-works/renaming-file
- 事件参考（legacy 站，内容与新版一致）：https://legacy-api.onlyoffice.com/editors/config/events
- 错误码表：https://github.com/ONLYOFFICE/sdkjs/blob/master/common/errorCodes.js
