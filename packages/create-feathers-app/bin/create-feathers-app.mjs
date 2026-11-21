#!/usr/bin/env node
// R10 compatibility router: preserve rc.10 public read-only commands.
// Other commands use the already certified R8 candidate entrypoint unchanged.
const args = process.argv.slice(2)
if (args[0] === 'auth') {
  try {
    const {runAuthCommand} = await import('../lib/auth-command.mjs')
    await runAuthCommand(args.slice(1), process.cwd())
  } catch (error) {
    console.error('AUTH_BLOCKED: ' + (error instanceof Error && /^[A-Z_]+$/.test(error.message) ? error.message : 'AUTH_OPERATION_FAILED'))
    process.exitCode = 1
  }
} else if (args[0] === 'schema' && ['plan', 'validate'].includes(args[1])) {
  try {
    const {runSchemaCommand} = await import('../lib/schema-command-legacy.mjs')
    await runSchemaCommand(args.slice(1), process.cwd())
  } catch (error) {
    console.error('SCHEMA_BLOCKED: ' + (error instanceof Error && /^[A-Z_]+$/.test(error.message) ? error.message : 'SCHEMA_OPERATION_FAILED'))
    process.exitCode = 1
  }
} else {
  await import('./cli-r8.mjs')
}
