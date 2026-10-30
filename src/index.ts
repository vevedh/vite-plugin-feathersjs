
// SSG docs: https://vitejs.dev/guide/ssr.html#pre-rendering-ssg
/*ssrLoadModule(
  url: string,
  server: ViteDevServer,
  context: SSRContext = { global },
  urlStack: string[] = [],
  fixStacktrace?: boolean
)*/
import { loadEnv } from 'vite'
import { resolve } from 'node:path'
import { getSandbox } from './dev-utils.js'

export * from './dev-utils.js' // optional

const sleep = (s: number) => new Promise((r) => setTimeout(r, (s * 1000) | 0))
const delayedError = async (e: Error) => {
  await sleep(0.1)
  console.error(e)
}

interface FeathersViteOpts {
  app?: string
  port?: number
}

export function feathers(Opts: FeathersViteOpts = {}) {
  const env = loadEnv('', process.cwd())
  const sm = {
    active: true,
    entryFile: Opts.app || 'src/app.ts',
    root: '',
    port: Opts.port || 8099,
    appListener: undefined,
    feathersApp: undefined,
    config: undefined // not used
  } as any

  sm.entryFile = resolve(sm.entryFile)
  sm.root = new globalThis.URL('.', 'file://' + sm.entryFile).pathname
  if (env.VITE_FV_SSG === 'off') {
    sm.active = false
  }

  return {
    name: 'vite-plugin-feathersjs',
    configResolved(config: any) {
      if (config.command === 'build') {
        sm.active = false
      } else {
        sm.config = config
      }
      if (
        config.server &&
        config.define?.['import.meta.env.VITE_FV_DEV_USER'] === undefined
      ) {
        config.define ||= {}
        config.define['import.meta.env.VITE_FV_DEV_USER'] =
          JSON.stringify(env.VITE_FV_DEV_USER || 'vite')
        if (getSandbox() === 'replit' && config.server?.host === undefined) {
          config.server = config.server || {}
          config.server.host = true
        }
      }
    },
    async configureServer(server: any) {
      if (sm.active === false) {
        return
      }
      return async () => {
        // ssrLoadModule MUST be called after server internal middlewares load
        try {
          sm.feathersApp = (await (
            await server.ssrLoadModule(sm.entryFile)
          ).main()) as any
          sm.appListener = await sm.feathersApp.listen(sm.port)

          

          // console.info('Feathers application started')
          server.hooks.hook("error", async (error: any, { event }: any) => {
            // send error message，or you can standardize errors in here
            console.log(error, event)
          });


          server.watcher.on('all', async (eventName: any, path: any) => {
            console.log('Change :', eventName)
            if (path === sm.entryFile) {
              await sm.handleHotUpdate({ file: path, server })
            }
          })


        } catch (e) {
          server.ssrFixStacktrace(e)
          /* console.error(e)*/
        }
      }
    },
    closeBundle() {
      if (sm.appListener) sm.appListener.close()
    },
    async handleHotUpdate({ file, server }: any) {
      // Save your sanity, we are eval'd out of context making debugging a nightmare
      try {
        if (
          !file.startsWith(sm.root) ||
          sm.active === false ||
          sm.appListener === undefined
        ) {
          return
        }
        // console.log('CLOSING')
        sm.appListener.close()
        // console.log('CLOSED')
        // ssrLoadModule def: https://github.com/vitejs/vite/blob/ed0286186b24748ec7bfa336f83c382363a22f1d/packages/vite/src/node/ssr/ssrModuleLoader.ts#L34
        sm.loadResult = undefined
        sm.loadResult = await server.ssrLoadModule(sm.entryFile)
        if (sm.loadResult === undefined) {
          // console.log('SYNTAX_ERROR in SSG server')
          return
        }
        // console.log('SSG server restarting')
        sm.feathersApp = await sm.loadResult.main()
        // console.info('Listening on port...')
        sm.appListener = await sm.feathersApp.listen(sm.port)
        // console.info('Feathers application restarted')
      } catch (e: any) {
        server.ssrFixStacktrace(e)
        delayedError(e)
      }
    }
  }
}
