import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { checkVideoPrerequisite, expectedFfmpegPath } from '../scripts/check-browser-prereqs.mjs'

test('video off does not require FFmpeg and keeps a testable browser prerequisite', () => {
  assert.equal(checkVideoPrerequisite({ video: '0' }).video, false)
  assert.throws(() => checkVideoPrerequisite({ video: 'yes' }), /must be 0 or 1/)
})

test('video prerequisite pins required FFmpeg revision and rejects missing binaries', () => {
  const dir = mkdtempSync(join(tmpdir(), 'r16-playwright-'))
  try {
    const testPackage = join(dir, 'playwright', 'package.json')
    const corePackage = join(dir, 'playwright-core', 'package.json')
    mkdirSync(join(dir, 'playwright'), { recursive: true })
    mkdirSync(join(dir, 'playwright-core'), { recursive: true })
    writeFileSync(testPackage, '{}')
    writeFileSync(corePackage, '{}')
    writeFileSync(join(dir, 'playwright-core', 'browsers.json'), JSON.stringify({ browsers: [{ name: 'ffmpeg', revision: '1013' }] }))
    const env = { LOCALAPPDATA: dir }
    const target = expectedFfmpegPath({ revision: '1013', platform: 'win32', env })
    assert.equal(target, join(dir, 'ms-playwright', 'ffmpeg-1013', 'ffmpeg-win64.exe'))
    const check = (exists) => checkVideoPrerequisite({ video: '1', playwrightPackage: testPackage, corePackage, env, exists, platform: 'win32' })
    assert.throws(() => check(() => false), /playwright install ffmpeg/)
    // Contract-check without adding an executable to the repository.
    assert.match(check(p => p === target).message, /FFmpeg verified/)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})
