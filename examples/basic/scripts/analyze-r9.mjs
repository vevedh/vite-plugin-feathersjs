import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../docs-private')
const input = path.join(dir, 'basic-r8-alternated-profile.json')
const output = path.join(dir, 'basic-r9-stage-analysis.json')
const source = JSON.parse(await readFile(input, 'utf8'))
const rows = []
const median = values => {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}
for (const result of source.results ?? []) {
  for (const entry of result.cases ?? []) {
    if (entry.status !== 'PASS' || !Array.isArray(entry.timings)) continue
    const stamps = new Map(entry.timings.map(t => [t.phase, t.msFromSpawn]))
    const config = stamps.get('vite.config.resolved')
    const ready = entry.readyMs
    const loaded = stamps.get('feathers.modules.load.end')
    const begun = stamps.get('feathers.modules.load.start')
    const start = stamps.get('feathers.discovery.start')
    const end = stamps.get('feathers.transport.ready')
    if (![config, ready, loaded, begun, start, end].every(Number.isFinite)) continue
    rows.push({ run: result.run, profile: result.profile, mode: entry.label, readyMs: ready,
      beforeConfigMs: config, afterConfigMs: ready - config,
      feathersMs: end - start, serviceLoadMs: loaded - begun,
      beforeConfigPercent: Math.round(config / ready * 1000) / 10,
      viteConfigDebug: entry.viteConfigDebug ?? [] })
  }
}
if (!rows.length) throw new Error('No complete R8 timing records available for R9 analysis')
const summary = [...new Set(rows.map(r => `${r.profile}|${r.mode}`))].map(key => {
  const group = rows.filter(r => `${r.profile}|${r.mode}` === key)
  return { profile: group[0].profile, mode: group[0].mode, samples: group.length,
    medianReadyMs: median(group.map(r => r.readyMs)),
    medianBeforeConfigMs: median(group.map(r => r.beforeConfigMs)),
    medianFeathersMs: median(group.map(r => r.feathersMs)),
    medianBeforeConfigPercent: median(group.map(r => r.beforeConfigPercent)) }
})
await mkdir(dir, { recursive: true })
await writeFile(output, JSON.stringify({ generatedAt: new Date().toISOString(), source: 'basic-r8-alternated-profile.json', rows, summary }, null, 2))
for (const s of summary) console.log(`${s.profile} ${s.mode}: before Vite config ${s.medianBeforeConfigMs}ms / ready ${s.medianReadyMs}ms (${s.medianBeforeConfigPercent}%), Feathers ${s.medianFeathersMs}ms`)
console.log(`Report: ${output}`)
