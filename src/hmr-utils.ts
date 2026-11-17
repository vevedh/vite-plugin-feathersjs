import { relative, isAbsolute, sep } from 'node:path'
/** Pure HMR predicates kept separate from Vite and Feathers runtime state. */
export function sameFileSet(previous: ReadonlySet<string>, next: readonly string[]): boolean {
  return previous.size === next.length && next.every(path => previous.has(path))
}

/** All paths are absolute; only descendants of declared service directories match. */
export function isWatchedServiceDependency(file: string, directories: readonly string[]): boolean {
  return directories.some(directory => {
    const rel = relative(directory, file)
    return rel !== '' && rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel)
  })
}

/** Changes outside registered modules should never trigger a runtime rebuild. */
export function shouldInspectFileEvent(event: string, absolutePath: string, tracked: ReadonlySet<string>): boolean {
  if (event === 'change') return tracked.has(absolutePath)
  return event === 'add' || event === 'unlink'
}

/**
 * Socket.IO can remain connected only when an existing module explicitly opts into
 * in-place updates. A module without hotUpdate must use the safe full restart.
 */
export function canHotUpdate(event: string, changedFile: string, tracked: ReadonlySet<string>, socketEnabled: boolean): boolean {
  return socketEnabled && event === 'change' && tracked.has(changedFile)
}
