import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
const dir=join(dirname(fileURLToPath(import.meta.url)),'..','dist','ssr')
const a=process.argv.slice(2),install=a.includes('--install'),check=a.includes('--check')
if(install===check)throw Error('Use --check or --install')
const manifest=join(dir,'package.json'),lock=join(dir,'pnpm-lock.yaml')
for(const p of [manifest,lock])if(!existsSync(p))throw Error('Missing production artifact: '+p)
const pkg=JSON.parse(readFileSync(manifest,'utf8'))
if(pkg.dependencies?.['@vevedh/vite-plugin-feathersjs']!=='0.2.7'||!pkg.dependencies?.['serialize-javascript'])throw Error('Unexpected production dependencies')
if(install){const result=spawnSync('corepack',['pnpm','install','--prod','--ignore-scripts','--frozen-lockfile'],{cwd:dir,stdio:'inherit',shell:process.platform==='win32',windowsHide:true});if(result.error||result.status!==0)throw Error('Frozen production install failed')}
const verify=spawnSync(process.execPath,[join(dirname(fileURLToPath(import.meta.url)),'production-deps.mjs')],{cwd:join(dir,'..','..'),stdio:'inherit',windowsHide:true})
if(verify.error||verify.status!==0)throw Error('Production dependencies check failed')
console.log('R12_R2B_R4_PRODUCTION_LOCK=PASS')
