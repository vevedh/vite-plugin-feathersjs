import { createRequire } from 'node:module'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'

// Use the installed Playwright revision, not a hard-coded ffmpeg-XXXX folder.
// Checking a different revision can falsely certify a missing browser dependency.
const require = createRequire(import.meta.url)

export function expectedFfmpegPath({ revision, platform = process.platform, env = process.env, home = os.homedir(), coreRoot = '' }) {
  if (!/^\d+$/.test(String(revision))) throw new Error('Invalid Playwright FFmpeg revision')
  if (platform !== 'win32') throw new Error('Edge R16 certification is Windows-only')
  const custom = env.PLAYWRIGHT_BROWSERS_PATH
  const browsersRoot = custom === '0'
    ? join(coreRoot, '.local-browsers')
    : custom ? resolve(custom) : join(env.LOCALAPPDATA || join(home, 'AppData', 'Local'), 'ms-playwright')
  return join(browsersRoot, `ffmpeg-${revision}`, 'ffmpeg-win64.exe')
}

export function checkVideoPrerequisite({ video, playwrightPackage, corePackage, env = process.env, exists = existsSync, platform = process.platform }) {
  if (video !== '0' && video !== '1') throw new Error('R16_BROWSER_VIDEO must be 0 or 1')
  if (video === '0') return { video: false, message: 'video off; traces and screenshots remain enabled' }
  const fromPlaywright = createRequire(playwrightPackage)
  const resolvedCore = corePackage || fromPlaywright.resolve('playwright-core/package.json')
  const coreRoot = dirname(resolvedCore)
  const metadata = JSON.parse(readFileSync(join(coreRoot, 'browsers.json'), 'utf8'))
  const ffmpeg = metadata.browsers?.find(item => item.name === 'ffmpeg')
  if (!ffmpeg) throw new Error('Missing Playwright FFmpeg revision metadata')
  const expected = expectedFfmpegPath({ revision: ffmpeg.revision, env, coreRoot, platform })
  if (!exists(expected)) {
    throw new Error(`Playwright video requires FFmpeg at ${expected}. Install with: corepack pnpm exec playwright install ffmpeg`)
  }
  return { video: true, message: `FFmpeg verified: ${expected}` }
}

export function main() {
  const video = process.env.R16_BROWSER_VIDEO || '0'
  const testPackage = require.resolve('@playwright/test/package.json')
  if (video === '0') {
    console.log('PASS: Playwright installed; FFmpeg not required (videos disabled by default)')
    return
  }
  const fromTest = createRequire(testPackage)
  const playwrightPackage = fromTest.resolve('playwright/package.json')
  const result = checkVideoPrerequisite({ video, playwrightPackage })
  console.log(`PASS: ${result.message}`)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main() } catch (error) {
    console.error(`FAIL: ${error instanceof Error ? error.message : String(error)}`)
    process.exitCode = 1
  }
}
