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
  /** Historical default: the Feathers transport owns a separate listener. */
  mode?: 'dedicated'
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
/** Attach Socket.IO to a host-owned HTTP server, without opening another listener. */
export interface ExternalSocketTransportOptions {
  mode: 'external'
  origins: readonly string[]
  path?: string
  /** External mode must not specify a port or host. */
  port?: never
  host?: never
}
export interface FeathersPluginOptions {
  serviceFiles: string | readonly string[]
  /** Optional project-relative service dependency directories; edits rebuild the runtime. */
  watchDirectories?: readonly string[]
  prefix?: string
  /** Koa is the default for Feathers v5. */
  adapter?: 'koa' | 'express'
  /** Socket.IO runs on a separate port; disabled by default. */
  socketio?: false | SocketTransportOptions | ExternalSocketTransportOptions
  cors?: boolean | { origin: string | readonly string[]; credentials?: boolean }
  jsonLimit?: string
  configure?: FeathersModule
  afterRegister?: FeathersModule
  debounceMs?: number
  /** Opt-in single-flight lifecycle and teardown; omitted retains v0.2.6 HMR behavior. */
  lifecycle?: 'managed'
  /** Opt-in service-path collision detection across awaited registration phases. */
  serviceRegistration?: 'reject-duplicates'
}
export type FeathersVitePlugin = Plugin
