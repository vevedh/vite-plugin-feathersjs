import { defineConfig } from '#q-app/wrappers'

// Quasar CLI v2 (Vite): SSR owns its HTTP rendering process.
// Feathers is a separate Node runtime using createFeathersRuntime from the plugin.
export default defineConfig(() => ({
  css: ['app.css'],
  extras: [],
  boot: [],
  build: {
    target: { browser: ['es2022', 'chrome115', 'firefox115'], node: 'node22' },
    vueRouterMode: 'history',
    typescript: { strict: true, vueShim: true },
  },
  devServer: { host: '127.0.0.1', port: 9100, open: false },
  framework: { config: {}, plugins: [] },
  ssr: {
    prodPort: 9100,
    middlewares: ['render'],
    pwa: false,
    extendPackageJson(pkg) {
      // The Quasar-compiled dist/ssr/index.js imports serialize-javascript.
      // pnpm does not hoist this transitive CLI dependency into this runtime.
      pkg.dependencies ||= {}
      pkg.dependencies['serialize-javascript'] ||= '^6.0.2'
    },
  },
}))
