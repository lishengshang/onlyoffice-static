<script setup lang="ts">
// 新建文档四卡片（原 .create-grid / .doc-card）
import FileBadge from './FileBadge.vue'

const emit = defineEmits<{ create: [ext: 'docx' | 'xlsx' | 'pptx' | 'pdf'] }>()

const DOCS = [
    { ext: 'docx', type: 'word', name: '文档', sub: 'Word · docx' },
    { ext: 'xlsx', type: 'cell', name: '表格', sub: 'Excel · xlsx' },
    { ext: 'pptx', type: 'slide', name: '演示文稿', sub: 'PowerPoint · pptx' },
    { ext: 'pdf', type: 'pdf', name: 'PDF', sub: '可编辑 · pdf' },
] as const
</script>

<template>
    <div class="create-grid">
        <div v-for="doc in DOCS" :key="doc.ext" class="doc-card" @click="emit('create', doc.ext)">
            <FileBadge :type="doc.type" />
            <div>
                <div class="name">{{ doc.name }}</div>
                <div class="sub">{{ doc.sub }}</div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.create-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
    gap: 12px;
}

.doc-card {
    display: flex;
    align-items: center;
    gap: 12px;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 14px 16px;
    cursor: pointer;
    transition:
        border-color 0.15s ease,
        box-shadow 0.15s ease;
}

.doc-card:hover {
    border-color: #c0c6cf;
    box-shadow: 0 2px 8px rgba(31, 35, 41, 0.06);
}

.doc-card .name {
    font-size: 0.92rem;
    font-weight: 500;
}

.doc-card .sub {
    font-size: 0.78rem;
    color: var(--text-3);
    margin-top: 2px;
}
</style>
