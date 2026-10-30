import { defineConfig, devices } from '@playwright/test'

// The Windows certification script owns all three loopback processes.
// Never start or re-use an unknown local server from Playwright itself.
const channel = process.env.R16_BROWSER_CHANNEL || 'msedge'
if (!['msedge', 'chromium'].includes(channel)) throw new Error('R16_BROWSER_CHANNEL must be msedge or chromium')
const baseURL = process.env.R16_BROWSER_BASE_URL || 'http://127.0.0.1:8080'
if (baseURL !== 'http://127.0.0.1:8080') throw new Error('R16 browser tests only run against the loopback certification proxy')
const videoSetting = process.env.R16_BROWSER_VIDEO || '0'
if (!['0', '1'].includes(videoSetting)) throw new Error('R16_BROWSER_VIDEO must be 0 or 1')

export default defineConfig({
  testDir: './e2e',
  testMatch: '*.pw.mjs',
  timeout: 45_000,
  expect: { timeout: 15_000 },
  globalTimeout: 240_000,
  workers: 1,
  fullyParallel: false,
  retries: 0,
  forbidOnly: true,
  reporter: [['list'], ['json', { outputFile: 'docs-private/r16/browser-results.json' }]],
  outputDir: 'docs-private/r16/playwright-artifacts',
  preserveOutput: 'always',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // Videos are opt-in: Playwright video capture requires its separate FFmpeg binary.
    video: videoSetting === '1' ? 'retain-on-failure' : 'off',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [{
    name: channel === 'msedge' ? 'msedge-windows' : 'chromium-fallback',
    use: {
      ...devices['Desktop Chrome'],
      channel,
      launchOptions: { args: ['--disable-gpu', '--disable-features=CalculateNativeWinOcclusion'] },
    },
  }],
})
