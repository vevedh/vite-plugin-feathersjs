import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp,readFile,lstat,rm,cp,mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join,resolve,dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createGenerator } from '../packages/create-feathers-app/lib/scaffold.mjs'
import { parseServiceArguments,generateService } from '../packages/create-feathers-app/lib/services.mjs'
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..')
// Isolated fixtures: npm package tests re-stage .release concurrently on Node --test.
const fixtures=await mkdtemp(join(tmpdir(),'r17-fixture-'))
const templates=resolve(root,'examples/r17/templates')
const mk=(dir)=>createGenerator({outputRoot:dir,templatesRoot:templates,examplesRoot:resolve(root,'examples/r17')})
const fixtureSSR=resolve(fixtures,'quasar-ssr')
await mkdir(fixtureSSR,{recursive:true})
for(const asset of ['.env.example','.gitignore','index.html','quasar.config.ts','tsconfig.json','src','src-ssr','api']){
 await cp(resolve(root,'examples/quasar-ssr',asset),resolve(fixtureSSR,asset),{recursive:true})
}
await mkdir(resolve(fixtureSSR,'scripts'),{recursive:true})
for(const asset of ['edge-proxy.mjs','edge-routing.mjs'])await cp(resolve(root,'examples/quasar-ssr/scripts',asset),resolve(fixtureSSR,'scripts',asset))
await cp(resolve(root,'examples/r17/daisyui-ssr'),resolve(fixtures,'daisyui-ssr'),{recursive:true,filter:path=>!['node_modules','dist','docs-private'].includes(path.split(/[\\/]/).at(-1))})
await cp(resolve(root,'examples/r17/daisyui-ssg'),resolve(fixtures,'daisyui-ssg'),{recursive:true,filter:path=>!['node_modules','dist','docs-private'].includes(path.split(/[\\/]/).at(-1))})


test('Quasar 2 SSR is independently generated with scoped npm plugin and loopback proxy',async()=>{
 const temp=await mkdtemp(join(tmpdir(),'r17-ssr-'))
 try {
  const generator=createGenerator({outputRoot:temp,templatesRoot:templates,examplesRoot:fixtures})
  const o=generator.parse(['quasar-server','--ui','quasar2','--render','ssr','--adapter','express'])
  const result=await generator.generate(o)
  assert.ok(result.files.includes('src-ssr/server.ts'))
  assert.ok(result.files.includes('scripts/edge-proxy.mjs'))
  assert.ok(result.files.includes('scripts/dev-all.mjs'))
  const manifest=JSON.parse(await readFile(join(temp,'quasar-server/package.json'),'utf8'))
  assert.equal(manifest.devDependencies['@quasar/app-vite'],'2.6.2')
  // The v2 server runs Express 4; pnpm must never mix its core types with v5.
  assert.equal(manifest.dependencies.express,'^4.22.3')
  assert.equal(manifest.devDependencies['@types/express'],'4.17.25')
  assert.equal(manifest.devDependencies['@types/express-serve-static-core'],'4.19.9')
  assert.deepEqual(manifest.pnpm.overrides,{
    '@types/express':'4.17.25',
    '@types/express-serve-static-core':'4.19.9'
  })
  assert.equal(manifest.dependencies['@vevedh/vite-plugin-feathersjs'],'0.2.6')
  assert.ok(!JSON.stringify(manifest).includes('file:../..'))
  assert.match(await readFile(join(temp,'quasar-server/api/server.mjs'),'utf8'), /@vevedh\/vite-plugin-feathersjs/)
  assert.match(await readFile(join(temp,'quasar-server/index.html'),'utf8'),/r17-example" content="quasar-ssr"/)
  assert.match(await readFile(join(temp,'quasar-server/.env.example'),'utf8'),/FEATHERS_ADAPTER=express/)
  assert.ok(result.files.includes('.gitignore'))
 } finally {await rm(temp,{recursive:true,force:true})}
})

test('service add generates three distinct validators and registers a Feathers module once',async()=>{
 const temp=await mkdtemp(join(tmpdir(),'r17-services-'))
 try {
  const generator=mk(temp)
  const o=generator.parse(['app','--ui','daisyui','--render','spa'])
  await generator.generate(o)
  for(const schema of ['typebox','json','zod']){
   const name='tickets-'+schema
   const args=parseServiceArguments(['add',name,'--project','app','--schema',schema])
   const dry=await generateService({...args,dryRun:true},temp)
   assert.equal(dry.schema,schema)
   await assert.rejects(lstat(join(temp,'app/api/services',name)))
   await generateService(args,temp)
   const source=await readFile(join(temp,'app/api/services',name,'schema.mjs'),'utf8')
   assert.match(source,/validateData/)
   if(schema==='zod')assert.match(source,/safeParse/)
   if(schema==='typebox')assert.match(source,/@feathersjs\/typebox/)
   if(schema==='json')assert.match(source,/new Ajv/)
   await assert.rejects(generateService(args,temp),/exists/)
  }
  const server=await readFile(join(temp,'app/api/server.mjs'),'utf8')
  for(const schema of ['typebox','json','zod'])assert.match(server,new RegExp(`services/tickets-${schema}/`))
 } finally {await rm(temp,{recursive:true,force:true})}
})

test('non-operational database and identity profiles refuse to start',async()=>{
 const temp=await mkdtemp(join(tmpdir(),'r17-profiles-'))
 try{
  const g=mk(temp)
  for(const [name,flags,lookFor] of [
   ['remote',['--db','main:postgresql,audit:mongodb'],'Database adapters not provisioned'],
   ['identity',['--auth','keycloak'],'Authentication keycloak'],
   ['oauth',['--auth','oauth2'],'Authentication oauth2'],
   ['jwt',['--auth','jwt'],'Authentication jwt'],
  ]){
   const o=g.parse([name,'--ui','daisyui',...flags]);await g.generate(o)
   const {assertCapabilities}=await import('file://'+join(temp,name,'api/config/capabilities.mjs').replaceAll('\\','/'))
   assert.throws(assertCapabilities,new RegExp(lookFor))
  }
 }finally{await rm(temp,{recursive:true,force:true})}
})

test('service and project options reject traversal, bad aliases, unsupported providers',async()=>{
 for(const args of [['add','../wrong'],['add','con'],['add','notes','--project','../other'],['add','notes','--schema','yaml'],['add','notes','--auth','oauth2']]){
  assert.throws(()=>parseServiceArguments(args))
 }
 const temp=await mkdtemp(join(tmpdir(),'r17-invalid-'))
 try{
  const g=mk(temp)
  for(const args of [['x','--auth','ldap'],['x','--schema','yaml'],['x','--db','foo:unrecognized'],['x','--db','main:memory,main:mongodb'],['x','--ui','quasar2','--render','ssg']])assert.throws(()=>g.parse(args))
 }finally{await rm(temp,{recursive:true,force:true})}
})

test('GitHub Pages workflow is limited to docs changes and deploys to the correct subpath',async()=>{
 const workflow=await readFile(resolve(root,'.github/workflows/cli-vitepress-pages.yml'),'utf8')
 assert.match(workflow,/VITEPRESS_BASE: \/vite-plugin-feathersjs\//)
 assert.match(workflow,/pages: write/)
 assert.match(workflow,/id-token: write/)
 assert.doesNotMatch(workflow,/npm publish|NPM_TOKEN/)
})

test('published npm Windows certification uses collision-free projects for repeated Koa/Express runs',async()=>{
 const script=await readFile(resolve(root,'scripts/r17/certify-published-npm-windows.ps1'),'utf8')
 assert.match(script,/\$runId=\[guid\]::NewGuid\(\)\.ToString\('N'\)\.Substring\(0,12\)/)
 assert.match(script,/\$projectName="npm-\$\{Adapter\}-\$\{runId\}-\$\(\$item\.Suffix\)"/)
 assert.match(script,/if\(Test-Path \$folder\)\{throw/)
 assert.match(script,/--project',\$projectName/)
 assert.doesNotMatch(script,/\$item\.Name/)
})

test('cumulative VitePress sources include required hidden config',async()=>{
 const config=await readFile(resolve(root,'docs/cli/.vitepress/config.mts'),'utf8')
 assert.match(config,/defineConfig/)
 assert.match(config,/VITEPRESS_BASE|\/vite-plugin-feathersjs\//)
})
