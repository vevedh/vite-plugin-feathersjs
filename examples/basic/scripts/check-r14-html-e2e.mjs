import { spawn } from 'node:child_process'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { htmlE2EEnv } from './e2e-launch-env.mjs'

const basic = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const child = spawn(process.execPath, [resolve(basic, 'scripts/check-basic-e2e.mjs')], {
  cwd: basic,
  env: htmlE2EEnv(process.env, basic),
  stdio: 'inherit', windowsHide: true,
})
child.once('error', cause => { console.error(cause); process.exitCode = 1 })
child.once('exit', (code, signal) => { process.exitCode = code === 0 && !signal ? 0 : 1 })
