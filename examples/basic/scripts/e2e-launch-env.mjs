import { resolve } from 'node:path'

/** Pin all values that can change the release and HTML regression gates.
 * Benchmarks keep using check-basic-e2e.mjs directly, with their explicit env.
 * These are separate child environments; no parent process env is modified.
 */
export function releaseE2EEnv(inherited, basic) {
  return {
    ...inherited,
    FEATHERS_E2E_RUNS: '1',
    FEATHERS_R10_CONFIG_LOADER: 'bundle',
    FEATHERS_FAST_DEV: '0',
    FEATHERS_TRANSPORT_PROFILE: '0',
    VITE_HTML_PRELOAD: 'off',
    VITE_HTML_PRELOAD_ASSETS: '',
    FEATHERS_E2E_REPORT_PATH: resolve(basic, '../../docs-private/basic-r15-r1-release-e2e.json'),
  }
}

export function htmlE2EEnv(inherited, basic) {
  return {
    ...inherited,
    FEATHERS_E2E_RUNS: '1',
    FEATHERS_R10_CONFIG_LOADER: 'bundle',
    FEATHERS_FAST_DEV: '1',
    FEATHERS_TRANSPORT_PROFILE: '0',
    VITE_HTML_PRELOAD: 'assets',
    VITE_HTML_PRELOAD_ASSETS: '/pwa-192x192.png',
    FEATHERS_E2E_REPORT_PATH: resolve(basic, '../../docs-private/basic-r14-html-e2e.json'),
  }
}
