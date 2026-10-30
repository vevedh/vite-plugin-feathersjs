import { defineConfig } from '@playwright/test'
if (process.env.R17_SSR_BASE_URL !== 'http://127.0.0.1:8080') throw new Error('Use the generated SSR runner with the loopback edge URL')
export default defineConfig({
  testDir:'./e2e', testMatch:'r17-generated-ssr.pw.mjs',
  timeout:45000, expect:{timeout:15000}, retries:0, workers:1, reporter:[['list']],
  use:{baseURL:process.env.R17_SSR_BASE_URL,browserName:'chromium',channel:'msedge',headless:true,
    launchOptions:{args:['--disable-gpu','--disable-features=CalculateNativeWinOcclusion']},
    screenshot:'only-on-failure',trace:'retain-on-failure',video:'off'},
})
