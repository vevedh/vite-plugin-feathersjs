#!/usr/bin/env node
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { generate, parseArguments } from './service-generator/core.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const help = `Generate a FeathersJS v5 service and an optional Pinia store (Basic example).

Usage:
  node scripts/generate-feathers-service.mjs articles [options]
  node scripts/generate-feathers-service.mjs --name articles --store pinia --dry-run

Options:
  --name <slug>       Service identifier in lowercase kebab-case
  --path <slug>       Feathers service path (default: service identifier)
  --store pinia|none  Generate client and Pinia store (default: pinia)
  --id number|string  Record ID type (default: number)
  --methods <list>    Comma-separated find,get,create,update,patch,remove
  --realtime          Generate demonstration Socket.IO channel publisher
  --dry-run           Display intended files without writing
  --help              Show this message

Generated services use in-memory storage and a demo 'title' field.
Never expose generated demo services publicly without authentication and RBAC.
`
try {
  const options = parseArguments(process.argv.slice(2))
  if (options.help) {
    process.stdout.write(help)
  }
  else {
    const result = generate(root, options)
    console.log(`${result.dryRun ? 'DRY RUN' : 'PASS'}: ${result.spec.name} (${result.spec.methods.join(', ')})`)
    for (const file of result.files) console.log(`  ${file}`)
  }
}
catch (cause) {
  console.error(`FAIL: ${cause instanceof Error ? cause.message : String(cause)}`)
  process.exitCode = 1
}
