<script setup lang="ts">
// 最近文件列表（原 recent-ui.js 的渲染部分）
import { useRouter } from 'vue-router'
import { documentTypeOf } from '../config/office-config'
import { useRecentStore } from '../stores/recent'
import { useToastStore } from '../stores/toast'
import type { FileRecord } from '../types/record'
import { formatSize, triggerDownload } from '../utils'
import FileBadge from './FileBadge.vue'

const router = useRouter()
const recent = useRecentStore()
const toast = useToastStore()

function openRecent(record: FileRecord): void {
    router.push(`/edit/${record.id}`)
}

function downloadRecent(record: FileRecord): void {
    if (!record.blob) {
        toast.show('该文档尚无内容，请先打开并保存')
        return
    }
    triggerDownload(record.blob, record.name)
}

function removeRecent(record: FileRecord): void {
    recent.deleteRecord(record.id)
}
</script>

<template>
    <p v-if="!recent.idbAvailable" class="empty-tip">当前浏览器不支持 IndexedDB，最近文件不可用</p>
    <p v-else-if="!recent.records.length" class="empty-tip">
        暂无文件，新建或打开的文档会出现在这里
    </p>
    <div v-else class="file-table">
        <div v-for="f in recent.records" :key="f.id" class="file-item" @click="openRecent(f)">
            <FileBadge :type="documentTypeOf(f.fileType)" />
            <div class="info">
                <div class="name">{{ f.name }}</div>
                <div class="sub">
                    {{ formatSize(f.size) }} · {{ new Date(f.updatedAt ?? 0).toLocaleString() }}
                </div>
            </div>
            <div class="actions" @click.stop>
                <button class="mini-btn" @click="downloadRecent(f)">下载</button>
                <button class="mini-btn del" @click="removeRecent(f)">删除</button>
            </div>
        </div>
    </div>
</template>

<style scoped>
.file-table {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 10px;
    overflow: hidden;
}

.file-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    cursor: pointer;
    transition: background 0.15s ease;
}

.file-item + .file-item {
    border-top: 1px solid var(--border);
}

.file-item:hover {
    background: #f7f8fa;
}

.file-item .info {
    flex: 1;
    min-width: 0;
}

.file-item .name {
    font-size: 0.92rem;
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.file-item .sub {
    font-size: 0.78rem;
    color: var(--text-3);
    margin-top: 2px;
}

.file-item .actions {
    display: flex;
    gap: 4px;
    flex-shrink: 0;
    opacity: 0;
    transition: opacity 0.15s ease;
}

.file-item:hover .actions {
    opacity: 1;
}

.mini-btn {
    border: none;
    background: none;
    border-radius: 6px;
    padding: 6px 10px;
    font-size: 0.82rem;
    color: var(--text-2);
    cursor: pointer;
}

.mini-btn:hover {
    background: #eceef1;
    color: var(--text);
}

.mini-btn.del:hover {
    background: #fdeceb;
    color: var(--pdf);
}

.empty-tip {
    text-align: center;
    color: var(--text-3);
    font-size: 0.88rem;
    padding: 32px;
    background: var(--card);
    border: 1px dashed var(--border);
    border-radius: 10px;
}

@media (max-width: 720px) {
    .file-item .actions {
        opacity: 1;
    }
}
</style>
