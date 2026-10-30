import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { embeddedFeathers, type FeathersRuntime } from './server/vite-feathers-plugin'

export default defineConfig({
  plugins: [
    vue(),
    embeddedFeathers({
      async createRuntime(server): Promise<FeathersRuntime> {
        // Vite compiles TS server code and invalidates it when the module changes.
        const loaded: unknown = await server.ssrLoadModule('/server/runtime.ts')
        if (typeof loaded !== 'object' || loaded === null || !('createFeathersRuntime' in loaded)) {
          throw new Error('Missing Feathers runtime factory')
        }
        const factory = loaded.createFeathersRuntime
        if (typeof factory !== 'function') throw new Error('Invalid Feathers runtime factory')
        const runtime: unknown = await factory()
        if (typeof runtime !== 'object' || runtime === null || !('handle' in runtime) || !('dispose' in runtime)) {
          throw new Error('Invalid Feathers runtime contract')
        }
        if (typeof runtime.handle !== 'function' || typeof runtime.dispose !== 'function') {
          throw new Error('Invalid Feathers runtime methods')
        }
        return runtime as FeathersRuntime
      }
    })
  ],
  server: { host: '127.0.0.1', port: 5173, strictPort: true }
})
