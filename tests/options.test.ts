import { describe, expect, it } from 'vitest'
import { validateOptions } from '../src/options.js'
describe('configuration security', () => {
  it('applies safe defaults', () => expect(validateOptions({ serviceFiles: 'server/**/*.ts' }).prefix).toBe('/api'))
  it.each(['/', 'api', '/api/', '/api//v1', '/api?x=1'])('rejects unsafe URL prefix %s', prefix => {
    expect(() => validateOptions({ serviceFiles: 'server/**/*.ts', prefix })).toThrow()
  })
  it('rejects malformed JSON limits', () => expect(() => validateOptions({ serviceFiles: 'x', jsonLimit: 'Infinity' })).toThrow())
  it('accepts local service dependencies and rejects traversal', () => {
    expect(validateOptions({ serviceFiles: 'server/services/*/*.service.ts', watchDirectories: ['server/services', 'shared/feathers'] }).adapter).toBe('koa')
    for (const watched of [['../outside'], ['/etc'], ['server\\services'], ['server//services'], ['']]) {
      expect(() => validateOptions({ serviceFiles: 'server/*.ts', watchDirectories: watched })).toThrow()
    }
  })
  it('rejects empty globs', () => expect(() => validateOptions({ serviceFiles: [] })).toThrow())
})

import type { FeathersPluginOptions, SocketTransportOptions } from '../src/types.js'
describe('transport configuration', () => {
  it('defaults to koa', () => expect(validateOptions({ serviceFiles: 'server/*.ts' }).adapter).toBe('koa'))
  it('accepts express', () => expect(validateOptions({ serviceFiles: 'server/*.ts', adapter: 'express' }).adapter).toBe('express'))
  it('supports opt-in loopback Socket.IO binding only', () => {
    // The socket options are a concrete object, never the false | options union.
    // This keeps required port/origins required under exactOptionalPropertyTypes.
    const socketOptions: SocketTransportOptions = { port: 3031, origins: ['http://127.0.0.1:8080'], host: '127.0.0.1' }
    const base: FeathersPluginOptions = { serviceFiles: 'server/*.ts', socketio: socketOptions }
    expect(validateOptions(base).adapter).toBe('koa')
    expect(validateOptions({ ...base, socketio: { ...socketOptions, host: '::1' } }).adapter).toBe('koa')
    for (const host of ['0.0.0.0', 'localhost', 'example.com', '', '::'] as const) {
      // Deliberately provide an invalid runtime value to test fail-closed validation.
      // NonNullable is essential: an explicitly provided host cannot be undefined
      // under exactOptionalPropertyTypes, even when the interface property is optional.
      expect(() => validateOptions({ ...base, socketio: { ...socketOptions, host: host as unknown as NonNullable<SocketTransportOptions['host']> } })).toThrow()
    }
  })
  it('rejects wildcard Socket.IO origins', () => {
    const opts: FeathersPluginOptions = { serviceFiles: 'server/*.ts', socketio: { port: 3031, origins: ['*'] } }
    expect(() => validateOptions(opts)).toThrow()
  })
})
