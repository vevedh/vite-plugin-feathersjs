/** Pure HMR predicates kept separate from Vite and Feathers runtime state. */
export declare function sameFileSet(previous: ReadonlySet<string>, next: readonly string[]): boolean;
/** All paths are absolute; only descendants of declared service directories match. */
export declare function isWatchedServiceDependency(file: string, directories: readonly string[]): boolean;
/** Changes outside registered modules should never trigger a runtime rebuild. */
export declare function shouldInspectFileEvent(event: string, absolutePath: string, tracked: ReadonlySet<string>): boolean;
/**
 * Socket.IO can remain connected only when an existing module explicitly opts into
 * in-place updates. A module without hotUpdate must use the safe full restart.
 */
export declare function canHotUpdate(event: string, changedFile: string, tracked: ReadonlySet<string>, socketEnabled: boolean): boolean;
