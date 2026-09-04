<script setup lang="ts">
// 全局轻提示（原 #toast）
import { useToastStore } from '../stores/toast'

const toast = useToastStore()
</script>

<template>
    <div class="toast" :class="{ show: toast.visible }">{{ toast.message }}</div>
</template>

<style scoped>
.toast {
    position: fixed;
    left: 50%;
    bottom: 36px;
    transform: translateX(-50%);
    background: #1f2329;
    color: #fff;
    padding: 9px 20px;
    border-radius: 8px;
    font-size: 0.85rem;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.2s ease;
    z-index: 200;
}

.toast.show {
    opacity: 1;
}
</style>
