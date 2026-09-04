<script setup lang="ts">
// 编辑器顶栏：标题 / 修改标记 / 保存 / 下载 / 关闭（原 .editor-bar）
import { useEditorStore } from '../stores/editor'

const editor = useEditorStore()
</script>

<template>
    <div class="editor-bar">
        <span class="title">{{ editor.title }}</span>
        <span class="dot" :class="{ show: editor.modified }" title="有未保存修改"></span>
        <button class="bar-btn primary" :disabled="editor.saving" @click="editor.saveCurrent()">
            保存
        </button>
        <button class="bar-btn" @click="editor.downloadCurrent()">下载</button>
        <button class="bar-btn" @click="editor.close()">关闭</button>
    </div>
</template>

<style scoped>
.editor-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    background: #fff;
    border-bottom: 1px solid var(--border);
}

.editor-bar .title {
    flex: 1;
    font-size: 0.9rem;
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.editor-bar .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #ff8800;
    display: none;
    flex-shrink: 0;
}

.editor-bar .dot.show {
    display: block;
}

.bar-btn {
    background: none;
    color: var(--text-2);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 6px 16px;
    font-size: 0.85rem;
    cursor: pointer;
    transition: background 0.15s ease;
}

.bar-btn:hover {
    background: var(--bg);
}

.bar-btn.primary {
    background: var(--accent);
    border-color: var(--accent);
    color: #fff;
}

.bar-btn.primary:hover {
    background: var(--accent-hover);
}

.bar-btn:disabled {
    opacity: 0.5;
    cursor: default;
}
</style>
