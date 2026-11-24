import { traceStartup } from './performance.js'
import { duplicateServiceChange, snapshotServiceFingerprints } from './hmr-fingerprints.js'
import { resolve, relative, isAbsolute, sep } from 'node:path'
import { glob } from 'tinyglobby'
import type { Plugin, ViteDevServer } from 'vite'
import { createFeathersRuntime, createManagedFeathersRuntime, type FeathersRuntime } from './app.js'
import { validateOptions } from './options.js'
import { createFeathersApiBridge } from './api-bridge.js'
import { canHotUpdate, sameFileSet, shouldInspectFileEvent, isWatchedServiceDependency } from './hmr-utils.js'
import type { FeathersPluginOptions, ModuleNamespace } from './types.js'

export type { FeathersPluginOptions, FeathersApp, FeathersModule, SocketTransportOptions, ExternalSocketTransportOptions } from './types.js'
export { createFeathersApp, createFeathersRuntime, createManagedFeathersRuntime } from './app.js'
export { manageFeathersRuntime } from './managed-runtime.js'
export { createServiceRegistrationGuard } from './service-registration.js'
export type { ServiceRegistrationGuard, ServiceRegistrationRecord, ServiceRegistrationPhase } from './service-registration.js'
export { createFeathersLifecycle } from './runtime-lifecycle.js'
export type { FeathersLifecycle, FeathersLifecycleSnapshot, FeathersLifecycleState } from './runtime-lifecycle.js'
export { validateOptions } from './options.js'

export default function feathersPlugin(options: FeathersPluginOptions): Plugin {
  const config = validateOptions(options)
  if (options.socketio && options.socketio.mode === 'external') {
    throw new TypeError('External Socket.IO requires a host-owned HTTP server; call createFeathersRuntime() directly')
  }
  let root = process.cwd()
  let watchedDirectories: string[] = []
  let current: FeathersRuntime | undefined
  let tracked = new Set<string>()
  let publishedFingerprints = new Map<string, string>()
  let timer: ReturnType<typeof setTimeout> | undefined
  let pending: Promise<void> = Promise.resolve()
  let disposed = false
  let initialized = false
  let forceQueued = false
  let changedQueued = new Set<string>()
  let serviceEditsQueued = new Set<string>()
  let serviceEditsOnlyQueued = true
  let onlyChangesQueued = true
  let unwatch: (() => void) | undefined
  let attachedServer: ViteDevServer | undefined
  let closeTask: Promise<void> | undefined
  const files = async (): Promise<string[]> => {
    const patterns = typeof options.serviceFiles === 'string' ? [options.serviceFiles] : [...options.serviceFiles]
    const found = await glob(patterns, { cwd: root, absolute: true, onlyFiles: true, followSymbolicLinks: false, expandDirectories: false })
    const inside = found.map(path => resolve(path)).filter(path => { const rel = relative(root, path); return rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel) })
    return [...new Set(inside)].sort()
  }
  const rebuild = (load: (path: string) => Promise<ModuleNamespace>, logger: { info(s: string): void; error(s: string): void }, force = false, changed: readonly string[] = [], onlyChanges = false, serviceEdits: readonly string[] = [], serviceEditsOnly = false) => {
    pending = pending.catch(() => {}).then(async () => {
      if (disposed) return
      let candidate: FeathersRuntime | undefined
      try {
        traceStartup('feathers.discovery.start')
        const nextFiles = await files()
        traceStartup('feathers.discovery.end', { count: nextFiles.length })
        if (initialized && !force && sameFileSet(tracked, nextFiles)) return
        // Read service bytes before loading; a duplicate watcher event must not
        // close an already published Socket.IO runtime.
        const observed = await snapshotServiceFingerprints(nextFiles)
        if (initialized && current && serviceEditsOnly && sameFileSet(tracked, nextFiles)
          && duplicateServiceChange(publishedFingerprints, observed, serviceEdits)) return
        // Explicitly opt-in hot updates keep Socket.IO connections and channels intact.
        // This is only safe for existing modules, with a stable file inventory.
        if (onlyChanges && current && options.socketio && sameFileSet(tracked, nextFiles) && changed.length > 0) {
          const modules = await Promise.all(changed.map(async file => ({ file, namespace: await load(file) })))
          if (modules.every(({ namespace }) => typeof namespace.hotUpdate === 'function')) {
            for (const { namespace } of modules) await namespace.hotUpdate!(current.app)
            publishedFingerprints = observed
            logger.info(`[vite-plugin-feathersjs] in-place hot update: ${modules.length} module(s); Socket.IO preserved`)
            return
          }
        }
        traceStartup('feathers.runtime.create.start')
        candidate = await (options.lifecycle === 'managed' ? createManagedFeathersRuntime : createFeathersRuntime)(nextFiles, load, options)
        traceStartup('feathers.runtime.create.end')
        // Socket.IO holds a port. Stop the prior runtime before starting the replacement.
        // REST mode starts replacement first, preserving the previous live runtime on failures.
        if (options.socketio && current) {
          const previous = current
          current = undefined
          await previous.close()
        }
        traceStartup('feathers.transport.start')
        await candidate.start()
        traceStartup('feathers.transport.ready')
        if (disposed) { await candidate.close(); return }
        const previous = current
        current = candidate
        tracked = new Set(nextFiles)
        publishedFingerprints = observed
        initialized = true
        if (previous) await previous.close()
        logger.info(`[vite-plugin-feathersjs] ${config.adapter} ready: ${nextFiles.length} module(s), ${config.prefix}${options.socketio ? `; Socket.IO port ${options.socketio.port}` : ''}`)
      } catch (error) {
        if (candidate) await candidate.close().catch(() => {})
        logger.error(`[vite-plugin-feathersjs] reload failed: ${String(error)}`)
      }
    })
    return pending
  }
  const attach = (server: ViteDevServer) => {
    traceStartup('vite.configureServer.enter')
    disposed = false
    closeTask = undefined
    attachedServer = server
    const load = (file: string) => server.ssrLoadModule(file) as Promise<ModuleNamespace>
    const onFile = (event: string, changed: string) => {
      const absolute = resolve(changed)
      const dependency = isWatchedServiceDependency(absolute, watchedDirectories)
      if (!dependency && !shouldInspectFileEvent(event, absolute, tracked)) return
      // Existing modules always reload on change. Added/deleted files first
      // compare the discovered file set to avoid rebuilding for unrelated files.
      forceQueued ||= (dependency && ['change', 'add', 'unlink'].includes(event)) || (event === 'change' && tracked.has(absolute))
      onlyChangesQueued &&= event === 'change' && !dependency
      if (event === 'change' && tracked.has(absolute)) serviceEditsQueued.add(absolute)
      else serviceEditsOnlyQueued = false
      if (canHotUpdate(event, absolute, tracked, Boolean(options.socketio))) changedQueued.add(absolute)
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        timer = undefined
        const force = forceQueued
        forceQueued = false
        const changed = [...changedQueued]
        changedQueued = new Set<string>()
        const onlyChanges = onlyChangesQueued
        onlyChangesQueued = true
        const serviceEdits = [...serviceEditsQueued]
        const serviceEditsOnly = serviceEditsOnlyQueued && serviceEdits.length > 0
        serviceEditsQueued = new Set<string>()
        serviceEditsOnlyQueued = true
        void rebuild(load, server.config.logger, force, changed, onlyChanges, serviceEdits, serviceEditsOnly)
      }, config.debounceMs)
    }
    server.middlewares.use(config.prefix, createFeathersApiBridge(() => disposed ? undefined : current?.handler))
    const onListening = () => {
      if (disposed) return
      traceStartup('vite.http.listening')
      // Start Feathers only once Vite owns its listening HTTP socket. The
      // queued rebuild still serializes startup and subsequent service HMR.
      void rebuild(load, server.config.logger)
    }
    const onClosed = () => {
      void dispose().catch(error => server.config.logger.error(`[vite-plugin-feathersjs] shutdown failed: ${String(error)}`))
    }
    server.httpServer?.once('listening', onListening)
    server.httpServer?.once('close', onClosed)
    // Service modules may live outside Vite's default client source graph.
    // An event filter is not sufficient: Chokidar must watch these directories.
    if (watchedDirectories.length > 0) server.watcher.add(watchedDirectories)
    server.watcher.on('all', onFile)
    unwatch = () => {
      server.watcher.off('all', onFile)
      server.httpServer?.off('listening', onListening)
      server.httpServer?.off('close', onClosed)
    }
    return () => {
      traceStartup('vite.postMiddleware.enter')
      // Vite does not await async post-configureServer callbacks. In middleware
      // mode a hosting app owns HTTP listen(), so start after middleware setup
      // and expose 503 until the Feathers runtime is actually ready.
      if (!server.httpServer || server.httpServer.listening)
        void rebuild(load, server.config.logger)
      traceStartup('vite.postMiddleware.exit')
    }
  }
  const dispose = (): Promise<void> => {
    if (closeTask) return closeTask
    disposed = true
    if (timer) clearTimeout(timer)
    timer = undefined
    unwatch?.()
    unwatch = undefined
    closeTask = (async () => {
      await pending.catch(() => {})
      tracked.clear()
      publishedFingerprints.clear()
      initialized = false
      forceQueued = false
      changedQueued.clear()
      serviceEditsQueued.clear()
      serviceEditsOnlyQueued = true
      onlyChangesQueued = true
      const old = current
      current = undefined
      if (old) await old.close()
    })()
    return closeTask
  }
  return {
    name: 'vite-plugin-feathersjs',
    apply: 'serve',
    enforce: 'pre',
    configResolved(configured) {
      root = resolve(configured.root)
      watchedDirectories = (options.watchDirectories ?? []).map(dir => resolve(root, dir))
      traceStartup('vite.config.resolved')
    },
    async configureServer(server) {
      // Vite can recreate its dev server after a config change. Never leave
      // the previous Feathers listener or watcher attached to the old server.
      if (attachedServer && attachedServer !== server) await dispose()
      return attach(server)
    },
    async closeBundle() {
      // Vite 7 executes this Rollup-compatible hook on dev server teardown.
      // The Node HTTP 'close' listener remains an idempotent fallback.
      await dispose()
    },
  }
}

/** R14-A2.2-R5: opt-in host-owned transport authentication. */
export { createKeycloakTransportBridge } from './security/feathers-keycloak-transport.js'
export type { KeycloakTransportBridge, KeycloakTransportHost, KeycloakTransportOptions, KeycloakServiceHookContext } from './security/feathers-keycloak-transport.js'

/** R14-A2.3: explicit deny-all Feathers event publishing for protected services. */
export { installKeycloakEventFence } from './security/feathers-keycloak-events.js'
export type { KeycloakEventFenceApp, KeycloakEventFenceReceipt } from './security/feathers-keycloak-events.js'
