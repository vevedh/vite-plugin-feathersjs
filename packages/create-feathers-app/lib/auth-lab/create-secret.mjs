#!/usr/bin/env node
import { randomBytes } from 'node:crypto'
import { mkdir, open, lstat } from 'node:fs/promises'
import { join, resolve } from 'node:path'
const root = resolve('secrets')
try {
  if (process.argv.length !== 2) throw Error('NO_ARGUMENTS_ALLOWED')
  await mkdir(root,{recursive:true,mode:0o700})
  if ((await lstat(root)).isSymbolicLink()) throw Error('SECRET_DIRECTORY_REFUSED')
  const entries = [['jwt_secret',48], ['admin_password',32]]
  const existing = await Promise.all(entries.map(async ([name]) => lstat(join(root,name)).then(()=>true,e=>{if(e.code==='ENOENT')return false;throw e})))
  if (existing.every(Boolean)) { console.log('AUTH_SECRETS=EXISTING | CONTENT=REDACTED'); process.exit(0) }
  if (existing.some(Boolean)) throw Error('PARTIAL_SECRET_SET_REFUSED')
  for (const [name,size] of entries) {
    const file = await open(join(root,name),'wx',0o600)
    try { await file.writeFile(randomBytes(size).toString('base64url')+'\n') } finally { await file.close() }
  }
  console.log('AUTH_SECRETS=CREATED | CONTENT=REDACTED')
} catch { console.error('AUTH_SECRETS=REFUSED'); process.exitCode=2 }
