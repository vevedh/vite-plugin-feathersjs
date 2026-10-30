import { relative, isAbsolute, sep } from 'node:path';
/** Pure HMR predicates kept separate from Vite and Feathers runtime state. */
export function sameFileSet(previous, next) {
    return previous.size === next.length && next.every(path => previous.has(path));
}
/** All paths are absolute; only descendants of declared service directories match. */
export function isWatchedServiceDependency(file, directories) {
    return directories.some(directory => {
        const rel = relative(directory, file);
        return rel !== '' && rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
    });
}
/** Changes outside registered modules should never trigger a runtime rebuild. */
export function shouldInspectFileEvent(event, absolutePath, tracked) {
    if (event === 'change')
        return tracked.has(absolutePath);
    return event === 'add' || event === 'unlink';
}
/**
 * Socket.IO can remain connected only when an existing module explicitly opts into
 * in-place updates. A module without hotUpdate must use the safe full restart.
 */
export function canHotUpdate(event, changedFile, tracked, socketEnabled) {
    return socketEnabled && event === 'change' && tracked.has(changedFile);
}
//# sourceMappingURL=hmr-utils.js.map