import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin, ViteDevServer } from 'vite'

export type Next = (error?: Error) => void

export interface FeathersRuntime {
  handle(request: IncomingMessage, response: ServerResponse, next: Next): void | Promise<void>
  dispose(): Promise<void>
}

export interface EmbeddedFeathersOptions {
  createRuntime(server: ViteDevServer): Promise<FeathersRuntime>
}

/** Mount a Feathers REST runtime in Vite's Connect stack (development only). */
export function embeddedFeathers(options: EmbeddedFeathersOptions): Plugin {
  let active: FeathersRuntime | undefined

  return {
    name: 'r17:feathers-embedded-reference',
    apply: 'serve',
    async configureServer(server) {
      if (active) throw new Error('Feathers runtime already initialized')
      active = await options.createRuntime(server)
      server.middlewares.use('/api', (request, response, next) => {
        const runtime = active
        if (!runtime) {
          next(new Error('Feathers runtime not available'))
          return
        }
        try {
          void Promise.resolve(runtime.handle(request, response, next)).catch((error: unknown) => {
            next(error instanceof Error ? error : new Error('Feathers request failed'))
          })
        } catch (error: unknown) {
          next(error instanceof Error ? error : new Error('Feathers request failed'))
        }
      })
    },
    async closeServer() {
      const runtime = active
      active = undefined
      if (runtime) await runtime.dispose()
    }
  }
}
