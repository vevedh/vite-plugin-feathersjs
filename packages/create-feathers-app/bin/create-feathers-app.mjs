#!/usr/bin/env node
import { dirname,resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFile } from 'node:fs/promises'
import { createGenerator } from '../lib/scaffold.mjs'
import { runServiceCommand } from '../lib/services.mjs'
const packageRoot=resolve(dirname(fileURLToPath(import.meta.url)),'..')
const {version}=JSON.parse(await readFile(resolve(packageRoot,'package.json'),'utf8'))
const args=process.argv.slice(2)
if(args.includes('--help')||args.includes('-h')||!args.length){
  console.log(`create-feathers-app ${version}

Usage: create-feathers-app <name> [options]
  --name <name>       Project name (alternative to positional name)
  --dir <directory>   Safe folder name (within current directory)
  --ui <quasar2|daisyui>  Default daisyui
  --render <spa|ssr|ssg>  Default spa
  --adapter <koa|express>  Default koa
  --transport <rest|both>  Default rest (both only for SPA)
  --dry-run           Preview files without writing
  --json              Machine-readable output
  --schema <typebox|json|zod>     Service schema preset (default typebox)
  --auth <none|jwt|oauth2|oidc|keycloak>  Identity configuration blueprint
  --db <alias:adapter[,alias:adapter]>    Named connections (default main:memory)
  --version           Print CLI version

Service: create-feathers-app service add <name> [--project <path>] [--schema typebox|json|zod] [--db <alias>] [--auth none|jwt] [--dry-run]

Available: Quasar 2 SPA/SSR; daisyUI SPA, SSR, SSG.
Quasar SSR uses the R16-certified architecture; R17-generated SSR requires its own Windows E2E certification. Quasar SSG not supported.`)
}else if(args.includes('--version')||args.includes('-v'))console.log(version)
else if(args[0]==='service') {
  try { await runServiceCommand(args.slice(1),process.cwd()) } catch(error){console.error(`FAIL: ${error.message}`);process.exitCode=1}
}
else {
  const {parse,generate}=createGenerator({outputRoot:process.cwd(),templatesRoot:resolve(packageRoot,'templates'),reportRoot:process.cwd()})
  try {
    const options=parse(args)
    const result=await generate(options)
    console.log(options.json?JSON.stringify(result,null,2):`${options.dryRun?'DRY RUN':'CREATED'}: ${result.destination} (${result.files.length} files)`)
  } catch(error){console.error(`FAIL: ${error.message}`);process.exitCode=1}
}
