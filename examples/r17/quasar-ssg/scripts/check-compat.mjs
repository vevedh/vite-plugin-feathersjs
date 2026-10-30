#!/usr/bin/env node
import { readFile } from 'node:fs/promises'
const baseline = JSON.parse(await readFile(new URL('../../../quasar-ssr/package.json', import.meta.url), 'utf8'))
const version = baseline.devDependencies['@quasar/app-vite']
if (!version || !/^\^?3\./.test(version)) {
  console.error(`BLOCKED: Quasar SSG reference requires validated CLI v3; certified SSR uses @quasar/app-vite ${version}. No automatic upgrade.`)
  process.exitCode = 2
}
else {
  console.error('BLOCKED: v3 detected but SSG version-specific certification not recorded; validate before enabling.')
  process.exitCode = 2
}
