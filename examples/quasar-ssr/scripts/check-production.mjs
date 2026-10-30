import { resolveSsrEntry } from './ssr-entry.mjs'
console.log(`PASS: Quasar generated production entry ${await resolveSsrEntry()}`)
await import('./check-runtime.mjs')
