import type { RouteRecordRaw } from 'vue-router'
const routes: RouteRecordRaw[] = [
  { path: '/', component: () => import('../pages/IndexPage.vue') },
  { path: '/:catchAll(.*)*', component: () => import('../pages/NotFoundPage.vue') },
]
export default routes
