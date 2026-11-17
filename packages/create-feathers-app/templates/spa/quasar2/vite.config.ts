import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { quasar } from '@quasar/vite-plugin'
export default defineConfig({
  plugins: [vue(), quasar()],
  server: { host: '127.0.0.1', port: 5173, strictPort: true,
    proxy: { '/api': 'http://127.0.0.1:3030', '/socket.io': { target: 'ws://127.0.0.1:3031', ws: true } } },
})
