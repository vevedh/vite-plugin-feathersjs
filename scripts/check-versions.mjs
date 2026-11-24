import { spawnSync } from 'node:child_process'
import { readFileSync, statSync } from 'node:fs'
import { isAbsolute } from 'node:path'
const npm = process.env.npm_execpath
if (!npm || !isAbsolute(npm) || !statSync(npm).isFile() || !/[\\/]npm-cli\.js$/.test(npm)) throw Error('Run via npm run versions:check')
const p = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const names = [...new Set(['dependencies','devDependencies','peerDependencies'].flatMap(k=>Object.keys(p[k]??{})))].sort()
for (const name of names) {
  if (!/^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/.test(name)) throw Error('Invalid package name')
  const r = spawnSync(process.execPath,[npm,'view',name,'version','--json','--registry=https://registry.npmjs.org/','--fetch-retries=0','--fetch-timeout=5000'],{encoding:'utf8',timeout:10000,shell:false})
  if (r.status!==0) throw Error('Registry read failed')
  const latest=JSON.parse(r.stdout); if (typeof latest!=='string' || !/^[0-9][0-9A-Za-z.+-]*$/.test(latest)) throw Error('Invalid registry response')
  console.log(`${name}: ${latest}`)
}
