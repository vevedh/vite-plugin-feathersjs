import { createHash, randomUUID } from 'node:crypto'
import { lstatSync, readFileSync, writeFileSync, mkdirSync, renameSync, unlinkSync, rmdirSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { plan, generateFiles } from './schema-build.mjs'
const hash=x=>createHash('sha256').update(x).digest('hex')
const norm=x=>x.toString('utf8').replace(/\r\n/g,'\n')
const encode=x=>JSON.stringify(x,null,2)+'\n'
const methods=['find','get','create','patch','remove']
const fail=x=>{throw Error(x)}
const nameOk=x=>typeof x==='string'&&x.length<=48&&/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(x)&&! /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(x)
const reserved=new Set(['notes','health','users','authentication','keycloak-session','internal-probe','doc-api','docs'])
const registryMarker='const modules = [\n'
// Exact server shape from the upstream rc.10 template, with the captured scaffold's capability prefix.
// Only registry entries may vary; arbitrary application/server code is never rewritten.
const referenceServer=`import { assertCapabilities } from './config/capabilities.mjs'
assertCapabilities()
import { createServer } from 'node:http'
import { createFeathersRuntime } from '@vevedh/vite-plugin-feathersjs'
const adapter = process.env.FEATHERS_ADAPTER === 'express' ? 'express' : 'koa'
const port = Number(process.env.FEATHERS_API_PORT || 3030)
const wsPort = Number(process.env.FEATHERS_SOCKET_PORT || 3031)
const realtime = process.env.FEATHERS_SOCKETIO === '1'
const origin = process.env.FEATHERS_PUBLIC_ORIGIN || 'http://127.0.0.1:5173'
const previewOrigin = process.env.FEATHERS_PREVIEW_ORIGIN || 'http://127.0.0.1:4173'
if (!Number.isInteger(port) || port < 1024 || port > 65535 || !Number.isInteger(wsPort) || wsPort === port) throw new Error('Invalid port configuration')
const modules = [
  new URL('./services/health/health.service.mjs', import.meta.url),
  new URL('./services/notes/notes.service.mjs', import.meta.url),
]
const runtime = await createFeathersRuntime(modules.map(String), file => import(file), {
  serviceFiles: [], adapter, prefix: '/api', cors: false,
  socketio: realtime ? { port: wsPort, origins: [...new Set([origin, previewOrigin])], host: '127.0.0.1' } : false,
})
await runtime.start()
const httpServer = createServer((req, res) => {
  const pathname = new URL(req.url || '/', 'http://localhost').pathname
  if (pathname !== '/api' && !pathname.startsWith('/api/')) {
    res.writeHead(404, { 'content-type': 'application/json' }); res.end('{"error":"Not found"}'); return
  }
  // The Feathers transport is mounted at /api, while its services register as health/notes.
  req.url = (req.url || '/').slice(4) || '/'
  runtime.handler(req, res, error => {
    if (res.headersSent) { res.end(); return }
    res.writeHead(500, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ error: 'Internal server error' }))
    if (error) console.error('[feathers] request failed')
  })
})
await new Promise((resolve, reject) => {
  httpServer.once('error', reject)
  httpServer.listen(port, '127.0.0.1', resolve)
})
console.log(\`Feathers \${adapter} API listening on http://127.0.0.1:\${port}/api (socketio=\${realtime})\`)
let stopping = false
async function close() {
  if (stopping) return
  stopping = true
  await new Promise(resolve => httpServer.close(resolve))
  await runtime.close()
}
process.on('SIGINT', () => { void close().then(() => process.exit(0)) })
process.on('SIGTERM', () => { void close().then(() => process.exit(0)) })
`
const referenceDevAll=`#!/usr/bin/env node
// Starts Feathers first, then the frontend, with one controlled shutdown.
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { loadEnvFile } from 'node:process'
import { setTimeout as sleep } from 'node:timers/promises'

const file=existsSync('.env') ? '.env' : '.env.example'
if(!existsSync(file))throw new Error('Missing .env.example')
loadEnvFile(file)
const usesVite=existsSync('src/main.ts')
const isSSG=existsSync('scripts/serve-static.mjs')
const env={...process.env}
const processes=[]
let stopped=false
function stop(code=0){
  if(stopped)return
  stopped=true
  for(const p of [...processes].reverse())if(p.exitCode===null)try{p.kill()}catch{}
  process.exitCode=code
}
process.on('SIGINT',()=>stop(130))
process.on('SIGTERM',()=>stop(143))
const api=spawn(process.execPath,[\`--env-file=\${file}\`,'api/server.mjs'],{env,stdio:'inherit',windowsHide:true})
processes.push(api)
api.once('error',err=>{console.error('Feathers:',err.message);stop(1)})
api.once('exit',code=>{if(!stopped){console.error('Feathers stopped:',code);stop(code||1)}})
const port=Number(env.FEATHERS_API_PORT||3030)
let ready=false
for(let i=0;i<80 && !stopped;i++){
  if(api.exitCode!==null)break
  try {
    const res=await fetch(\`http://127.0.0.1:\${port}/api/health\`,{signal:AbortSignal.timeout(700)})
    if(res.ok && (await res.json()).transport==='feathers-v5'){ready=true;break}
  }catch{}
  await sleep(200)
}
if(!ready){console.error('API Feathers non disponible sur 127.0.0.1:'+port);stop(1)}
if(!stopped){
  const args=usesVite?['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5173','--strictPort']
    :[isSSG?'node_modules/vite/bin/vite.js':'scripts/serve-ssr.mjs',...(isSSG?['--host','127.0.0.1','--port','5173','--strictPort']:[])]
  const ui=spawn(process.execPath,args,{env,stdio:'inherit',windowsHide:true})
  processes.push(ui)
  ui.once('error',err=>{console.error('Frontend:',err.message);stop(1)})
  ui.once('exit',code=>{if(!stopped){console.error('Frontend stopped:',code);stop(code||1)}})
}
`
const patchedDevAll=referenceDevAll.replace("const api=spawn(process.execPath,[", "const api=spawn(process.execPath,['--import','tsx',")
export {referenceServer,referenceDevAll}
function stat(p){try{return lstatSync(p)}catch(e){if(e.code==='ENOENT')return null;throw e}}
function safe(p){for(let x=p;;x=dirname(x)){const s=stat(x);if(s?.isSymbolicLink())fail('SYMLINK_REFUSED');if(x===dirname(x))break}}
function regular(p){safe(p);const s=stat(p);if(!s?.isFile()||s.size>1024*1024)fail('SOURCE_MISSING_OR_INVALID');return readFileSync(p)}
function object(p){const v=JSON.parse(norm(regular(p)));if(!v||typeof v!=='object'||Array.isArray(v))fail('INVALID_PROJECT_JSON');return v}
function parseArgs(args){const name=args[0];if(!nameOk(name)||reserved.has(name))fail('INVALID_SERVICE_NAME');const flags=new Map();for(let i=1;i<args.length;i++){const key=args[i];if(!['--project','--fields','--schema','--db','--api-docs','--dry-run','--json'].includes(key)||flags.has(key))fail('INVALID_OR_DUPLICATE_OPTION');if(['--dry-run','--json'].includes(key)){flags.set(key,true);continue}const value=args[++i];if(!value||value.startsWith('--'))fail('MISSING_VALUE');flags.set(key,value)}const dir=flags.get('--project')??'.';if(dir!=='.'&&!nameOk(dir))fail('UNSAFE_PROJECT_PATH');const docs=flags.get('--api-docs')??'off';if(!['off','vitepress'].includes(docs))fail('SCHEMA_ADD_SWAGGER_PENDING_R14_S3');return {name,dir,flags,docs,dryRun:flags.has('--dry-run')}}
function registry(source,root){const s=norm(source);const match=/const modules = \[\n([\s\S]*?)\n\]/.exec(s);if(!match||s.split(registryMarker).length!==2)fail('REGISTRY_SHAPE_REFUSED');const lines=match[1].split('\n');const names=new Set();for(const line of lines){const m=/^  new URL\('\.\/services\/([a-z][a-z0-9-]*)\/\1\.service\.(mjs|ts)', import\.meta\.url\),$/.exec(line);if(!m||!nameOk(m[1])||names.has(m[1]))fail('REGISTRY_ENTRY_REFUSED');names.add(m[1]);regular(join(root,'api/services',m[1],`${m[1]}.service.${m[2]}`))}if(!names.has('health')||!names.has('notes'))fail('REGISTRY_BASELINE_REFUSED');const expected=referenceServer.replace(/const modules = \[\n[\s\S]*?\n\]/,match[0]);if(s.trimEnd()!==expected.trimEnd())fail('SERVER_SOURCE_DRIFT');return {source:s,names}}
const tsConfig={compilerOptions:{target:'ES2022',lib:['ES2022'],module:'NodeNext',moduleResolution:'NodeNext',strict:true,exactOptionalPropertyTypes:true,noUncheckedIndexedAccess:true,esModuleInterop:true,skipLibCheck:true,noEmit:true,types:['node']},files:[]}
const docsConfig=`import { defineConfig } from 'vitepress'
import { readdirSync } from 'node:fs'
import { resolve } from 'node:path'
const names = readdirSync(resolve(process.cwd(), 'docs/api-schema/services')).filter(name => /^[a-z][a-z0-9-]*\\.md$/.test(name)).sort()
export default defineConfig({ lang:'fr', title:'Documentation API', themeConfig:{ search:{provider:'local'},sidebar:[{text:'Services',items:names.map(name=>({text:name.slice(0,-3),link:'/services/'+name.slice(0,-3)}))}] } })
`
const docsIndex='# Documentation API\n\nSélectionnez un service dans le menu. Les contrats sont générés à partir des définitions du Schema Builder. Démonstration locale, mémoire uniquement.\n'
function same(p,content){return stat(p)?.isFile()&&norm(regular(p)).trimEnd()===content.trimEnd()}
function makePlan(args,cwd){const o=parseArgs(args);const root=resolve(cwd,o.dir);safe(root);if(!stat(root)?.isDirectory())fail('PROJECT_NOT_FOUND');const profile=object(join(root,'api/config/profile.json'));const manifest=object(join(root,'package.json'));const db=o.flags.get('--db')??profile.primary
 if(profile.auth!=='none'||profile.operational!==true||profile.cache!=='none'||profile.storage!=='none'||profile.databaseMode!=='single'||!Array.isArray(profile.databases)||profile.databases.length!==1||profile.primary!==db||profile.databases[0]?.alias!==db||profile.databases[0]?.adapter!=='memory')fail('UNSUPPORTED_AUTH_OR_DATABASE_PROFILE')
 if(manifest.private!==true||manifest.type!=='module'||manifest.version!=='0.1.0'||manifest.dependencies?.['@vevedh/vite-plugin-feathersjs']!=='0.2.7'||manifest.dependencies?.['@feathersjs/feathers']!=='5.0.50'||manifest.dependencies?.['@feathersjs/errors']!=='5.0.50'||!manifest.dependencies?.vue||!manifest.dependencies?.pinia||!manifest.devDependencies?.vite||manifest.devDependencies?.['vite-plugin-pwa']||manifest.scripts?.['dev:all']!=='node scripts/dev-all.mjs'||!['node --env-file=.env.example api/server.mjs','node --import tsx --env-file=.env.example api/server.mjs'].includes(manifest.scripts?.['dev:api']))fail('UNSUPPORTED_PROJECT_RUNTIME')
 const env=norm(regular(join(root,'.env.example')));if(!/^FEATHERS_ADAPTER=express$/m.test(env)||!/^FEATHERS_SOCKETIO=0$/m.test(env)||!/^VITE_FEATHERS_REALTIME=0$/m.test(env)||/^FEATHERS_ADAPTER=(?!express$)/m.test(env)||/^FEATHERS_SOCKETIO=(?!0$)/m.test(env))fail('EXPRESS_REST_ONLY')
 for(const file of ['compose.yaml','compose.yml','docker-compose.yml','docker-compose.yaml','Dockerfile'])if(stat(join(root,file)))fail('COMPOSE_PROFILE_NOT_CERTIFIED')
 const p=plan(o.name,o.flags.get('--fields'),o.flags.get('--schema')??profile.schema,o.docs);const serverPath=join(root,'api/server.mjs');const serverBytes=regular(serverPath);const reg=registry(serverBytes,root);if(reg.names.has(o.name))fail('SERVICE_ALREADY_REGISTERED')
 const dest=join(root,'api/services',o.name);safe(dest);if(stat(dest))fail('SERVICE_ALREADY_EXISTS');const lock=join(root,'api/.create-feathers-service.lock');safe(lock);if(stat(lock))fail('INSTALL_LOCK_PRESENT');const ignored=norm(regular(join(root,'.gitignore')));if(!ignored.split('\n').includes('.ai/'))fail('PRIVATE_BACKUP_IGNORE_REQUIRED')
 const generated=generateFiles(p);const prefix=`src/services/${o.name}/${o.name}`;const rel=`api/services/${o.name}/${o.name}`;const additions=new Map();for(const suffix of ['.schema.ts','.class.ts','.shared.ts']){const source=generated.get(prefix+suffix);additions.set(rel+suffix,suffix==='.shared.ts'?source.replace(`'api/${o.name}'`,`'${o.name}'`):source)};const registrar=generated.get(prefix+'.ts').replace('export function register','export default function register').replace(`app.use('api/${o.name}'`,`app.use('${o.name}'`).replace('export default function register(app:Application):void {',"export default function register(app:Application):void {\n if (process.env.FEATHERS_ADAPTER !== 'express' || process.env.FEATHERS_SOCKETIO !== '0') throw new Error('Schema service requires Express REST, local lab only')");additions.set(rel+'.service.ts',registrar);additions.set(`api/services/${o.name}/contract.json`,encode(p))
 const changes=new Map();const nextServer=reg.source.replace(registryMarker,registryMarker+`  new URL('./services/${o.name}/${o.name}.service.ts', import.meta.url),\n`);changes.set('api/server.mjs',serverBytes.includes(Buffer.from('\r\n'))?nextServer.replace(/\n/g,'\r\n'):nextServer)
 const devAllPath='scripts/dev-all.mjs';const devAll=norm(regular(join(root,devAllPath))).trimEnd();if(devAll===referenceDevAll.trimEnd())changes.set(devAllPath,regular(join(root,devAllPath)).includes(Buffer.from('\r\n'))?patchedDevAll.replace(/\n/g,'\r\n'):patchedDevAll);else if(devAll!==patchedDevAll.trimEnd())fail('DEV_ALL_SOURCE_DRIFT')
 const cfgPath='api/tsconfig.schema.json';const cfg=structuredClone(tsConfig);if(stat(join(root,cfgPath))){const prev=object(join(root,cfgPath));if(JSON.stringify(prev.compilerOptions)!==JSON.stringify(tsConfig.compilerOptions)||!Array.isArray(prev.files)||prev.files.some(x=>typeof x!=='string'||!/^services\/[a-z][a-z0-9-]*\/[a-z][a-z0-9-]*\.(?:schema|class|shared|service)\.ts$/.test(x)))fail('SCHEMA_TSCONFIG_DRIFT');for(const f of prev.files)regular(join(root,'api',f));cfg.files.push(...prev.files)}cfg.files.push(...[...additions.keys()].filter(x=>x.endsWith('.ts')).map(x=>x.slice(4)));cfg.files.sort();if(new Set(cfg.files).size!==cfg.files.length)fail('SCHEMA_TSCONFIG_DUPLICATE');(stat(join(root,cfgPath))?changes:additions).set(cfgPath,encode(cfg))
 const dependencies={...manifest.dependencies};const devDependencies={...manifest.devDependencies};const scripts={...manifest.scripts};const lab=JSON.parse(generated.get('package.json'));for(const dep of p.schema==='zod'?['zod']:p.schema==='json'?['ajv']:['ajv','@feathersjs/typebox']){const wanted=lab.dependencies[dep];if(dependencies[dep]&&dependencies[dep]!==wanted)fail('DEPENDENCY_VERSION_CONFLICT');dependencies[dep]=wanted}devDependencies.tsx??='^4.20.0';devDependencies.typescript??='^5.9.3';devDependencies['@types/node']??='^22.0.0';scripts['dev:api']='node --import tsx --env-file=.env.example api/server.mjs';const check='tsc --noEmit -p api/tsconfig.schema.json';if(scripts['typecheck:schema']&&scripts['typecheck:schema']!==check)fail('SCRIPT_CONFLICT');scripts['typecheck:schema']=check;for(const key of ['typecheck','build']){if(typeof scripts[key]!=='string')fail('SCRIPT_CONFLICT');if(!scripts[key].includes('npm run typecheck:schema'))scripts[key]+=' && npm run typecheck:schema'}
 if(o.docs==='vitepress'){const dp='docs/api-schema/';const doc=generated.get(`docs/services/${o.name}.md`);additions.set(dp+`services/${o.name}.md`,doc);for(const [target,contents] of [[dp+'index.md',docsIndex],[dp+'.vitepress/config.ts',docsConfig]]){if(stat(join(root,target))){if(!same(join(root,target),contents))fail('DOCS_SOURCE_CONFLICT')}else additions.set(target,contents)}if(devDependencies.vitepress&&devDependencies.vitepress!=='1.6.4')fail('DEPENDENCY_VERSION_CONFLICT');devDependencies.vitepress='1.6.4';const build='vitepress build docs/api-schema';if(scripts['docs:schema:build']&&scripts['docs:schema:build']!==build)fail('SCRIPT_CONFLICT');scripts['docs:schema:build']=build}
 changes.set('package.json',encode({...manifest,dependencies,devDependencies,scripts}));for(const path of additions.keys()){safe(join(root,path));if(stat(join(root,path)))fail('DESTINATION_CONFLICT')}
 const originals=new Map([...changes.keys()].map(path=>[path,regular(join(root,path))]));const output={status:o.dryRun?'SCHEMA_ADD_DRY_RUN':'SCHEMA_SERVICE_ADDED',project:root,name:o.name,schema:p.schema,apiDocs:o.docs,route:`/api/${o.name}`,db,auth:'none',adapter:'express',transport:'rest',files:[...additions.keys(),...changes.keys()],runtimeCertified:false,dependencyInstallRequired:true,swagger:'NOT_ENABLED_R14_S3'};return {o,root,lock,additions,changes,originals,output}
}
function mkdirTracked(path,created){safe(path);if(stat(path)){if(!stat(path).isDirectory())fail('DIRECTORY_CONFLICT');return}mkdirTracked(dirname(path),created);mkdirSync(path);created.push(path)}
function atomic(path,bytes){const temp=path+'.r14-'+randomUUID()+'.tmp';try{writeFileSync(temp,bytes,{flag:'wx',mode:stat(path)?.mode??0o600});renameSync(temp,path)}finally{if(stat(temp))unlinkSync(temp)}}
export function runSchemaAdd(args,cwd=process.cwd()){const a=makePlan(args,cwd);if(a.o.dryRun)return a.output;writeFileSync(a.lock,'schema add in progress\n',{flag:'wx'});const dirs=[],added=[],changed=[];let backup;try{for(const [p,b] of a.originals)if(hash(regular(join(a.root,p)))!==hash(b))fail('CONCURRENT_PROJECT_CHANGE');for(const p of a.additions.keys()){safe(join(a.root,p));if(stat(join(a.root,p)))fail('DESTINATION_CONFLICT')}
 backup=join(a.root,'.ai/patch-memory/R14-S2-R3',a.o.name+'-'+randomUUID());mkdirTracked(backup,dirs);for(const [p,b] of a.originals){const file=join(backup,p);mkdirTracked(dirname(file),dirs);writeFileSync(file,b,{flag:'wx'})}writeFileSync(join(backup,'receipt.json'),encode({before:Object.fromEntries([...a.originals].map(([p,b])=>[p,hash(b)])),added:Object.fromEntries([...a.additions].map(([p,b])=>[p,hash(b)])),after:Object.fromEntries([...a.changes].map(([p,b])=>[p,hash(b)]))}),{flag:'wx'})
 for(const [p,b] of a.additions){const path=join(a.root,p);mkdirTracked(dirname(path),dirs);writeFileSync(path,b,{flag:'wx'});added.push([path,b])}for(const [p,b] of a.changes){const path=join(a.root,p);if(hash(regular(path))!==hash(a.originals.get(p)))fail('CONCURRENT_PROJECT_CHANGE');atomic(path,b);changed.push([p,b])}
 }catch(e){const failures=[];for(const [p,b] of changed.reverse())try{const path=join(a.root,p);if(hash(regular(path))!==hash(b))fail('CONCURRENT_PROJECT_CHANGE');atomic(path,a.originals.get(p))}catch(err){failures.push(err)}for(const [path,b] of added.reverse())try{if(hash(regular(path))!==hash(b))fail('CONCURRENT_PROJECT_CHANGE');unlinkSync(path)}catch(err){failures.push(err)}for(const path of dirs.reverse())try{rmdirSync(path)}catch{}if(failures.length)fail('ROLLBACK_INCOMPLETE');throw e}finally{unlinkSync(a.lock)}return {...a.output,backup}
}
