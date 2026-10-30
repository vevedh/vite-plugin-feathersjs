import { route } from 'quasar/wrappers'
import { createMemoryHistory, createRouter, createWebHistory } from 'vue-router'
import routes from './routes'
export default route(() => createRouter({
  history: process.env.SERVER ? createMemoryHistory() : createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0, left: 0 }),
}))
