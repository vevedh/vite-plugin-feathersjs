import { createServer as createHttpServer } from 'node:http'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { AddressInfo } from 'node:net'
import { afterEach, describe, expect, it } from 'vitest'
import { createServer as createViteServer, type ViteDevServer } from 'vite'
import { io, type Socket } from 'socket.io-client'
import feathersPlugin from '../src/index.js'

type Adapter = 'koa' | 'express'
const opened: ViteDevServer[] = []
const clients: Socket[] = []
const directories: string[] = []

afterEach(async () => {
  for (const socket of clients.splice(0)) socket.disconnect()
  for (const vite of opened.splice(0)) await vite.close()
  for (const path of directories.splice(0)) await rm(path, { recursive: true, force: true })
})

async function availablePort(): Promise<number> {
  const server = createHttpServer()
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const port = (server.address() as AddressInfo).port
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
  return port
}

async function until<T>(read: () => Promise<T>, matches: (value: T) => boolean, ms = 12000): Promise<T> {
  const deadline = Date.now() + ms
  let last: T | undefined
  while (Date.now() < deadline) {
    try {
      last = await read()
      if (matches(last)) return last
    } catch { /* The listener may not yet be bound. */ }
    await new Promise(resolve => setTimeout(resolve, 50))
  }
  throw new Error(`Lifecycle readiness deadline; observed ${String(last)}`)
}

async function checkReleased(port: number): Promise<boolean> {
  const probe = createHttpServer()
  try {
    await new Promise<void>((resolve, reject) => {
      probe.once('error', reject)
      probe.listen(port, '127.0.0.1', resolve)
    })
    return true
  } catch { return false }
  finally {
    if (probe.listening) await new Promise<void>(resolve => probe.close(() => resolve()))
  }
}

for (const adapter of ['koa', 'express'] as const satisfies readonly Adapter[]) {
  for (const realtime of [false, true] as const) {
    describe(`${adapter} Vite 7 lifecycle, Socket.IO ${realtime ? 'on' : 'off'}`, () => {
      it('starts only after Vite listens, returns 503 until ready and closes cleanly', async () => {
        const root = await mkdtemp(join(tmpdir(), 'feathers-vite-lifecycle-'))
        directories.push(root)
        await mkdir(join(root, 'server'), { recursive: true })
        await writeFile(join(root, 'index.html'), '<html><body>Vite runtime</body></html>')
        // Delay module registration on purpose, proving Vite can listen before
        // Feathers is ready and that requests never fall through to Vite HTML.
        await writeFile(join(root, 'server', 'health.service.ts'), `
          export default async function register(app) {
            await new Promise(resolve => setTimeout(resolve, 700))
            app.use('health', { async find() { return [{ status: 'ok' }] } })
          }
        `)
        const socketPort = realtime ? await availablePort() : undefined
        const vite = await createViteServer({
          configFile: false,
          root,
          logLevel: 'silent',
          optimizeDeps: { noDiscovery: true },
          server: { host: '127.0.0.1', port: 0, strictPort: true },
          plugins: [feathersPlugin({
            serviceFiles: 'server/*.service.ts',
            adapter,
            prefix: '/api',
            lifecycle: 'managed',
            socketio: socketPort === undefined ? false : {
              port: socketPort,
              host: '127.0.0.1',
              origins: ['http://127.0.0.1:5173'],
            },
          })],
        })
        opened.push(vite)
        expect(vite.httpServer?.listening).toBe(false)
        await vite.listen()
        const port = (vite.httpServer?.address() as AddressInfo | null)?.port
        expect(typeof port).toBe('number')
        const endpoint = `http://127.0.0.1:${port}/api/health`
        const early = await fetch(endpoint)
        expect(early.status).toBe(503)
        expect(early.headers.get('content-type')).toContain('application/json')
        expect(await early.json()).toEqual({ error: 'Feathers service unavailable' })
        const ready = await until(async () => {
          const response = await fetch(endpoint)
          return { status: response.status, body: await response.json() as unknown }
        }, result => result.status === 200)
        expect(ready.body).toEqual([{ status: 'ok' }])
        if (socketPort !== undefined) {
          const client = io(`http://127.0.0.1:${socketPort}`, {
            transports: ['websocket'],
            reconnection: false,
            timeout: 4000,
            extraHeaders: { origin: 'http://127.0.0.1:5173' },
          })
          clients.push(client)
          await new Promise<void>((resolve, reject) => {
            client.once('connect', resolve)
            client.once('connect_error', reject)
          })
          const result = await new Promise<unknown>((resolve, reject) => {
            client.emit('find', 'health', {}, (error: unknown, data: unknown) => error ? reject(error) : resolve(data))
          })
          expect(result).toEqual([{ status: 'ok' }])
        }
        await vite.close()
        opened.splice(opened.indexOf(vite), 1)
        if (socketPort !== undefined) {
          expect(await until(() => checkReleased(socketPort), value => value === true)).toBe(true)
        }
      }, 30000)
    })
  }
}

for (const realtime of [false, true] as const) {
  it(`supports middlewareMode without Vite HTTP listener (Socket.IO ${realtime ? 'on' : 'off'})`, async () => {
    const root = await mkdtemp(join(tmpdir(), 'feathers-vite-middleware-'))
    directories.push(root)
    await mkdir(join(root, 'server'), { recursive: true })
    await writeFile(join(root, 'server', 'health.service.ts'), `
      export default (app) => app.use('health', {
        async find() { return [{ status: 'middleware-ready' }] }
      })
    `)
    const socketPort = realtime ? await availablePort() : undefined
    const vite = await createViteServer({
      configFile: false,
      root,
      logLevel: 'silent',
      server: { middlewareMode: true },
      plugins: [feathersPlugin({
        serviceFiles: 'server/*.service.ts',
        socketio: socketPort === undefined ? false : {
          host: '127.0.0.1', port: socketPort, origins: ['http://127.0.0.1:5173'],
        },
        lifecycle: 'managed',
      })],
    })
    opened.push(vite)
    expect(vite.httpServer).toBeNull()
    const http = createHttpServer(vite.middlewares)
    try {
      await new Promise<void>((resolve, reject) => {
        http.once('error', reject)
        http.listen(0, '127.0.0.1', resolve)
      })
      const port = (http.address() as AddressInfo).port
      const endpoint = `http://127.0.0.1:${port}/api/health`
      // Unlike Vite.listen(), middlewareMode has no Vite HTTP listening signal.
      // Its post-hook starts Feathers asynchronously, so 503 is legitimate
      // while warming up, but 200 must be observed before the deadline.
      const ready = await until(async () => {
        const response = await fetch(endpoint)
        return { status: response.status, body: await response.json() as unknown }
      }, result => result.status === 200)
      expect(ready.body).toEqual([{ status: 'middleware-ready' }])
      if (socketPort !== undefined) {
        const client = io(`http://127.0.0.1:${socketPort}`, {
          transports: ['websocket'], reconnection: false, timeout: 4000,
          extraHeaders: { origin: 'http://127.0.0.1:5173' },
        })
        clients.push(client)
        await new Promise<void>((resolve, reject) => {
          client.once('connect', resolve)
          client.once('connect_error', reject)
        })
        const result = await new Promise<unknown>((resolve, reject) => {
          client.emit('find', 'health', {}, (error: unknown, data: unknown) =>
            error ? reject(error) : resolve(data))
        })
        expect(result).toEqual([{ status: 'middleware-ready' }])
        client.disconnect()
      }
      await vite.close()
      opened.splice(opened.indexOf(vite), 1)
      // The caller's HTTP host is still listening: Vite closing must stop
      // Feathers and fail closed without accidentally serving the Vite SPA.
      const after = await fetch(endpoint)
      expect(after.status).toBe(503)
      expect(await after.json()).toEqual({ error: 'Feathers service unavailable' })
      if (socketPort !== undefined) {
        expect(await until(() => checkReleased(socketPort), value => value === true)).toBe(true)
      }
    } finally {
      if (opened.includes(vite)) {
        await vite.close()
        opened.splice(opened.indexOf(vite), 1)
      }
      await new Promise<void>((resolve, reject) => http.close(error => error ? reject(error) : resolve()))
    }
  }, 30000)
}
