#!/usr/bin/env node
import { buildProjectPlan } from './project-generator/plan.mjs'
import { parsePlanArguments } from './project-generator/options.mjs'

const HELP = `Plan a future Vite + FeathersJS v5 + Pinia project. READ-ONLY prototype.

  node scripts/plan-feathers-project.mjs --name portail --ui quasar2 --pwa on --schema typebox --auth jwt,local --db main:mongodb,audit:postgresql --primary main --json

Options:
  --name <slug>               kebab-case project name
  --ui quasar2|daisyui|daisyui-kit
  --render spa|ssr|ssg        Runtime/renderer depends on UI engine
  --engine auto|vite|quasar-cli-vite    default auto; Quasar SSR/SSG use Quasar CLI
  --pwa on|off                default off (new projects only)
  --schema typebox|json|zod
  --auth none|jwt,local,oauth,oidc,ldap  (comma-separated, jwt implied for local/oauth)
  --db alias:adapter,...      memory|mongodb|postgresql|mariadb|mysql|sqlite
  --primary <alias>           default main
  --transport rest|socketio|both
  --dry-run                   always on in this planning prototype
  --json                      machine-readable output
  --help

No files, dependencies, databases or authentication providers are created.
`
try {
  const args = parsePlanArguments(process.argv.slice(2))
  if (args.help) process.stdout.write(HELP)
  else {
    const plan = buildProjectPlan(args)
    if (args.json) process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`)
    else {
      console.log(`DRY RUN: ${plan.project} — Vite ${plan.stack.vite} / Feathers ${plan.stack.feathers} / ${plan.stack.ui}`)
      console.log(`  ${plan.stack.schema} schema | PWA ${plan.stack.pwa ? 'on' : 'off'} | ${plan.stack.render} (${plan.stack.renderEngine}) | ${plan.stack.transport}`)
      console.log(`  Authentication: ${plan.authentication.strategies.join(', ')}`)
      for (const db of plan.database.connections) console.log(`  Database: ${db.alias} (${db.adapter})${db.isPrimary ? ' [primary]' : ''}`)
      for (const warning of plan.warnings) console.log(`  WARNING: ${warning}`)
      console.log('  Planning only: no application files were generated.')
    }
  }
}
catch (cause) {
  console.error(`FAIL: ${cause instanceof Error ? cause.message : String(cause)}`)
  process.exitCode = 1
}
