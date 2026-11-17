import type { FeathersPluginOptions } from './types.js'
export function validateOptions(options: FeathersPluginOptions): Required<Pick<FeathersPluginOptions, 'prefix' | 'jsonLimit' | 'debounceMs' | 'adapter'>> {
  if (!options || !options.serviceFiles || (Array.isArray(options.serviceFiles) && options.serviceFiles.length === 0)) {
    throw new TypeError('vite-plugin-feathersjs: serviceFiles must not be empty')
  }
  if (options.watchDirectories !== undefined && (!Array.isArray(options.watchDirectories) || options.watchDirectories.some(dir =>
    typeof dir !== 'string' || !/^[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*$/.test(dir))))
    throw new TypeError('vite-plugin-feathersjs: invalid watchDirectories')
  const prefix = options.prefix ?? '/api'
  if (!/^\/[a-zA-Z0-9/_-]*$/.test(prefix) || prefix === '/' || prefix.includes('//') || prefix.endsWith('/')) {
    throw new TypeError('vite-plugin-feathersjs: invalid API prefix')
  }
  const jsonLimit = options.jsonLimit ?? '100kb'
  if (!/^\d+(?:b|kb|mb)$/i.test(jsonLimit)) throw new TypeError('vite-plugin-feathersjs: invalid jsonLimit')
  const debounceMs = options.debounceMs ?? 40
  if (!Number.isInteger(debounceMs) || debounceMs < 0 || debounceMs > 5000) throw new TypeError('vite-plugin-feathersjs: invalid debounceMs')
  if (options.serviceRegistration !== undefined && options.serviceRegistration !== 'reject-duplicates') throw new TypeError('vite-plugin-feathersjs: invalid serviceRegistration policy')
  if (options.lifecycle !== undefined && options.lifecycle !== 'managed') throw new TypeError('vite-plugin-feathersjs: invalid lifecycle mode')
  const adapter = options.adapter ?? 'koa'
  if (adapter !== 'koa' && adapter !== 'express') throw new TypeError('vite-plugin-feathersjs: invalid adapter')
  if (options.socketio) {
    const socketOptions = options.socketio
    const { origins, path } = socketOptions
    if (socketOptions.mode === 'external') {
      if ('port' in socketOptions || 'host' in socketOptions) throw new TypeError('vite-plugin-feathersjs: external Socket.IO forbids port and host')
    } else {
      const { port, host } = socketOptions
      if (socketOptions.mode !== undefined && socketOptions.mode !== 'dedicated') throw new TypeError('vite-plugin-feathersjs: invalid Socket.IO mode')
      if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new TypeError('vite-plugin-feathersjs: invalid Socket.IO port')
      if (host !== undefined && host !== '127.0.0.1' && host !== '::1') throw new TypeError('vite-plugin-feathersjs: Socket.IO bind host must be loopback')
    }
    if (!Array.isArray(origins) || origins.length === 0 || origins.some(v => typeof v !== 'string' || !/^https?:\/\/[^/]+$/.test(v))) throw new TypeError('vite-plugin-feathersjs: Socket.IO origins must be explicit origins')
    if (path !== undefined && (!/^\/[a-zA-Z0-9/_-]+$/.test(path) || path.includes('//') || path.endsWith('/'))) throw new TypeError('vite-plugin-feathersjs: invalid Socket.IO path')
  }
  return { prefix, jsonLimit, debounceMs, adapter }
}
