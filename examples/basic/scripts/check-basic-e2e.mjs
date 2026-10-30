import { spawn } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'
import { performance } from 'node:perf_hooks'
import { mkdir, writeFile, readFile, rm } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { io } from 'socket.io-client'
import { boundedEnvInteger, boundedEnvChoice } from './e2e-env.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const cases = [
  { adapter: 'koa', socket: false },
  { adapter: 'express', socket: false },
  { adapter: 'koa', socket: true },
  { adapter: 'express', socket: true },
]
const report = []
const traceEnabled = process.env.FEATHERS_R8_TRACE === '1'
const configDebugEnabled = process.env.FEATHERS_R9_VITE_DEBUG === '1'
const viteConfigLoader = boundedEnvChoice(process.env.FEATHERS_R10_CONFIG_LOADER, 'FEATHERS_R10_CONFIG_LOADER', 'bundle', ['bundle', 'runner'])
const reportOverride = process.env.FEATHERS_E2E_REPORT_PATH
const profileLabel = process.env.FEATHERS_E2E_PROFILE_LABEL ?? (process.env.FEATHERS_TRANSPORT_PROFILE === '1' ? 'transport-only' : 'full-vitesse')
const transportProfile = process.env.FEATHERS_TRANSPORT_PROFILE === '1'
const repetitions = boundedEnvInteger(process.env.FEATHERS_E2E_RUNS, 'FEATHERS_E2E_RUNS', 1, 1, 5)
const timeoutMs = Number(process.env.FEATHERS_E2E_TIMEOUT_MS ?? 120000)
const basePort = Number(process.env.FEATHERS_E2E_PORT ?? 34330)
if (!Number.isSafeInteger(basePort) || basePort < 1024 || basePort > 64000) throw new Error('Invalid FEATHERS_E2E_PORT')
if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 300000) throw new Error('Invalid FEATHERS_E2E_TIMEOUT_MS')

function assert(condition, message) { if (!condition) throw new Error(message) }
async function waitFor(predicate, ms, label, abortIf) {
  const until = performance.now() + ms
  while (performance.now() < until) {
    if (abortIf?.()) throw new Error(`Vite exited before ${label}`)
    try { if (await predicate()) return }
    catch { /* startup or transient socket state */ }
    await delay(250)
  }
  throw new Error(`Timeout: ${label}`)
}
async function json(url, init) {
  const response = await fetch(url, { signal: AbortSignal.timeout(5000), ...init })
  const body = await response.json()
  assert(response.ok, `${response.status} ${url}: ${JSON.stringify(body)}`)
  return body
}
async function connect(origin) {
  const socket = io(origin, { autoConnect: false, reconnection: false, transports: ['websocket'], timeout: 5000 })
  try {
    await new Promise((resolve, reject) => {
      socket.once('connect', resolve)
      socket.once('connect_error', reject)
      socket.connect()
    })
    return socket
  }
  catch (error) { socket.disconnect(); throw error }
}
function rpc(socket, method, ...args) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Socket RPC timeout ${method}`)), 5000)
    socket.emit(method, 'notes', ...args, (error, result) => {
      clearTimeout(timer)
      error ? reject(new Error(JSON.stringify(error))) : resolve(result)
    })
  })
}
// On Windows, taskkill /T terminates the spawned pnpm/Vite process tree.
async function stop(child) {
  if (child.exitCode !== null) return
  if (process.platform === 'win32') {
    const killer = spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' })
    await new Promise(resolve => { killer.once('exit', resolve); killer.once('error', resolve) })
  }
  else { try { process.kill(-child.pid, 'SIGTERM') } catch { child.kill('SIGTERM') } }
  await Promise.race([new Promise(resolve => child.once('exit', resolve)), delay(5000)])
  if (child.exitCode === null) child.kill('SIGKILL')
}
async function runCase(testCase, index, run) {
  const vitePort = basePort + index * 2
  const socketPort = vitePort + 1
  const origin = `http://127.0.0.1:${vitePort}`
  const socketOrigin = `http://localhost:${socketPort}`
  const label = `${testCase.adapter}${testCase.socket ? '+socketio' : '-rest'}`
  const started = performance.now()
  const logs = []
  const tracePath = path.resolve(root, `../../docs-private/.r8-trace-${process.pid}-${run}-${index}.jsonl`)
  if (traceEnabled) await mkdir(path.dirname(tracePath), { recursive: true })
  // Shell-free launch, via the already-installed Vite CLI, avoids pnpm startup overhead.
  const viteCli = path.resolve(root, 'node_modules/vite/bin/vite.js')
  const child = spawn(process.execPath, [viteCli, '--configLoader', viteConfigLoader, '--host', '127.0.0.1', '--port', String(vitePort), '--strictPort'], {
    cwd: root,
    env: { ...process.env, FEATHERS_ADAPTER: testCase.adapter, FEATHERS_SOCKETIO: testCase.socket ? '1' : '0', FEATHERS_SOCKET_PORT: String(socketPort), FEATHERS_TEST_ORIGIN: origin, ...(traceEnabled ? { FEATHERS_PROFILE_TRACE: tracePath } : {}), ...(configDebugEnabled ? { DEBUG: 'vite:config' } : {}) },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: process.platform !== 'win32', windowsHide: true,
  })
  for (const stream of [child.stdout, child.stderr]) stream.on('data', chunk => { logs.push(String(chunk)); if (logs.length > 200) logs.shift() })
  let a, b
  try {
    await waitFor(async () => {
      if (child.exitCode !== null) throw new Error(`Vite exited ${child.exitCode}`)
      const response = await fetch(`${origin}/api/health`, { signal: AbortSignal.timeout(1500) })
      return response.ok && (await response.json()).status === 'ok'
    }, timeoutMs, `${label} HTTP readiness`, () => child.exitCode !== null || child.signalCode !== null)
    const readyMs = Math.round(performance.now() - started)
    const apiReadyEpochMs = Date.now()
    const health = await json(`${origin}/api/health`)
    assert(health.status === 'ok', 'health mismatch')
    if (process.env.VITE_HTML_PRELOAD === 'assets' && process.env.VITE_HTML_PRELOAD_ASSETS?.trim()) {
      const htmlResponse = await fetch(origin, { signal: AbortSignal.timeout(5000) })
      assert(htmlResponse.ok, 'Vite index.html unavailable')
      const html = await htmlResponse.text()
      for (const asset of process.env.VITE_HTML_PRELOAD_ASSETS.split(',').map(item => item.trim())) {
        const escaped = asset.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const link = new RegExp(`<link\\b(?=[^>]*rel=[\"']preload[\"'])(?=[^>]*href=[\"']${escaped}[\"'])[^>]*>`, 'i')
        assert(link.test(html), `Missing configured HTML preload: ${asset}`)
      }
    }
    const list = await json(`${origin}/api/notes`)
    assert(Array.isArray(list), 'GET notes did not return an array')
    const title = `r6-${label}`
    let created
    if (testCase.socket) {
      a = await connect(socketOrigin)
      b = await connect(socketOrigin)
      let eventCount = 0
      b.on('notes created', () => eventCount++)
      created = await rpc(a, 'create', { title })
      await waitFor(() => eventCount === 1, 5000, 'created broadcast to second client')
      const patched = await rpc(a, 'patch', created.id, { title: `${title}-patched` })
      assert(patched.title === `${title}-patched`, 'socket patch mismatch')
      await rpc(a, 'remove', created.id)
      assert(eventCount === 1, 'duplicated created event')
    }
    else {
      created = await json(`${origin}/api/notes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title }) })
      const patched = await json(`${origin}/api/notes/${created.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: `${title}-patched` }) })
      assert(patched.title === `${title}-patched`, 'REST patch mismatch')
      await json(`${origin}/api/notes/${created.id}`, { method: 'DELETE' })
      let unavailable = false
      try { await fetch(socketOrigin, { signal: AbortSignal.timeout(1000) }) } catch { unavailable = true }
      assert(unavailable, 'Socket.IO port should not be open in REST-only mode')
    }
    console.log(`PASS ${label}: API, CRUD${testCase.socket ? ', realtime 2 clients' : ''} (${readyMs} ms readiness)`)
    const events = traceEnabled ? await readFile(tracePath, 'utf8').then(raw => raw.trim().split('\n').filter(Boolean).map(line => JSON.parse(line))).catch(() => []) : []
    const originEpochMs = apiReadyEpochMs - readyMs
    const timings = events.map(event => ({ phase: event.phase, msFromSpawn: Math.round(event.epochMs - originEpochMs), pid: event.pid, ...(event.count === undefined ? {} : { count: event.count }) }))
    if (traceEnabled) console.log(`TRACE ${label}: ${timings.map(item => `${item.phase}=${item.msFromSpawn}ms`).join(' | ')}`)
    // Capture only duration summaries, never full debug logs (paths or env may be private).
    const viteConfigDebug = configDebugEnabled ? logs.join('').split(/\r?\n/)
      .filter(line => /vite:config/.test(line) && /(?:loaded|bundled|resolved|config file).*?\d+(?:\.\d+)?\s?ms/i.test(line))
      .slice(0, 12).map(line => {
        const values = [...line.matchAll(/(\d+(?:\.\d+)?)\s?ms/g)].map(match => Number(match[1]))
        return { event: /bundled/i.test(line) ? 'config.bundle' : /loaded/i.test(line) ? 'config.load' : 'config.other', durationMs: values.at(-1) ?? null }
      }).filter(item => item.durationMs !== null) : []
    return { label, readyMs, configLoader: viteConfigLoader, status: 'PASS', ...(traceEnabled ? { timings } : {}), ...(configDebugEnabled ? { viteConfigDebug } : {}) }
  }
  catch (error) {
    console.error(`FAIL ${label}: ${error.message}`)
    console.error(logs.join('').slice(-6000))
    return { label, status: 'FAIL', error: String(error) }
  }
  finally { a?.disconnect(); b?.disconnect(); await stop(child); if (traceEnabled) await rm(tracePath, { force: true }).catch(() => {}) }
}
for (let run = 1; run <= repetitions; run++) {
  for (const [index, testCase] of cases.entries()) {
    const result = await runCase(testCase, index, run)
    report.push({ ...result, run })
  }
}
const summaries = cases.map(testCase => {
  const label = `${testCase.adapter}${testCase.socket ? '+socketio' : '-rest'}`
  const times = report.filter(item => item.label === label && item.status === 'PASS').map(item => item.readyMs).sort((a, b) => a - b)
  const mid = Math.floor(times.length / 2)
  const medianMs = times.length ? (times.length % 2 ? times[mid] : (times[mid - 1] + times[mid]) / 2) : null
  return { label, medianMs, samples: times.length }
})
const destination = reportOverride ? path.resolve(reportOverride) : path.resolve(root, `../../docs-private/${transportProfile ? 'basic-r7-transport-profile' : 'basic-r7-full-profile'}.json`)
await mkdir(path.dirname(destination), { recursive: true })
await writeFile(destination, JSON.stringify({ generatedAt: new Date().toISOString(), node: process.version, platform: process.platform, profile: profileLabel, configLoader: viteConfigLoader, repetitions, cases: report, summaries }, null, 2))
console.log(`Report: ${destination}`)
if (report.some(item => item.status !== 'PASS')) process.exitCode = 1
