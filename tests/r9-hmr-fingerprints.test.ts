import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { duplicateServiceChange, snapshotServiceFingerprints } from '../src/hmr-fingerprints.js'

const temporary: string[] = []
afterEach(async () => { for (const dir of temporary.splice(0)) await rm(dir, { recursive: true, force: true }) })

async function fixture(): Promise<string> {
  const dir = await realpath(await mkdtemp(join(await realpath(tmpdir()), 'feathers-r9-fingerprint-')))
  temporary.push(dir)
  return join(dir, 'notes.service.mjs')
}

describe('R9-R5 file-content HMR deduplication', () => {
  it('suppresses repeat notifications for identical published service contents', async () => {
    const file = await fixture()
    await writeFile(file, 'v1\n')
    const before = await snapshotServiceFingerprints([file])
    await writeFile(file, 'v2\n')
    const published = await snapshotServiceFingerprints([file])
    expect(duplicateServiceChange(before, published, [file])).toBe(false)
    expect(duplicateServiceChange(published, await snapshotServiceFingerprints([file]), [file])).toBe(true)
  })
  it('never suppresses a new content revision or an empty event', async () => {
    const file = await fixture()
    await writeFile(file, 'v1')
    const committed = await snapshotServiceFingerprints([file])
    expect(duplicateServiceChange(committed, committed, [])).toBe(false)
    await writeFile(file, 'v3')
    expect(duplicateServiceChange(committed, await snapshotServiceFingerprints([file]), [file])).toBe(false)
  })
})
