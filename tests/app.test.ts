import { describe, expect, it, vi } from 'vitest'
import { createFeathersApp } from '../src/app.js'
import type { FeathersApp } from '../src/types.js'
describe('Feathers registration', () => {
  it('registers service modules deterministically', async () => {
    const register = vi.fn(async (app: FeathersApp) => {
      app.use('health', { async find() { return { status: 'ok' } } })
    })
    const app = await createFeathersApp(['/server/health.ts'], async () => ({ default: register }), { serviceFiles: '**/*.ts' })
    expect(register).toHaveBeenCalledTimes(1)
    expect(await app.service('health').find({})).toEqual({ status: 'ok' })
  })
  it('rejects a non-function export', async () => {
    await expect(createFeathersApp(['a'], async () => ({}), { serviceFiles: 'a' })).rejects.toThrow('registration function')
  })
})

describe.each(['koa', 'express'] as const)('%s adapter', adapter => {
  it('registers services and initializes in REST mode', async () => {
    const { createFeathersRuntime } = await import('../src/app.js')
    const runtime = await createFeathersRuntime(['hello'], async () => ({ default: app => { app.use('hello', { async find() { return { ok: true } } }) } }), { serviceFiles: 'hello', adapter })
    await runtime.start()
    expect(await runtime.app.service('hello').find({})).toEqual({ ok: true })
    await runtime.close()
  })
})
