#!/usr/bin/env node
import { parse, generate } from './r17/generator.mjs'
try {
  const args = parse(process.argv.slice(2))
  const report = await generate(args)
  console.log(args.json ? JSON.stringify(report, null, 2) : `${args.dryRun ? 'DRY RUN' : 'CREATED'}: ${report.destination} (${report.files.length} files)`)
}
catch (cause) { console.error(`FAIL: ${cause instanceof Error ? cause.message : String(cause)}`); process.exitCode = 1 }
