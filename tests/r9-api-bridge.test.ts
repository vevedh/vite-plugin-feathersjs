import { describe, expect, it } from 'vitest'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { createFeathersApiBridge, type FeathersRequestHandler } from '../src/api-bridge.js'

/**
 * Minimal writable HTTP response used only by this test.
 * Keep the stub separate from Node's ServerResponse: its members may be readonly.
 */
interface MockHttpResponse {
  statusCode: number
  headersSent: boolean
  writableEnded: boolean
  setHeader(name: string, value: string): void
  end(value?: string): void
}

function makeResponse() {
  const headers = new Map<string, string>()
  let body = ''
  const res: MockHttpResponse = {
    statusCode: 200,
    headersSent: false,
    writableEnded: false,
    setHeader(name: string, value: string) { headers.set(name.toLowerCase(), value) },
    end(value?: string) { body = value ?? ''; this.headersSent = true; this.writableEnded = true },
  }
  return { res: res as unknown as ServerResponse, headers, get body() { return body } }
}
const req = {} as IncomingMessage

describe('R9 API bridge fail-closed semantics', () => {
  it('returns JSON 503 while the runtime is unavailable instead of Vite HTML', () => {
    const response = makeResponse()
    let fallback = 0
    createFeathersApiBridge(() => undefined)(req, response.res, () => { fallback++ })
    expect(fallback).toBe(0)
    expect(response.res.statusCode).toBe(503)
    expect(response.headers.get('content-type')).toContain('application/json')
    expect(response.headers.get('retry-after')).toBe('1')
    expect(JSON.parse(response.body)).toEqual({ error: 'Feathers service unavailable' })
  })

  it('routes to the current runtime after an atomic HMR replacement', () => {
    const response = makeResponse()
    let called = 0
    let current: FeathersRequestHandler | undefined
    const dispatch = createFeathersApiBridge(() => current)
    current = (_req, res) => { called++; res.statusCode = 200; res.end('{"ok":true}') }
    dispatch(req, response.res, () => { throw new Error('SPA fallback reached') })
    expect(called).toBe(1)
    expect(response.body).toBe('{"ok":true}')
    expect(response.headers.get('x-feathers-dev-bridge')).toBe('1')
  })

  it('returns JSON 404 if the current runtime does not recognize an API route', () => {
    const response = makeResponse()
    let fallback = 0
    createFeathersApiBridge(() => (_req, _res, next) => next())(req, response.res, () => { fallback++ })
    expect(fallback).toBe(0)
    expect(response.res.statusCode).toBe(404)
    expect(JSON.parse(response.body)).toEqual({ error: 'API endpoint not found' })
  })

  it('returns JSON 500 without leaking exception details', () => {
    const response = makeResponse()
    createFeathersApiBridge(() => () => { throw new Error('private diagnostic') })(req, response.res, () => {})
    expect(response.res.statusCode).toBe(500)
    expect(response.body).not.toContain('private diagnostic')
    expect(response.body).toContain('Feathers request failed')
  })
})
