import { traceStartup } from './performance.js'
import { createServer, type Server } from 'node:http'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { feathers } from '@feathersjs/feathers'
import { NotFound } from '@feathersjs/errors'
import expressModule, { json, urlencoded, rest, errorHandler } from '@feathersjs/express'
import type { NextFunction, Request, Response } from 'express'
import { koa, rest as koaRest, bodyParser, errorHandler as koaErrorHandler } from '@feathersjs/koa'
import socketio from '@feathersjs/socketio'
import type { FeathersPluginOptions, FeathersApp, ModuleNamespace } from './types.js'

export type LoadModule = (absolutePath: string) => Promise<ModuleNamespace>
export interface FeathersRuntime {
  app: FeathersApp
  handler: (req: IncomingMessage, res: ServerResponse, next: (error?: unknown) => void) => void
  start(): Promise<void>
  close(): Promise<void>
}

export async function createFeathersRuntime(paths: readonly string[], load: LoadModule, options: FeathersPluginOptions): Promise<FeathersRuntime> {
  traceStartup('feathers.app.create.start')
  const selected = options.adapter ?? 'koa'
  const limit = options.jsonLimit ?? '100kb'
  // Feathers Express v5 is CommonJS-compatible; NodeNext may type its default as a module namespace.
  // Only its documented callable factory is adapted here, with an explicit HTTP contract.
  type ExpressWeb = FeathersApp & {
    (req: IncomingMessage, res: ServerResponse, next: (error?: unknown) => void): void
    disable(setting: string): void
    use(...middleware: unknown[]): void
  }
  const createExpress = expressModule as unknown as (app: FeathersApp) => ExpressWeb
  let handler: FeathersRuntime['handler']
  let app: FeathersApp
  if (selected === 'express') {
    const web = createExpress(feathers())
    web.disable('x-powered-by')
    if (options.cors) {
      const cors = await import('cors')
      web.use(cors.default(options.cors === true ? { origin: true } : { origin: typeof options.cors.origin === 'string' ? options.cors.origin : [...options.cors.origin], credentials: options.cors.credentials ?? false }))
    }
    web.use(json({ limit }))
    web.use(urlencoded({ extended: false, limit }))
    web.use((_req: Request, res: Response, next: NextFunction) => { res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Content-Type-Options', 'nosniff'); next() })
    // Feathers REST configurator is typed for its complete Express Application.
    // Our callable bridge preserves the runtime contract but narrows its type;
    // adapt only this configurator instead of relaxing strict typing globally.
    web.configure(rest() as unknown as Parameters<typeof web.configure>[0])
    handler = (req, res, next) => { web(req, res, next) }
    app = web
  } else {
    const web = koa(feathers())
    web.use(koaErrorHandler())
    if (options.cors) {
      const { default: cors } = await import('@koa/cors')
      const origin = options.cors === true ? '*' : options.cors.origin
      if (Array.isArray(origin)) {
        web.use(cors({ origin: (ctx) => origin.includes(ctx.get('Origin')) ? ctx.get('Origin') : '', credentials: options.cors !== true && (options.cors.credentials ?? false) }))
      } else {
        web.use(cors({ origin: origin as string, credentials: options.cors !== true && (options.cors.credentials ?? false) }))
      }
    }
    web.use(async (ctx, next) => { ctx.set('Cache-Control', 'no-store'); ctx.set('X-Content-Type-Options', 'nosniff'); await next() })
    web.use(bodyParser({ jsonLimit: limit }))
    web.configure(koaRest())
    const callback = web.callback()
    handler = (req, res, next) => { void Promise.resolve(callback(req, res)).catch(next) }
    app = web
  }
  // Channel publishers are injected by the Socket.IO transport configuration.
  // Configure it BEFORE loading service modules that invoke service.publish().
  if (options.socketio) {
    const socketOptions = options.socketio
    app.configure(socketio({ path: socketOptions.path ?? '/socket.io', cors: { origin: [...socketOptions.origins], methods: ['GET', 'POST'] } }))
    // No global public broadcast. Users must explicitly configure authenticated channels.
  }
  traceStartup('feathers.adapter.configured', { adapter: selected, socket: Boolean(options.socketio) })
  await options.configure?.(app)
  traceStartup('feathers.modules.load.start', { count: paths.length })
  for (const file of paths) {
    const module = await load(file)
    const register = module.default ?? module.register
    if (typeof register !== 'function') throw new TypeError(`Service module must export a registration function: ${file}`)
    await register(app)
  }
  traceStartup('feathers.modules.load.end')
  await options.afterRegister?.(app)
  if (selected === 'express') {
    const web = app as ExpressWeb
    web.use((_req: Request, _res: Response, next: NextFunction) => next(new NotFound('API endpoint not found')))
    web.use(errorHandler({ logger: false }))
  } else {
    const web = app as ReturnType<typeof koa>
    web.use(async () => { throw new NotFound('API endpoint not found') })
  }
  let boundSocketServer: Server | undefined
  return {
    app,
    handler,
    async start() {
      // Keep a locally narrowed transport value across async callbacks.
      // `options.socketio` is a mutable option and its declared type also permits false.
      const socketOptions = options.socketio
      if (socketOptions) {
        traceStartup('socketio.listen.start')
        if (socketOptions.host) {
          // A dedicated loopback server is required: Feathers app.listen(port)
          // does not expose a portable explicit-host contract in v5.
          // Socket.IO attaches via app.setup(server); HTTP REST remains on the
          // independent (already loopback-bound) API server in the Quasar demo.
          if (!['127.0.0.1', '::1'].includes(socketOptions.host)) {
            throw new TypeError('Socket.IO bind host must be loopback')
          }
          const server = createServer((_req, res) => {
            res.writeHead(404, { 'content-type': 'text/plain' })
            res.end('Not found')
          })
          try {
            await new Promise<void>((resolve, reject) => {
              const onError = (error: Error) => reject(error)
              server.once('error', onError)
              server.listen(socketOptions.port, socketOptions.host, () => {
                server.off('error', onError)
                resolve()
              })
            })
            await app.setup(server)
            boundSocketServer = server
          } catch (error) {
            if (server.listening) await new Promise<void>(resolve => server.close(() => resolve()))
            throw error
          }
        } else {
          // Backwards-compatible v0.2.6 Vitesse runtime path.
          await (app as FeathersApp & { listen(port: number): Promise<unknown> }).listen(socketOptions.port)
        }
        traceStartup('socketio.listen.ready')
      } else {
        await app.setup()
      }
    },
    async close() {
      await app.teardown(boundSocketServer)
      if (boundSocketServer?.listening) {
        await new Promise<void>((resolve, reject) => {
          boundSocketServer!.close(error => error ? reject(error) : resolve())
        })
      }
      boundSocketServer = undefined
    },
  }
}

/** Backwards-compatible convenience for tests and service registration. */
export async function createFeathersApp(paths: readonly string[], load: LoadModule, options: FeathersPluginOptions): Promise<FeathersApp> {
  return (await createFeathersRuntime(paths, load, options)).app
}
