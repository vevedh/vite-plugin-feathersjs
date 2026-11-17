import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
export default defineConfig({
  plugins: [vue(), tailwindcss()],
  server: { host: '127.0.0.1', port: 5173, strictPort: true,
    proxy: { '/api': 'http://127.0.0.1:3030', '/socket.io': { target: 'ws://127.0.0.1:3031', ws: true } } },
})
