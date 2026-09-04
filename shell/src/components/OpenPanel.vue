<script setup lang="ts">
// 打开文档：本地文件（拖放/选择）、网络链接（原 open.js）
import { useDropZone, useEventListener } from '@vueuse/core'
import { ref, useTemplateRef } from 'vue'
import { useRouter } from 'vue-router'
import type { FileRecord } from '../types/record'
import { useRecentStore } from '../stores/recent'
import { useToastStore } from '../stores/toast'
import { extOf } from '../utils'

const ACCEPT = '.doc,.docx,.xls,.xlsx,.csv,.ppt,.pptx,.pdf,.odt,.ods,.odp,.txt,.rtf'

const router = useRouter()
const recent = useRecentStore()
const toast = useToastStore()

const urlInput = ref('')

const dropZoneEl = useTemplateRef<HTMLElement>('dropZone')
const fileInputEl = useTemplateRef<HTMLInputElement>('fileInput')
const dragging = ref(false)

useDropZone(dropZoneEl, {
    onEnter: () => (dragging.value = true),
    onLeave: () => (dragging.value = false),
    onDrop: (files) => {
        dragging.value = false
        if (files?.length) void handleFiles(files)
    },
})

async function importFile(file: File): Promise<FileRecord> {
    const record: FileRecord = {
        id: 'f-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
        name: await recent.uniqueName(file.name),
        fileType: extOf(file.name),
        size: file.size,
        blob: file,
    }
    await recent.saveRecord(record)
    return record
}

// 多文件仅入列表，单文件直接打开
async function handleFiles(files: File[]): Promise<void> {
    let last: FileRecord | null = null
    for (const file of files) {
        last = await importFile(file)
    }
    if (files.length === 1 && last) {
        router.push(`/edit/${last.id}`)
    } else {
        toast.show(`已添加 ${files.length} 个文件到最近文件`)
    }
}

function onFileInput(event: Event): void {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    if (file) void handleFiles([file])
}

async function openFromUrl(): Promise<void> {
    const url = urlInput.value.trim()
    if (!url) {
        toast.show('请输入文档链接')
        return
    }
    toast.show('正在下载...')
    try {
        const resp = await fetch(url)
        if (!resp.ok) throw new Error('HTTP ' + resp.status)
        const blob = await resp.blob()
        const rawName =
            decodeURIComponent(url.split('?')[0].split('#')[0].split('/').pop() || '') ||
            '网络文档.docx'
        const record: FileRecord = {
            id: 'f-' + Date.now(),
            name: await recent.uniqueName(rawName),
            fileType: extOf(rawName) || 'docx',
            size: blob.size,
            blob,
        }
        await recent.saveRecord(record)
        urlInput.value = ''
        router.push(`/edit/${record.id}`)
    } catch (e) {
        toast.show('下载失败：' + (e as Error).message + '（请确认链接有效且允许跨域）')
    }
}

useEventListener(fileInputEl, 'change', onFileInput)
</script>

<template>
    <div class="open-grid">
        <div class="panel">
            <h3>本地文件</h3>
            <div
                ref="dropZone"
                class="drop-zone"
                :class="{ dragover: dragging }"
                @click="fileInputEl?.click()"
            >
                点击选择文件，或将文件拖拽到此处
            </div>
            <input ref="fileInput" type="file" hidden :accept="ACCEPT" />
        </div>
        <div class="panel">
            <h3>网络链接</h3>
            <div class="url-row">
                <input
                    v-model="urlInput"
                    type="url"
                    placeholder="https://example.com/document.docx"
                    @keydown.enter="openFromUrl"
                />
                <button class="btn" @click="openFromUrl">打开</button>
            </div>
            <p class="url-tip">目标地址需允许跨域访问（CORS）</p>
        </div>
    </div>
</template>

<style scoped>
.open-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
}

.panel {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 16px;
}

.panel h3 {
    font-size: 0.9rem;
    font-weight: 600;
    margin-bottom: 12px;
}

.drop-zone {
    border: 1px dashed #c0c6cf;
    border-radius: 8px;
    padding: 22px 16px;
    text-align: center;
    color: var(--text-2);
    font-size: 0.88rem;
    cursor: pointer;
    transition:
        border-color 0.15s ease,
        background 0.15s ease;
}

.drop-zone:hover,
.drop-zone.dragover {
    border-color: var(--accent);
    background: #f4f7ff;
    color: var(--accent);
}

.url-row {
    display: flex;
    gap: 8px;
}

.url-row input {
    flex: 1;
    min-width: 0;
    padding: 8px 12px;
    border: 1px solid var(--border);
    border-radius: 8px;
    font-size: 0.88rem;
    color: var(--text);
    background: var(--bg);
}

.url-row input:focus {
    outline: none;
    border-color: var(--accent);
    background: #fff;
}

.url-tip {
    font-size: 0.78rem;
    color: var(--text-3);
    margin-top: 10px;
}

.btn {
    background: var(--accent);
    color: #fff;
    border: none;
    padding: 8px 18px;
    border-radius: 8px;
    font-size: 0.88rem;
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.15s ease;
}

.btn:hover {
    background: var(--accent-hover);
}

@media (max-width: 720px) {
    .open-grid {
        grid-template-columns: 1fr;
    }
}
</style>
