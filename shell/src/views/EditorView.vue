<script setup lang="ts">
// 编辑器页：挂载点直连 DocsAPI（编辑器 iframe 由 DocsAPI 自建注入）
import { useEventListener } from '@vueuse/core'
import { onBeforeUnmount, onMounted, useTemplateRef, watch } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import EditorBar from '../components/EditorBar.vue'
import { useEditorStore } from '../stores/editor'
import { useRecentStore } from '../stores/recent'
import { useToastStore } from '../stores/toast'

const route = useRoute()
const router = useRouter()
const editor = useEditorStore()
const recent = useRecentStore()
const toast = useToastStore()

const mountEl = useTemplateRef<HTMLDivElement>('mount')

onMounted(async () => {
    // 刷新 / 深链进入时从 IndexedDB 恢复会话
    const record = await recent.getRecord(String(route.params.id))
    if (!record) {
        toast.show('文件不存在或已被删除')
        router.replace('/')
        return
    }
    editor.open(record)
})

// 挂载点渲染后交给会话创建编辑器（bridge 依赖它放置 DocsAPI）
watch(mountEl, (el) => {
    if (el) editor.attachMount(el)
})

// 接收引擎 x2t_helper.js 的文件流消息（store 按 iframe 来源过滤）
useEventListener(window, 'message', editor.handleMessage)

// 有未保存修改时提示再离开（关闭/刷新标签页）
// 旧版 Chromium/Safari 依赖 returnValue，新版标准只需 preventDefault
useEventListener(window, 'beforeunload', (e) => {
    if (!editor.modified) return
    e.preventDefault()
    e.returnValue = true
})

// 离开 /edit 前确认未保存修改（关闭按钮 / 返回 / 编辑器自带关闭共用此守卫）
onBeforeRouteLeave(() => {
    if (!editor.confirmLeave()) return false
    editor.teardown()
    return true
})

onBeforeUnmount(() => editor.teardown())
</script>

<template>
    <div class="editor-page">
        <EditorBar />
        <div class="editor-frame-box">
            <!-- mount 是 Vue 稳定持有的外层；DocsAPI 会替换内层占位符为编辑器 iframe -->
            <div v-if="editor.active" ref="mount" class="editor-mount"></div>
        </div>
    </div>
</template>

<style scoped>
.editor-page {
    position: fixed;
    inset: 0;
    background: #fff;
    display: flex;
    flex-direction: column;
    z-index: 100;
}

.editor-frame-box {
    flex: 1;
    position: relative;
}

.editor-mount {
    position: absolute;
    inset: 0;
}
</style>
