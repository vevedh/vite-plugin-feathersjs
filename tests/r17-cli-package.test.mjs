import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFile, readdir, lstat, rm, mkdtemp, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve, join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createGenerator } from '../packages/create-feathers-app/lib/scaffold.mjs'
import { auditStagedPackage, isExcludedTemplatePath } from '../scripts/stage-r17-cli.mjs'
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..')
const stage=resolve(root,'.release/create-feathers-app')
function run(command,args,cwd=root){
  const proc=spawnSync(command,args,{cwd,encoding:'utf8',timeout:120000,shell:process.platform==='win32' && command==='npm',env:{...process.env,npm_config_audit:'false',npm_config_fund:'false',npm_config_update_notifier:'false'}})
  return {status:proc.status,output:(proc.stdout||'')+'\n'+(proc.stderr||'')+(proc.error ? `\n${proc.error}` : '')}
}
const start=run(process.execPath,['scripts/stage-r17-cli.mjs'])
assert.equal(start.status,0,start.output)

test('CLI staging is public, independent of source and includes all supported templates',async()=>{
  const p=JSON.parse(await readFile(join(stage,'package.json'),'utf8'))
  assert.equal(p.name,'@vevedh/create-feathers-app')
  assert.equal(p.version,'0.1.0-rc.2')
  assert.equal(p.private,undefined)
  assert.deepEqual(p.bin,{'create-feathers-app':'./bin/create-feathers-app.mjs'})
  const files=await readdir(join(stage,'templates'))
  for(const item of ['spa','daisyui-ssr','daisyui-ssg','quasar-ssr','common'])assert.ok(files.includes(item),item)
  const code=await readFile(join(stage,'lib/scaffold.mjs'),'utf8')
  assert.match(code,/buildProjectPlan/)
  assert.ok(!code.includes('examples/basic/scripts/project-generator'))
})
test('published CLI bin has help and version and rejects unsupported options',()=>{
  const bin=join(stage,'bin/create-feathers-app.mjs')
  assert.match(run(process.execPath,[bin,'--help']).output,/Quasar 2 SPA\/SSR; daisyUI SPA, SSR, SSG/)
  assert.match(run(process.execPath,[bin,'--version']).output,/0\.1\.0-rc\.2/)
  for(const args of [ ['--name','../bad'],['--name','bad','--ui','quasar2','--render','ssg'],['--name','bad','--ui','daisyui','--render','ssg','--transport','both'],['--name','bad','--auth','invalid'],['--name','con'],['--name','nul'],['--name','lpt1'],['good','--name','bad'] ]){
    const result=run(process.execPath,[bin,...args]);assert.notEqual(result.status,0,args.join(' '))
  }
})
test('packaged templates generate SPA/SSR/SSG without repository files, with a secure boundary and no overwrite',async()=>{
  const destination=await mkdtemp(join(tmpdir(),'r17-cli-smoke-'))
  try {
    const bin=join(stage,'bin/create-feathers-app.mjs')
    for(const [ui,render,transport] of [['quasar2','ssr','rest'],['quasar2','spa','both'],['daisyui','spa','both'],['daisyui','ssr','rest'],['daisyui','ssg','rest']]){
      const name=`sample-${ui}-${render}`
      const args=[bin,name,'--ui',ui,'--render',render,'--transport',transport,'--adapter','express']
      const dry=run(process.execPath,[...args,'--dry-run','--json'],destination)
      assert.equal(dry.status,0,dry.output)
      const report=JSON.parse(dry.output.trim())
      assert.ok(report.files.includes('scripts/dev-all.mjs'))
      assert.ok(report.files.includes('.gitignore'))
      await assert.rejects(lstat(join(destination,name)))
      const generated=run(process.execPath,args,destination)
      assert.equal(generated.status,0,generated.output)
      const manifest=JSON.parse(await readFile(join(destination,name,'package.json'),'utf8'))
      assert.equal(manifest.name,name);assert.equal(manifest.private,true)
      assert.equal(manifest.dependencies['@vevedh/vite-plugin-feathersjs'],'0.2.6')
      if(ui==='quasar2' && render==='ssr'){
        assert.equal(manifest.devDependencies['@types/express'],'4.17.25')
        assert.equal(manifest.pnpm.overrides['@types/express-serve-static-core'],'4.19.9')
      }
      assert.ok(manifest.scripts['dev:all'])
      assert.match(await readFile(join(destination,name,'.env.example'),'utf8'),/FEATHERS_ADAPTER=express/)
      assert.match(await readFile(join(destination,name,'index.html'),'utf8'),new RegExp(`content="${ui==='quasar2'?'quasar': 'daisyui'}-${render}"`))
      if(render==='ssg')assert.ok((await readdir(join(destination,name,'scripts'))).includes('prerender.mjs'))
      if(render==='ssr')assert.ok((await readdir(join(destination,name,'scripts'))).includes(ui==='quasar2'?'edge-proxy.mjs':'serve-ssr.mjs'))
      assert.notEqual(run(process.execPath,args,destination).status,0,'must refuse overwrite')
    }
  } finally {await rm(destination,{recursive:true,force:true})}
})
test('npm pack contains the executable and templates but no internal docs, environments or workspace scripts',async()=>{
  const audit=await auditStagedPackage(stage)
  assert.ok(audit.count > 80 && audit.count <= 200, `unexpected count: ${audit.count}`)
  assert.ok(audit.bytes < 2*1024*1024, `unexpected size: ${audit.bytes}`)
  const result=run('npm',['pack','--dry-run','--json'],stage)
  assert.equal(result.status,0,result.output)
  const pack=JSON.parse(result.output.trim())[0]
  const names=pack.files.map(file=>file.path)
  assert.ok(names.length > 80 && names.length <= 200, `unexpected packed count: ${names.length}`)
  assert.ok(pack.size < 2 * 1024 * 1024, `unexpected packed size: ${pack.size}`)
  assert.ok(names.includes('bin/create-feathers-app.mjs'))
  assert.ok(names.includes('templates/daisyui-ssr/scripts/serve-ssr.mjs'))
  assert.ok(names.includes('templates/daisyui-ssg/scripts/prerender.mjs'))
  assert.ok(names.includes('templates/spa/common/api/server.mjs'))
  for(const file of ['templates/spa/common/gitignore.template','templates/daisyui-ssr/gitignore.template','templates/daisyui-ssg/gitignore.template','templates/quasar-ssr/gitignore.template'])assert.ok(names.includes(file),file)
  for(const file of names)assert.ok(!/(^|\/)(docs-private|node_modules|dist|coverage|\.env(?!\.example)|\.git|pnpm-lock\.yaml|\.agents|\.vite|\.quasar)(\/|$)/.test(file),file)
})


test('Windows and POSIX paths are both excluded before stage copy', () => {
  for (const candidate of [
    String.raw`C:\repo\daisyui-ssg\node_modules`,
    String.raw`C:\repo\daisyui-ssg\dist`,
    String.raw`C:\repo\daisyui-ssr\.npmrc`,
    '/repo/daisyui-ssg/pnpm-lock.yaml',
    '/repo/daisyui-ssr/.env.production',
    '/repo/daisyui-ssr/docs-private',
  ]) assert.equal(isExcludedTemplatePath(candidate), true, candidate)
  for (const candidate of ['C:\\repo\\daisyui-ssg\\.env.example', '/repo/src/App.vue']) {
    assert.equal(isExcludedTemplatePath(candidate), false, candidate)
  }
})
