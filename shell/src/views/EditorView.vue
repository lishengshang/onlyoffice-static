<script setup lang="ts">
// 编辑器页：全屏 iframe 内嵌 onlyoffice.html，通过 postMessage 协议交互
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

const frameEl = useTemplateRef<HTMLIFrameElement>('frame')

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

// iframe 渲染出来后把引用交给会话（bridge 依赖它 postMessage）
watch(frameEl, (el) => {
    if (el) editor.attachFrame(el)
})

// 接收 onlyoffice.html 的协议消息
useEventListener(window, 'message', editor.handleMessage)

// 有未保存修改时提示再离开（关闭/刷新标签页）
useEventListener(window, 'beforeunload', (e) => {
    if (editor.modified) e.preventDefault()
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
            <iframe
                v-if="editor.active"
                ref="frame"
                src="/onlyoffice.html"
                title="OnlyOffice 编辑器"
            ></iframe>
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

.editor-frame-box iframe {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    border: 0;
}
</style>
