#!/usr/bin/env node
/** Certify an R17 generated Quasar 2 SSR app via its public loopback edge. */
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { connect } from 'node:net'
import { dirname, resolve, join } from 'node:path'
import { resolveLocalPlaywrightCli } from './resolve-playwright-cli.mjs'
import { fileURLToPath } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const defaultProject = resolve(root, 'examples/r17/generated/r17-quasar-ssr')
const playwrightCwd = resolve(root, 'examples/quasar-ssr')
const baseURL = 'http://127.0.0.1:8080'
const allowedAdapters = new Set(['koa', 'express'])

export function parseArgs(args) {
  const options = { adapter: 'koa', project: defaultProject, preflight: false }
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--adapter') {
      const value = args[++i]
      if (!allowedAdapters.has(value)) throw new Error('Expected --adapter koa|express')
      options.adapter = value
    } else if (arg === '--project') {
      const value = args[++i]
      if (!value || value.startsWith('--')) throw new Error('Missing --project path')
      options.project = resolve(root, value)
      // A candidate must be an R17 generated project under the repository's examples.
      const generated = resolve(root, 'examples/r17/generated')
      if (!options.project.startsWith(generated + (process.platform === 'win32' ? '\\' : '/'))) throw new Error('Project must stay within examples/r17/generated')
    } else if (arg === '--preflight') options.preflight = true
    else throw new Error(`Unsupported option: ${arg}`)
  }
  return options
}

export function assertHealth(response, body, url) {
  if (response.status !== 200 || !String(response.contentType).includes('application/json') || body?.status !== 'ok' || body?.transport !== 'feathers-v5') {
    throw new Error(`${url} did not return Feathers JSON health (possible SSR fallback)`)
  }
}

async function probePort(port) {
  return new Promise(resolve => {
    const socket = connect({ host: '127.0.0.1', port })
    socket.once('connect', () => { socket.destroy(); resolve(true) })
    socket.once('error', () => resolve(false))
    socket.setTimeout(500, () => { socket.destroy(); resolve(false) })
  })
}

async function json(url, init) {
  const response = await fetch(baseURL + url, { ...init, signal: AbortSignal.timeout(9000) })
  const type = response.headers.get('content-type') || ''
  const text = await response.text()
  if (!type.includes('application/json')) throw new Error(`${url} returned ${type || 'no content-type'} rather than JSON: ${text.slice(0, 100)}`)
  return { response: { status: response.status, contentType: type }, body: JSON.parse(text) }
}

export async function checkApiContract() {
  const health = await json('/api/health')
  assertHealth(health.response, health.body, '/api/health')
  const notes = await json('/api/notes')
  if (notes.response.status !== 200 || !Array.isArray(notes.body)) throw new Error('Notes find must return JSON array')
  const marker = `ssr-cert-${Date.now()}-${process.pid}`
  const create = await json('/api/notes', { method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({ title: marker }) })
  if (![200, 201].includes(create.response.status) || create.body.title !== marker) throw new Error('Notes create failed')
  const page = await fetch(baseURL + '/', { signal: AbortSignal.timeout(15000) })
  const html = await page.text()
  if (page.status !== 200 || !page.headers.get('content-type')?.includes('text/html') || !html.includes('Quasar 2 SSR + FeathersJS v5') || !html.includes(marker)) {
    throw new Error('Quasar SSR did not server-render the fresh Feathers note')
  }
  const ticket = await json('/api/tickets', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({title: marker}) })
  if (![200,201].includes(ticket.response.status) || !Number.isInteger(ticket.body.id)) throw new Error('Tickets create failed')
  const ticketId = ticket.body.id
  const loaded = await json(`/api/tickets/${ticketId}`)
  if (loaded.response.status !== 200 || loaded.body.title !== marker) throw new Error('Tickets get failed')
  const invalid = await json('/api/tickets', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({title: ''}) })
  if (invalid.response.status !== 400) throw new Error('Invalid ticket was not rejected with HTTP 400')
  const removed = await json(`/api/tickets/${ticketId}`, { method:'DELETE' })
  if (removed.response.status !== 200) throw new Error('Tickets remove failed')
  console.log('PASS: /api/health JSON, notes CRUD, tickets validation and SSR HTML prefetch')
}

async function waitForReady(child, timeoutMs=150000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`dev:all exited early with ${child.exitCode}`)
    try {
      const {response,body} = await json('/api/health')
      assertHealth(response,body,'/api/health')
      const page = await fetch(baseURL + '/', {signal: AbortSignal.timeout(4000)})
      const html = await page.text()
      if (page.status === 200 && html.includes('Quasar 2 SSR + FeathersJS v5')) return
    } catch { /* Wait for all three processes to become ready. */ }
    await delay(650)
  }
  throw new Error('Timeout while waiting for Feathers/Quasar SSR/edge readiness')
}

async function terminateTree(child) {
  if (!child?.pid) return
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], {windowsHide: true, stdio:'ignore', timeout:10000})
  } else {
    try { process.kill(-child.pid, 'SIGTERM') } catch { try { child.kill('SIGTERM') } catch {} }
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  for (const path of ['package.json','api/server.mjs','scripts/dev-all.mjs','src-ssr/server.ts']) {
    if (!existsSync(join(opts.project,path))) throw new Error(`Missing generated project source: ${path}`)
  }
  const config = join(playwrightCwd, 'playwright.generated-ssr.config.mjs')
  if (!existsSync(config)) throw new Error('Missing generated SSR Playwright config')
  if (!existsSync(join(opts.project, 'node_modules/@vevedh/vite-plugin-feathersjs/package.json'))) throw new Error('Install generated SSR dependencies with corepack pnpm install')
  const cli = await resolveLocalPlaywrightCli(playwrightCwd)
  for (const port of [3030, 3031, 8080, 9100]) {
    if (await probePort(port)) throw new Error(`Port ${port} occupied; refusing to certify an unknown process`)
  }
  console.log(`PRECHECK PASS: generated Quasar SSR, adapter=${opts.adapter}, ports free, Edge CLI available`)
  if (opts.preflight) return
  const logPath=resolve(root,'examples/r17/docs-private/certifications')
  mkdirSync(logPath,{recursive:true})
  const log = []
  const child = spawn(process.execPath, ['scripts/dev-all.mjs'], {
    cwd:opts.project, detached:process.platform!=='win32', windowsHide:true,
    env:{...process.env, FEATHERS_ADAPTER:opts.adapter, FEATHERS_PUBLIC_ORIGIN:baseURL,
      FEATHERS_EDGE_PORT:'8080', FEATHERS_API_PORT:'3030', FEATHERS_SOCKETIO:'0', QUASAR_SSR_PORT:'9100'},
    stdio:['ignore','pipe','pipe'],
  })
  child.on('error', error => { log.push(`spawn failure: ${error.message}`); })
  for (const stream of [child.stdout,child.stderr]) stream.on('data',data=>{
    const line=data.toString(); log.push(line); process.stdout.write(line)
  })
  try {
    await waitForReady(child)
    await checkApiContract()
    console.log('CHECK: Playwright Microsoft Edge (SSR, hydration, CRUD, responsive)')
    const runner = spawn(process.execPath, [cli, 'test', '--config=playwright.generated-ssr.config.mjs'], {
      cwd:playwrightCwd, windowsHide:true, env:{...process.env, R17_SSR_BASE_URL:baseURL},
      stdio:'inherit',
    })
    const code = await new Promise((resolveExit,reject)=>{runner.once('error',reject);runner.once('exit',c=>resolveExit(c))})
    if (code !== 0) throw new Error(`Edge Playwright failed with exit ${code}`)
    console.log(`PASS: Quasar SSR generated HTTP + Edge adapter=${opts.adapter}`)
  } finally {
    await terminateTree(child)
    writeFileSync(join(logPath,`quasar-ssr-generated-${opts.adapter}-${Date.now()}.log`),log.join(''), 'utf8')
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error=>{console.error('FAIL:',error.message);process.exitCode=1})
