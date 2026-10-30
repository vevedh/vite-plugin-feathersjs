#!/usr/bin/env node
/** Local R17 certification: refuses foreign listeners, owns both children, runs real HTTP+Edge checks. */
import { spawn, spawnSync } from 'node:child_process'
import { createServer } from 'node:net'
import { access, mkdir, open, lstat, realpath } from 'node:fs/promises'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { setTimeout as sleep } from 'node:timers/promises'
import { parseRunOptions, caseDirectory, assertExampleHtml, browserMode } from './r17-runner-config.mjs'
import { resolveLocalPlaywrightCli } from './resolve-playwright-cli.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const playwrightRoot = resolve(root, 'examples/quasar-ssr')
const reportDir = resolve(root, 'examples/r17/docs-private/certifications')
const url = 'http://127.0.0.1:5173'
let children = []
let logFiles = []

async function portIsFree(port) {
  const server = createServer()
  return new Promise((resolveCheck, reject) => {
    server.once('error', error => error.code === 'EADDRINUSE' ? resolveCheck(false) : reject(error))
    server.listen(port, '127.0.0.1', () => server.close(() => resolveCheck(true)))
  })
}
async function requireFile(pathname, advice) {
  try { await access(pathname) }
  catch { throw new Error(`${advice} (missing: ${pathname})`) }
}
async function checkPrerequisites(options, directory) {
  const project = resolve(root, 'examples/r17', directory)
  // Refuse a user-selected project junction/symlink that escapes the examples tree.
  const projectInfo = await lstat(project).catch(() => null)
  if (!projectInfo?.isDirectory() || projectInfo.isSymbolicLink()) throw new Error(`Example directory is missing or a symlink: ${project}`)
  const real = await realpath(project)
  const casesRoot = await realpath(resolve(root, 'examples/r17'))
  if (!real.startsWith(casesRoot + (process.platform === 'win32' ? '\\' : '/'))) throw new Error('Example directory escapes R17 root')
  await requireFile(resolve(project, 'node_modules/@vevedh/vite-plugin-feathersjs/package.json'), `Install example dependencies: cd examples/r17/${directory}; corepack pnpm install`)
  await requireFile(resolve(project, 'api/server.mjs'), 'API source not found')
  // Resolve the public @playwright/test CLI export from the *known* Quasar test project.
  // Do not resolve 'playwright/cli': recent Playwright versions deliberately do
  // not export this private subpath, even when pnpm exec playwright works.
  const cli = await resolveLocalPlaywrightCli(playwrightRoot)
  if (options.case.endsWith('-spa')) await requireFile(resolve(project, 'node_modules/vite/bin/vite.js'), 'Install Vite in example project')
  if (options.case === 'daisyui-ssg') await requireFile(resolve(project, 'dist/ssg/index.html'), `Build SSG before running: cd examples/r17/${directory}; corepack pnpm run build`)
  if (options.case === 'daisyui-ssr' && options.production) await requireFile(resolve(project, 'dist/server/entry-server.js'), `Build SSR first: cd examples/r17/${directory}; corepack pnpm run build`)
  const ports = [3030, 5173, ...(options.socket ? [3031] : [])]
  for (const port of ports) if (!await portIsFree(port)) throw new Error(`Port ${port} already in use on 127.0.0.1. Stop the other service first; refusing to test an unknown server.`)
  return { project, cli }
}
function commandLabel(command) { return [command[0], ...command.slice(1).map(x => x.split(/[\\/]/).slice(-2).join('/'))].join(' ') }
async function startProcess(role, cwd, args, env, stamp) {
  const out = await open(join(reportDir, `${stamp}-${role}.stdout.log`), 'w')
  const err = await open(join(reportDir, `${stamp}-${role}.stderr.log`), 'w')
  logFiles.push(out, err)
  const proc = spawn(process.execPath, args, { cwd, env, windowsHide: true, stdio: ['ignore', out.fd, err.fd] })
  children.push({ role, proc })
  proc.once('error', () => {}) // checked via proc.exitCode / error during readiness
  console.log(`START ${role} PID=${proc.pid} (${commandLabel(args)})`)
  return proc
}
async function waitFor(role, pathname, validate, timeMs = 45000) {
  const deadline = Date.now() + timeMs
  let last = 'waiting'
  while (Date.now() < deadline) {
    const failure = children.find(p => p.proc.exitCode !== null || p.proc.signalCode !== null || !p.proc.pid)
    if (failure) throw new Error(`${failure.role} exited before ready (code=${failure.proc.exitCode ?? failure.proc.signalCode}). Inspect ${reportDir}/*.stderr.log`)
    try {
      const response = await fetch(pathname, { signal: AbortSignal.timeout(2500) })
      if (response.ok) {
        const data = await response.text()
        validate(data)
        console.log(`PASS: ${role} ready (${pathname})`)
        return
      }
      last = `HTTP ${response.status}`
    } catch (error) {
      // Wrong application identity must fail immediately instead of retrying against a foreign website.
      if (error?.message?.startsWith('Wrong R17 example')) throw error
      last = error.message
    }
    await sleep(300)
  }
  throw new Error(`Timeout waiting for ${role} (${pathname}): ${last}. Inspect ${reportDir}/*.stderr.log`)
}
async function childCheck(role, args, cwd, env) {
  console.log(`CHECK: ${role}`)
  // Spawn (rather than spawnSync) so Ctrl-C can be handled by the parent.
  const child = spawn(process.execPath, args, { cwd, env, windowsHide: true, stdio: 'inherit' })
  children.push({role, proc: child, ephemeral: true})
  const code = await new Promise((res,rej) => { child.once('error',rej); child.once('close',res) })
  children = children.filter(item=>item.proc !== child)
  if (code !== 0) throw new Error(`${role} returned ${code}`)
}
async function stopAll() {
  const running = children.splice(0).reverse()
  for (const {proc} of running) {
    if (proc.exitCode !== null || proc.signalCode !== null || !proc.pid) continue
    try {
      if (process.platform === 'win32') {
        const killed = spawnSync('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { windowsHide: true, timeout: 10000, stdio: 'ignore' })
        if (killed.status !== 0) proc.kill()
      } else proc.kill('SIGTERM')
    } catch { try { proc.kill() } catch {} }
  }
  for (const handle of logFiles.splice(0)) await handle.close().catch(() => {})
}
async function main() {
  const options = parseRunOptions(process.argv.slice(2))
  const directory = options.project ? `generated/${options.project}` : caseDirectory(options.case)
  const { project, cli } = await checkPrerequisites(options, directory)
  console.log('PASS: Playwright CLI available (@playwright/test/cli)')
  if (options.preflight) { console.log(`PASS: R17 preflight case=${options.case} adapter=${options.adapter}, ports free`);return }
  const stamp = `${new Date().toISOString().replace(/[:.]/g,'-')}-${options.case}-${options.adapter}`
  await mkdir(reportDir, {recursive:true})
  const env = { ...process.env,
    FEATHERS_ADAPTER: options.adapter, FEATHERS_API_PORT: '3030', FEATHERS_SOCKET_PORT: '3031',
    FEATHERS_SOCKETIO: options.socket ? '1' : '0', VITE_FEATHERS_REALTIME: options.socket ? '1' : '0',
    FEATHERS_PUBLIC_ORIGIN: url, NODE_ENV: options.production ? 'production' : 'development',
  }
  const envFile = resolve(project, '.env')
  const envSample = resolve(project, '.env.example')
  const useEnv = await access(envFile).then(()=>'.env').catch(()=>'.env.example')
  await requireFile(useEnv === '.env' ? envFile : envSample, 'Missing example environment')
  // NODE_ENV and FEATHERS_* passed via process.env win over --env-file values in Node 22.
  const apiArgs = [`--env-file=${useEnv}`, 'api/server.mjs']
  const frontendArgs = options.case.endsWith('-spa')
    ? ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5173', '--strictPort']
    : [options.case === 'daisyui-ssg' ? 'scripts/serve-static.mjs' : 'scripts/serve-ssr.mjs']
  console.log(`R17 case=${options.case} adapter=${options.adapter} socket=${options.socket} production=${options.production}`)
  await startProcess('api', project, apiArgs, env, stamp)
  await waitFor('Feathers API', 'http://127.0.0.1:3030/api/health', data => {
    const health = JSON.parse(data)
    if (health?.status !== 'ok' || health.transport !== 'feathers-v5') throw new Error('Health service identity invalid')
  })
  await startProcess('frontend', project, frontendArgs, env, stamp)
  await waitFor(options.case, url, html => assertExampleHtml(html, options.case))
  await childCheck('HTTP health + CRUD', ['examples/r17/scripts/check-feathers-http.mjs'], root, env)
  await childCheck('Edge Playwright', [cli, 'test', '--config', 'playwright.r17.config.mjs'], playwrightRoot,
    { ...env, R17_CASE: options.case, R17_MODE: browserMode(options.case), R17_BASE_URL: url, R17_SOCKET: options.socket ? '1' : '0' })
  console.log(`PASS: R17 ${options.case} ${options.adapter} Socket=${options.socket} Browser=Edge`)
  console.log(`Logs: ${reportDir}`)
}
let terminated = false
process.on('SIGINT', () => { if (!terminated) {terminated = true; void stopAll().then(()=>process.exit(130))} })
process.on('SIGTERM', () => { if (!terminated) {terminated = true; void stopAll().then(()=>process.exit(143))} })
try { await main() } catch(error) { console.error(`FAIL: ${error.message}`);process.exitCode=1 } finally { await stopAll() }
