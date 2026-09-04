// 全局轻提示（原 office.html 内 toast 函数的响应式版本）
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useToastStore = defineStore('toast', () => {
    const message = ref('')
    const visible = ref(false)
    let timer: ReturnType<typeof setTimeout> | null = null

    function show(msg: string): void {
        message.value = msg
        visible.value = true
        if (timer) clearTimeout(timer)
        timer = setTimeout(() => {
            visible.value = false
        }, 2500)
    }

    return { message, visible, show }
})
