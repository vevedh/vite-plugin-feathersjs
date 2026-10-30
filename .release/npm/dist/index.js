import { traceStartup } from './performance.js';
import { resolve, relative, isAbsolute, sep } from 'node:path';
import { glob } from 'tinyglobby';
import { createFeathersRuntime } from './app.js';
import { validateOptions } from './options.js';
import { canHotUpdate, sameFileSet, shouldInspectFileEvent, isWatchedServiceDependency } from './hmr-utils.js';
export { createFeathersApp, createFeathersRuntime } from './app.js';
export { validateOptions } from './options.js';
export default function feathersPlugin(options) {
    const config = validateOptions(options);
    let root = process.cwd();
    let watchedDirectories = [];
    let active = (_req, _res, next) => next();
    let current;
    let tracked = new Set();
    let timer;
    let pending = Promise.resolve();
    let disposed = false;
    let initialized = false;
    let forceQueued = false;
    let changedQueued = new Set();
    let onlyChangesQueued = true;
    let unwatch;
    const files = async () => {
        const patterns = typeof options.serviceFiles === 'string' ? [options.serviceFiles] : [...options.serviceFiles];
        const found = await glob(patterns, { cwd: root, absolute: true, onlyFiles: true, followSymbolicLinks: false, expandDirectories: false });
        const inside = found.map(path => resolve(path)).filter(path => { const rel = relative(root, path); return rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel); });
        return [...new Set(inside)].sort();
    };
    const rebuild = (load, logger, force = false, changed = [], onlyChanges = false) => {
        pending = pending.catch(() => { }).then(async () => {
            if (disposed)
                return;
            let candidate;
            try {
                traceStartup('feathers.discovery.start');
                const nextFiles = await files();
                traceStartup('feathers.discovery.end', { count: nextFiles.length });
                if (initialized && !force && sameFileSet(tracked, nextFiles))
                    return;
                // Explicitly opt-in hot updates keep Socket.IO connections and channels intact.
                // This is only safe for existing modules, with a stable file inventory.
                if (onlyChanges && current && options.socketio && sameFileSet(tracked, nextFiles) && changed.length > 0) {
                    const modules = await Promise.all(changed.map(async (file) => ({ file, namespace: await load(file) })));
                    if (modules.every(({ namespace }) => typeof namespace.hotUpdate === 'function')) {
                        for (const { namespace } of modules)
                            await namespace.hotUpdate(current.app);
                        logger.info(`[vite-plugin-feathersjs] in-place hot update: ${modules.length} module(s); Socket.IO preserved`);
                        return;
                    }
                }
                traceStartup('feathers.runtime.create.start');
                candidate = await createFeathersRuntime(nextFiles, load, options);
                traceStartup('feathers.runtime.create.end');
                // Socket.IO holds a port. Stop the prior runtime before starting the replacement.
                // REST mode starts replacement first, preserving the previous live runtime on failures.
                if (options.socketio && current) {
                    active = (_req, _res, next) => next();
                    await current.close();
                    current = undefined;
                }
                traceStartup('feathers.transport.start');
                await candidate.start();
                traceStartup('feathers.transport.ready');
                if (disposed) {
                    await candidate.close();
                    return;
                }
                const previous = current;
                active = candidate.handler;
                current = candidate;
                tracked = new Set(nextFiles);
                initialized = true;
                if (previous)
                    await previous.close();
                logger.info(`[vite-plugin-feathersjs] ${config.adapter} ready: ${nextFiles.length} module(s), ${config.prefix}${options.socketio ? `; Socket.IO port ${options.socketio.port}` : ''}`);
            }
            catch (error) {
                if (candidate)
                    await candidate.close().catch(() => { });
                logger.error(`[vite-plugin-feathersjs] reload failed: ${String(error)}`);
            }
        });
        return pending;
    };
    const attach = (server) => {
        traceStartup('vite.configureServer.enter');
        disposed = false;
        const load = (file) => server.ssrLoadModule(file);
        const onFile = (event, changed) => {
            const absolute = resolve(changed);
            const dependency = isWatchedServiceDependency(absolute, watchedDirectories);
            if (!dependency && !shouldInspectFileEvent(event, absolute, tracked))
                return;
            // Existing modules always reload on change. Added/deleted files first
            // compare the discovered file set to avoid rebuilding for unrelated files.
            forceQueued ||= (dependency && ['change', 'add', 'unlink'].includes(event)) || (event === 'change' && tracked.has(absolute));
            onlyChangesQueued &&= event === 'change' && !dependency;
            if (canHotUpdate(event, absolute, tracked, Boolean(options.socketio)))
                changedQueued.add(absolute);
            if (timer)
                clearTimeout(timer);
            timer = setTimeout(() => {
                timer = undefined;
                const force = forceQueued;
                forceQueued = false;
                const changed = [...changedQueued];
                changedQueued = new Set();
                const onlyChanges = onlyChangesQueued;
                onlyChangesQueued = true;
                void rebuild(load, server.config.logger, force, changed, onlyChanges);
            }, config.debounceMs);
        };
        server.middlewares.use(config.prefix, (req, res, next) => {
            if (disposed)
                return next();
            active(req, res, next);
        });
        server.httpServer?.once('close', () => { void dispose(); });
        server.watcher.on('all', onFile);
        unwatch = () => server.watcher.off('all', onFile);
        return async () => { traceStartup('vite.postMiddleware.enter'); await rebuild(load, server.config.logger); traceStartup('vite.postMiddleware.exit'); };
    };
    const dispose = async () => {
        disposed = true;
        if (timer)
            clearTimeout(timer);
        timer = undefined;
        unwatch?.();
        unwatch = undefined;
        await pending.catch(() => { });
        tracked.clear();
        initialized = false;
        forceQueued = false;
        changedQueued.clear();
        onlyChangesQueued = true;
        active = (_req, _res, next) => next();
        if (current) {
            await current.close();
            current = undefined;
        }
    };
    return {
        name: 'vite-plugin-feathersjs',
        apply: 'serve',
        enforce: 'pre',
        configResolved(configured) {
            root = resolve(configured.root);
            watchedDirectories = (options.watchDirectories ?? []).map(dir => resolve(root, dir));
            traceStartup('vite.config.resolved');
        },
        configureServer: attach,
        // Vite's Plugin interface has no closeServer hook. Dispose when the HTTP server closes.
        // Avoid registering cleanup twice when Vite recreates the dev server.
    };
}
//# sourceMappingURL=index.js.map