// Only local Vite dev; never spawn a shell, package install or migration.
import { spawn } from 'node:child_process'
import { resolve } from 'node:path'
const root = resolve(import.meta.dirname, '..')
const executable = resolve(root, 'node_modules/vite/bin/vite.js')
const child = spawn(process.execPath, [executable, '--host', '127.0.0.1', '--strictPort'], {
  cwd: root,
  stdio: 'inherit',
  shell: false,
  env: { ...process.env, NODE_ENV: 'development', FEATHERS_STUDIO_DEVTOOLS: '1' },
})
child.on('error', () => { process.exitCode = 1 })
child.on('exit', (code) => { process.exitCode = code ?? 1 })
