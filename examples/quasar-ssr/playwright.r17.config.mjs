import { defineConfig } from '@playwright/test'
const allowed = new Set(['quasar-spa','daisyui-spa','daisyui-ssr','daisyui-ssg'])
const selectedCase = process.env.R17_CASE
const selectedMode = selectedCase?.endsWith('-spa') ? 'spa' : selectedCase?.endsWith('-ssr') ? 'ssr' : 'ssg'
if (!allowed.has(selectedCase) || process.env.R17_MODE !== selectedMode || process.env.R17_BASE_URL !== 'http://127.0.0.1:5173') {
  throw new Error('R17 environment incomplete or inconsistent. Prefer: node examples/r17/scripts/certify-r17.mjs --case quasar-spa [--adapter koa|express]. Manual Playwright requires R17_CASE, R17_MODE and loopback R17_BASE_URL.')
}
export default defineConfig({
  testDir: './e2e', testMatch: 'r17-cases.pw.mjs',
  timeout: 45000, expect: { timeout: 15000 },
  retries: 0, workers: 1, reporter: [['list']],
  use: {
    baseURL: process.env.R17_BASE_URL,
    browserName: 'chromium', channel: 'msedge',
    launchOptions: { args: ['--disable-gpu','--disable-features=CalculateNativeWinOcclusion'] },
    headless: true, video: 'off', trace: 'retain-on-failure', screenshot: 'only-on-failure',
  },
})
