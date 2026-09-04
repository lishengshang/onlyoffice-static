<script setup lang="ts">
import ToastHost from './components/ToastHost.vue'
</script>

<template>
    <!-- :key 让 /edit/:id 参数变化时组件重建（手动改 URL 换文档的场景） -->
    <RouterView :key="$route.fullPath" />
    <ToastHost />
</template>
