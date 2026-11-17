import { describe, expect, it } from 'vitest'
import { canHotUpdate, sameFileSet, shouldInspectFileEvent, isWatchedServiceDependency } from '../src/hmr-utils.js'

describe('HMR filtering', () => {
  const tracked = new Set(['/project/server/health.ts', '/project/server/notes.ts'])
  it('only matches dependencies below configured service directories', () => {
    const folders = ['/project/server/services', '/project/shared/feathers']
    expect(isWatchedServiceDependency('/project/server/services/notes/notes.class.ts', folders)).toBe(true)
    expect(isWatchedServiceDependency('/project/shared/feathers/notes.schema.ts', folders)).toBe(true)
    expect(isWatchedServiceDependency('/project/server/service-evil/notes.ts', folders)).toBe(false)
    expect(isWatchedServiceDependency('/project/src/pages/feathers.vue', folders)).toBe(false)
  })
  it('skips unchanged module inventories', () => {
    expect(sameFileSet(tracked, ['/project/server/notes.ts', '/project/server/health.ts'])).toBe(true)
    expect(sameFileSet(tracked, ['/project/server/health.ts'])).toBe(false)
    expect(sameFileSet(tracked, ['/project/server/notes.ts', '/project/server/new.ts'])).toBe(false)
  })
  it('only rebuilds changed tracked files', () => {
    expect(shouldInspectFileEvent('change', '/project/server/notes.ts', tracked)).toBe(true)
    expect(shouldInspectFileEvent('change', '/project/src/app.ts', tracked)).toBe(false)
  })
  it('requires Socket.IO and tracked changes for in-place updates', () => {
    expect(canHotUpdate('change', '/project/server/notes.ts', tracked, true)).toBe(true)
    expect(canHotUpdate('change', '/project/server/notes.ts', tracked, false)).toBe(false)
    expect(canHotUpdate('unlink', '/project/server/notes.ts', tracked, true)).toBe(false)
    expect(canHotUpdate('change', '/project/server/other.ts', tracked, true)).toBe(false)
  })
  it('inspects add/remove events before rebuilding', () => {
    expect(shouldInspectFileEvent('add', '/project/src/file.ts', tracked)).toBe(true)
    expect(shouldInspectFileEvent('unlink', '/project/server/notes.ts', tracked)).toBe(true)
    expect(shouldInspectFileEvent('addDir', '/project/server/new', tracked)).toBe(false)
    expect(shouldInspectFileEvent('ready', '/project/server/notes.ts', tracked)).toBe(false)
  })
})
