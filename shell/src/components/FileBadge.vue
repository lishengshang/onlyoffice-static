<script setup lang="ts">
// 文件类型图标（原 BADGES 映射 + .badge 样式）
import { computed } from 'vue'
import type { DocumentType } from '../config/office-config'

const props = defineProps<{ type: DocumentType }>()

const BADGES: Record<DocumentType, { cls: string; label: string }> = {
    word: { cls: 'word', label: 'W' },
    cell: { cls: 'cell', label: 'X' },
    slide: { cls: 'slide', label: 'P' },
    pdf: { cls: 'pdf', label: 'PDF' },
}

const badge = computed(() => BADGES[props.type])
</script>

<template>
    <span class="badge" :class="badge.cls">{{ badge.label }}</span>
</template>

<style scoped>
.badge {
    width: 38px;
    height: 38px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-weight: 700;
    font-size: 0.95rem;
    flex-shrink: 0;
    user-select: none;
}

.badge.word {
    background: var(--word);
}

.badge.cell {
    background: var(--cell);
}

.badge.slide {
    background: var(--slide);
}

.badge.pdf {
    background: var(--pdf);
    font-size: 0.7rem;
}
</style>
