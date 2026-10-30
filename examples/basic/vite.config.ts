import path from 'node:path'
import { createLocalViteMcpPlugin } from './scripts/vite-mcp-loader.mjs'
import { htmlPreloadPlugin } from './scripts/html-preload.mjs'
import VueI18n from '@intlify/unplugin-vue-i18n/vite'
import { unheadVueComposablesImports } from '@unhead/vue'
import Vue from '@vitejs/plugin-vue'
import LinkAttributes from 'markdown-it-link-attributes'
import Unocss from 'unocss/vite'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import Markdown from 'unplugin-vue-markdown/vite'
import { defineConfig, loadEnv } from 'vite'
import type { UserConfig } from 'vite'
import feathers from 'vite-plugin-feathersjs'
import Layouts from 'vite-plugin-vue-layouts'
import generateSitemap from 'vite-ssg-sitemap'
import VueMacros from 'vue-macros/vite'
import { VueRouterAutoImports } from 'vue-router/unplugin'
import VueRouter from 'vue-router/vite'
import 'vitest/config'

const adapter = process.env.FEATHERS_ADAPTER === 'express' ? 'express' : 'koa'
const socketEnabled = process.env.FEATHERS_SOCKETIO !== '0'
const socketPort = Number(process.env.FEATHERS_SOCKET_PORT ?? '3031')
// Opt-in for transport-only CI benchmarks. The normal Vitesse dev command stays unchanged.
const transportOnlyProfile = process.env.FEATHERS_TRANSPORT_PROFILE === '1'

// Vite 7: contextually type the async return so literal options such as
// ssgOptions.script and plugin arrays do not widen beyond UserConfig.
export default defineConfig(async ({ mode }): Promise<UserConfig> => {
  // Explicit .env support: Vite does not load .env before evaluating vite.config.ts.
  const env = loadEnv(mode, import.meta.dirname, ['FEATHERS_', 'VITE_HTML_PRELOAD'])
  const fastDev = env.FEATHERS_FAST_DEV === '1'
  const devWarmup = env.FEATHERS_DEV_WARMUP === '1'
  // Avoid evaluating costly optional plugins for fast or transport-only development.
  // Default remains unchanged, and all enabled optional imports run in parallel.
  const extras = !fastDev && !transportOnlyProfile
  const [Shiki, VitePWA, VueDevTools] = await Promise.all([
    fastDev ? Promise.resolve(null) : import('@shikijs/markdown-exit').then(module => module.default),
    extras ? import('vite-plugin-pwa').then(module => module.VitePWA) : Promise.resolve(null),
    extras ? import('vite-plugin-vue-devtools').then(module => module.default) : Promise.resolve(null),
  ])
  return {
  define: {
    __FEATHERS_ADAPTER__: JSON.stringify(adapter),
    // Prevent eager Vue module imports from referencing a missing PWA virtual module.
    __FEATHERS_PWA_ENABLED__: JSON.stringify(Boolean(VitePWA)),
    __FEATHERS_SOCKET_ENABLED__: JSON.stringify(socketEnabled),
    __FEATHERS_SOCKET_PORT__: JSON.stringify(socketPort),
  },
  server: {
    ...(process.env.FEATHERS_VITE_MCP === '1' ? { host: 'localhost', port: 3333, strictPort: true } : {}),
    // Optional client-transform warmup; may increase server readiness time.
    ...(devWarmup ? { warmup: { clientFiles: ['./src/main.ts', './src/pages/feathers.vue'] } } : {}),
  },
  resolve: {
    alias: {
      '~/': `${path.resolve(import.meta.dirname, 'src')}/`,
      // Vite still resolves dynamic import specifiers in disabled code paths.
      // Map the PWA virtual entry to a local stub whenever the plugin is absent.
      ...(!VitePWA ? { 'virtual:pwa-register': path.resolve(import.meta.dirname, 'src/lib/pwa-register-disabled.ts') } : {}),
    },
  },

  plugins: [
    htmlPreloadPlugin(env, import.meta.dirname),
    ...(await createLocalViteMcpPlugin()),
    // REST at /api on Vite's port; Socket.IO at 3031.
    feathers({
      serviceFiles: 'server/services/*/*.service.ts',
      watchDirectories: ['server/services', 'shared/feathers'],
      adapter,
      prefix: '/api',
      cors: false,
      socketio: socketEnabled ? {
        port: socketPort,
        origins: [process.env.FEATHERS_TEST_ORIGIN ?? 'http://localhost:3333'],
      } : false,
      debounceMs: 40,
    }),
    // https://github.com/vuejs/router
    VueRouter({
      extensions: ['.vue', '.md'],
      dts: 'src/route-map.d.ts',
    }),

    VueMacros({
      plugins: {
        vue: Vue({
          include: [/\.vue$/, /\.md$/],
        }),
      },
    }),

    // https://github.com/JohnCampionJr/vite-plugin-vue-layouts
    Layouts(),

    // https://github.com/antfu/unplugin-auto-import
    AutoImport({
      include: [/\.[jt]sx?$/, /\.vue$/, /\.vue\?vue/, /\.md$/],
      imports: [
        'vue',
        'vue-i18n',
        '@vueuse/core',
        unheadVueComposablesImports,
        VueRouterAutoImports,
        {
          // add any other imports you were relying on
          'vue-router/auto': ['useLink'],
        },
      ],
      dts: 'src/auto-imports.d.ts',
      dirs: [
        'src/composables',
        'src/stores',
      ],
      vueTemplate: true,
    }),

    // https://github.com/antfu/unplugin-vue-components
    Components({
      // allow auto load markdown components under `./src/components/`
      extensions: ['vue', 'md'],
      // allow auto import and register components used in markdown
      include: [/\.vue$/, /\.vue\?vue/, /\.md$/],
      dts: 'src/components.d.ts',
    }),

    // https://github.com/antfu/unocss
    // see uno.config.ts for config
    Unocss(),

    // https://github.com/unplugin/unplugin-vue-markdown
    // Don't need this? Try vitesse-lite: https://github.com/antfu/vitesse-lite
    Markdown({
      wrapperClasses: 'prose prose-sm m-auto text-left',
      headEnabled: true,
      markdownSetup(md) {
        // markdown-exit supports markdown-it plugins at runtime.
        md.use(LinkAttributes as unknown as Parameters<typeof md.use>[0], {
          matcher: (link: string) => /^https?:\/\//.test(link),
          attrs: {
            target: '_blank',
            rel: 'noopener',
          },
        })
        if (Shiki) md.use(Shiki({
          defaultColor: false,
          themes: {
            light: 'vitesse-light',
            dark: 'vitesse-dark',
          },
        }))
      },
    }),

    // https://github.com/antfu/vite-plugin-pwa
    ...(VitePWA ? [VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'safari-pinned-tab.svg'],
      manifest: {
        name: 'Vitesse',
        short_name: 'Vitesse',
        theme_color: '#ffffff',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
    })] : []),

    // https://github.com/intlify/bundle-tools/tree/main/packages/unplugin-vue-i18n
    VueI18n({
      runtimeOnly: true,
      compositionOnly: true,
      fullInstall: true,
      include: [path.resolve(import.meta.dirname, 'locales/**')],
    }),

    // https://github.com/webfansplz/vite-plugin-vue-devtools
    ...(VueDevTools ? [VueDevTools()] : []),
  ],

  // https://github.com/vitest-dev/vitest
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'jsdom',
  },

  // https://github.com/antfu/vite-ssg
  ssgOptions: {
    script: 'async',
    formatting: 'minify',
    beastiesOptions: {
      reduceInlineStyles: false,
    },
    onFinished() {
      generateSitemap()
    },
  },

  ssr: {
    // TODO: workaround until they support native ESM
    noExternal: ['workbox-window', /vue-i18n/],
  },
  } satisfies UserConfig
})
