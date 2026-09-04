import { createRouter, createWebHistory } from 'vue-router'

// history 路由：/ 主页，/edit/:id 编辑器（刷新可从 IndexedDB 恢复会话），
// /embed 对外集成入口（postMessage 协议，替代原 onlyoffice.html）
// SPA 回退由 CF Pages _redirects 的 /edit/*、/embed/* 200 rewrite 兜底
const router = createRouter({
    history: createWebHistory(),
    routes: [
        { path: '/', name: 'home', component: () => import('../views/HomeView.vue') },
        { path: '/edit/:id', name: 'editor', component: () => import('../views/EditorView.vue') },
        { path: '/embed', name: 'embed', component: () => import('../views/EmbedView.vue') },
        { path: '/:pathMatch(.*)*', redirect: { name: 'home' } },
    ],
})

export default router
