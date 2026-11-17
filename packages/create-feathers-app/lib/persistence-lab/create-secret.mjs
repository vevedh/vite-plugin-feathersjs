#!/usr/bin/env node
import { randomBytes } from 'node:crypto'
import { mkdir, open, lstat } from 'node:fs/promises'
import { resolve, join } from 'node:path'
const dir = resolve('secrets')
const file = join(dir, 'db_password')
try {
  if (process.argv.length !== 2) throw Error('ARGUMENTS_REFUSED')
  await mkdir(dir, { recursive: true, mode: 0o700 })
  if ((await lstat(dir)).isSymbolicLink()) throw Error('SECRET_PATH_REFUSED')
  const handle = await open(file, 'wx', 0o600)
  try { await handle.writeFile(randomBytes(36).toString('base64url') + '\n') } finally { await handle.close() }
  console.log('P5_SECRET=CREATED | PATH=secrets/db_password | CONTENT=REDACTED')
} catch {
  console.error('P5_SECRET=REFUSED | EXISTING_FILE_OR_UNSAFE_PATH')
  process.exitCode = 2
}
