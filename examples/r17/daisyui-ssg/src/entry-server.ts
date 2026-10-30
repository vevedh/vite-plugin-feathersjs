import { createSSRApp } from 'vue'
import { createPinia } from 'pinia'
import { renderToString } from 'vue/server-renderer'
import App from './App.vue'
export async function render(route: string): Promise<string> {
  const app = createSSRApp(App, { route })
  app.use(createPinia()) // fresh Pinia for every server-side render
  return await renderToString(app)
}
