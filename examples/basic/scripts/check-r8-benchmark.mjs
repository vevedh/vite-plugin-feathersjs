import { spawn } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { boundedEnvInteger } from './e2e-env.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const runs = boundedEnvInteger(process.env.FEATHERS_R8_RUNS, 'FEATHERS_R8_RUNS', 3, 1, 5)
const reportDir = path.resolve(here, '../../../docs-private')
await mkdir(reportDir, { recursive: true })
const results = []
let failed = false
for (let run = 1; run <= runs; run++) {
  const profiles = run % 2 === 1 ? ['Full', 'Transport'] : ['Transport', 'Full']
  for (const profile of profiles) {
    const file = path.join(reportDir, `basic-r8-${profile.toLowerCase()}-run${run}.json`)
    const child = spawn(process.execPath, [path.join(here, 'check-basic-e2e.mjs')], {
      cwd: path.resolve(here, '..'),
      env: { ...process.env, FEATHERS_E2E_RUNS: '1', FEATHERS_R8_TRACE: '1', FEATHERS_TRANSPORT_PROFILE: profile === 'Transport' ? '1' : '0', FEATHERS_E2E_PROFILE_LABEL: profile.toLowerCase(), FEATHERS_E2E_REPORT_PATH: file },
      stdio: 'inherit', windowsHide: true,
    })
    const exitCode = await new Promise(resolve => { child.once('exit', code => resolve(code ?? 1)); child.once('error', () => resolve(1)) })
    if (exitCode !== 0) failed = true
    try { results.push({ run, profile, ...JSON.parse(await readFile(file, 'utf8')) }) }
    catch { failed = true; results.push({ run, profile, error: `Missing result: ${file}` }) }
  }
}
const med = numbers => {
  if (!numbers.length) return null
  const sorted = [...numbers].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}
const summaries = ['Full', 'Transport'].map(profile => ({
  profile,
  cases: ['koa-rest', 'express-rest', 'koa+socketio', 'express+socketio'].map(label => {
    const values = results.filter(r => r.profile === profile).flatMap(r => r.cases ?? []).filter(c => c.label === label && c.status === 'PASS').map(c => c.readyMs)
    return { label, samples: values.length, medianMs: med(values) }
  }),
}))
const finalPath = path.join(reportDir, 'basic-r8-alternated-profile.json')
await writeFile(finalPath, JSON.stringify({ generatedAt: new Date().toISOString(), runs, results, summaries }, null, 2))
console.log(`R8 report: ${finalPath}`)
if (failed) process.exitCode = 1
