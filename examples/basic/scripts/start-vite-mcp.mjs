import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { existsSync } from 'node:fs'
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const viteCli = resolve(root, 'node_modules/vite/bin/vite.js')
if (!existsSync(viteCli)) throw new Error('Vite is not installed; install the example dependencies first')
const child = spawn(process.execPath, [viteCli, '--host', 'localhost', '--port', '3333', '--strictPort'], {
  cwd: root,
  env: { ...process.env, FEATHERS_VITE_MCP: '1' },
  stdio: 'inherit',
  windowsHide: true,
})
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { if (!child.killed) child.kill(signal) })
child.once('error', error => { console.error(error); process.exitCode = 1 })
child.once('exit', code => { process.exitCode = code === 0 ? 0 : (code || 1) })
