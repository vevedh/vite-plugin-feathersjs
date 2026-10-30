import type { Application } from '@feathersjs/feathers'
import type { Plugin } from 'vite'

export type FeathersApp = Application
export type FeathersModule = (app: FeathersApp) => void | Promise<void>
export interface ModuleNamespace {
  default?: FeathersModule
  register?: FeathersModule
  /** Optional in-place HMR callback. It must update only the existing service implementation; avoid registering global hooks/listeners. */
  hotUpdate?: FeathersModule
}
export interface SocketTransportOptions {
  /** Dedicated Feathers Socket.IO HTTP server port. Must differ from the Vite port. */
  port: number
  /** Explicit allowed browser origins. */
  origins: readonly string[]
  /** Socket.IO endpoint; defaults to /socket.io */
  path?: string
  /** Optional private bind address for the standalone WebSocket listener.
   * Explicitly supports only IPv4/IPv6 loopback; omitted retains the v0.2.6 behavior. */
  host?: '127.0.0.1' | '::1' 
}
export interface FeathersPluginOptions {
  serviceFiles: string | readonly string[]
  /** Optional project-relative service dependency directories; edits rebuild the runtime. */
  watchDirectories?: readonly string[]
  prefix?: string
  /** Koa is the default for Feathers v5. */
  adapter?: 'koa' | 'express'
  /** Socket.IO runs on a separate port; disabled by default. */
  socketio?: false | SocketTransportOptions
  cors?: boolean | { origin: string | readonly string[]; credentials?: boolean }
  jsonLimit?: string
  configure?: FeathersModule
  afterRegister?: FeathersModule
  debounceMs?: number
}
export type FeathersVitePlugin = Plugin
