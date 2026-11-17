import { createHash } from 'node:crypto'
import { lstat, readFile } from 'node:fs/promises'

/** Snapshot the content actually available before the runtime loads it. */
export async function snapshotServiceFingerprints(files: readonly string[]): Promise<Map<string, string>> {
  const entries = await Promise.all(files.map(async (file): Promise<readonly [string, string]> => {
    const stat = await lstat(file)
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Service module must be a regular file')
    const content = await readFile(file)
    return [file, createHash('sha256').update(content).digest('hex')]
  }))
  return new Map(entries)
}

/** Same service bytes and no other watcher events means no second runtime restart. */
export function duplicateServiceChange(
  committed: ReadonlyMap<string, string>,
  observed: ReadonlyMap<string, string>,
  changed: readonly string[],
): boolean {
  return changed.length > 0 && changed.every(file => {
    const before = committed.get(file)
    return before !== undefined && before === observed.get(file)
  })
}
