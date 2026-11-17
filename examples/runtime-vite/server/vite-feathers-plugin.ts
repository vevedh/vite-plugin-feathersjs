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
  let disposing: Promise<void> | undefined

  const stop = async (): Promise<void> => {
    if (disposing) {
      await disposing
      return
    }
    const runtime = active
    active = undefined
    if (!runtime) return
    const pending = Promise.resolve().then(() => runtime.dispose())
    disposing = pending
    try {
      await pending
    } finally {
      disposing = undefined
    }
  }

  return {
    name: 'r17:feathers-embedded-reference',
    apply: 'serve',
    async configureServer(server) {
      if (active) throw new Error('Feathers runtime already initialized')
      active = await options.createRuntime(server)
      // Handle Vite's HTTP listener shutdown without leaving a Feathers runtime active.
      server.httpServer?.once('close', () => {
        void stop().catch(() => {
          server.config.logger.error('Feathers runtime cleanup failed')
        })
      })
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
    async closeBundle() {
      await stop()
    }
  }
}
