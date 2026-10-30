import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const basic = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dir = resolve(basic, '../../docs-private')
const names = readdirSync(dir).filter(name => /^basic-r14-(full|fast)-run[1-3]\.json$/.test(name))
if (!names.length) throw new Error('No basic-r14-* benchmark files found')
function median(numbers) {
  const values = [...numbers].sort((a,b) => a-b)
  const center = Math.floor(values.length / 2)
  return values.length ? (values.length % 2 ? values[center] : (values[center-1] + values[center])/2) : null
}
const rows = names.flatMap(name => {
  const profile = name.includes('-fast-') ? 'fast' : 'full'
  const report = JSON.parse(readFileSync(resolve(dir,name), 'utf8'))
  return report.cases.map(item => ({ profile, mode: item.label, readyMs: item.readyMs, status: item.status, source: name }))
})
const summaries = []
for (const mode of ['koa-rest','express-rest','koa+socketio','express+socketio']) {
  for (const profile of ['full','fast']) {
    const found = rows.filter(row => row.mode === mode && row.profile === profile)
    if (!found.length || found.some(row => row.status !== 'PASS' || typeof row.readyMs !== 'number'))
      throw new Error(`Missing or failed benchmark: ${profile} ${mode}`)
    summaries.push({profile,mode,samples:found.length,medianReadyMs:median(found.map(row=>row.readyMs))})
  }
}
const full = median(summaries.filter(r=>r.profile==='full').map(r=>r.medianReadyMs))
const fast = median(summaries.filter(r=>r.profile==='fast').map(r=>r.medianReadyMs))
const destination = resolve(dir,'basic-r14-performance-analysis.json')
writeFileSync(destination,JSON.stringify({generatedAt:new Date().toISOString(),profiles:['full','fast'],comparisonNote:'Different samples; lower startup time is not guaranteed.',aggregateMedianOfModeMedians:{full,fast},summaries,rows},null,2)+'\n')
console.log(`PASS: r14 full=${full}ms fast=${fast}ms (median of mode medians; not a paired causal estimate)`)
console.log(`Report: ${destination}`)
