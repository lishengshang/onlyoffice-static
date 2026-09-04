<script setup lang="ts">
// 主页：新建 / 打开 / 最近文件（原 office.html 主体 + main.js）
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import CreateGrid from '../components/CreateGrid.vue'
import OpenPanel from '../components/OpenPanel.vue'
import RecentList from '../components/RecentList.vue'
import { useRecentStore } from '../stores/recent'
import { useToastStore } from '../stores/toast'
import type { FileRecord } from '../types/record'

const NEW_DOC_NAMES = {
    docx: '新建Word文档',
    xlsx: '新建Excel表格',
    pptx: '新建演示文稿',
    pdf: '新建PDF文档',
} as const

const router = useRouter()
const recent = useRecentStore()
const toast = useToastStore()

onMounted(() => {
    recent.refresh()
})

async function createNewDoc(ext: keyof typeof NEW_DOC_NAMES): Promise<void> {
    const record: FileRecord = {
        id: 'f-' + Date.now(),
        name: await recent.uniqueName(`${NEW_DOC_NAMES[ext]}.${ext}`),
        fileType: ext,
        size: 0,
        blob: null, // 首次保存后才有内容
    }
    // PDF 需要空白模板作基底，其余类型编辑器支持无 url 新建
    if (ext === 'pdf') {
        try {
            const resp = await fetch('/assets/empty.pdf')
            record.blob = await resp.blob()
            record.size = record.blob.size
        } catch {
            toast.show('空白 PDF 模板加载失败')
            return
        }
    }
    await recent.saveRecord(record)
    router.push(`/edit/${record.id}`)
}
</script>

<template>
    <div class="container">
        <div class="header">
            <h1>ONLYOFFICE Personal</h1>
            <p>完全本地化的办公套件 — 文件不出浏览器，最近文件保存在本机 IndexedDB</p>
        </div>

        <div class="section">
            <h2 class="section-title">新建文档</h2>
            <CreateGrid @create="createNewDoc" />
        </div>

        <div class="section">
            <h2 class="section-title">打开文档</h2>
            <OpenPanel />
        </div>

        <div class="section">
            <h2 class="section-title">最近文件</h2>
            <RecentList />
        </div>
    </div>
</template>

<style scoped>
.container {
    max-width: 920px;
    margin: 0 auto;
    padding: 48px 24px 64px;
}

.header h1 {
    font-size: 1.5rem;
    font-weight: 600;
}

.header p {
    color: var(--text-2);
    font-size: 0.9rem;
    margin-top: 6px;
}

.section {
    margin-top: 36px;
}

.section-title {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--text-3);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin-bottom: 12px;
}
</style>
