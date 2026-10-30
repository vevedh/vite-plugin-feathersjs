import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir, lstat, mkdir, rm, symlink } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse, generate } from '../scripts/r17/generator.mjs'
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const output = resolve(root,'examples/r17/generated')
const unique = `r17-test-${process.pid}`
const testLocation = resolve(output,unique)
test('R15 planner reused: all SPA presets and rendering constraints are explicit', async () => {
  for(const ui of ['quasar2','daisyui']) {
    const args=parse(['--name',unique,'--ui',ui,'--adapter','koa','--transport','both','--dry-run'])
    const report=await generate(args)
    assert.ok(report.files.length>=19)
    assert.equal(report.ui,ui)
    assert.equal(report.render,'spa')
  }
  assert.throws(()=>parse(['--name',unique,'--ui','quasar2','--render','ssg']), /SPA|SSR\/SSG|supports SPA/)
  assert.equal(parse(['--name',unique,'--ui','daisyui','--render','ssr']).render,'ssr')
  assert.throws(()=>parse(['--name',unique,'--ui','daisyui-kit']), /Unsupported|Invalid/)
})
test('unknown options, custom auth, unsafe destinations and unsupported transports are rejected',()=>{
  for(const args of [ ['--name',unique,'--secret','123'],['--name','../escape'], ['--name',unique,'--dir','../../escape'], ['--name',unique,'--dir','C:/users'], ['--name',unique,'--transport','socketio'], ['--name',unique,'--auth','invalid'],['--name',unique,'--adapter','hono'], ['--name',unique,'--name','duplicate'] ]) assert.throws(()=>parse(args))
})
test('dry-run writes nothing; generating files is deterministic and refuses overwrite', async () => {
  await rm(testLocation,{recursive:true,force:true})
  const args=parse(['--name',unique,'--ui','quasar2','--transport','both','--dry-run'])
  const dry=await generate(args)
  await assert.rejects(lstat(testLocation))
  const actual=await generate({ ...args, dryRun:false })
  assert.deepEqual(actual,dry)
  const env=await readFile(resolve(testLocation,'.env.example'),'utf8')
  assert.match(env,/FEATHERS_SOCKETIO=1/)
  assert.match(env,/VITE_FEATHERS_REALTIME=1/)
  assert.equal(JSON.parse(await readFile(resolve(testLocation,'package.json'),'utf8')).dependencies['@vevedh/vite-plugin-feathersjs'],'0.2.6')
  await assert.rejects(generate({ ...args, dryRun:false }), /already exists/)
  await rm(testLocation,{recursive:true,force:true})
})
test('template symlink destinations are refused even in dry-run', async (t)=>{
  await mkdir(output,{recursive:true})
  try {
    await symlink(output, testLocation, process.platform==='win32' ? 'junction' : 'dir')
  }
  catch (err) { t.skip(`Symlinks unavailable: ${err.code}`); return }
  try { await assert.rejects(generate(parse(['--name',unique,'--dry-run'])),/Symlink/) }
  finally { await rm(testLocation,{force:true}) }
})
test('six UI × rendering examples have valid files and no private build-time Feathers calls',async()=>{
  for(const f of ['generated/r17-quasar-spa/src/App.vue', 'quasar-ssr/README.md','quasar-ssg/src-ssg/ssg-renderer.ts', 'generated/r17-daisyui-spa/src/App.vue','daisyui-ssr/src/entry-server.ts','daisyui-ssg/scripts/prerender.mjs']) await readFile(resolve(root,'examples/r17',f))
  const renderer=await readFile(resolve(root,'examples/r17/daisyui-ssg/scripts/prerender.mjs'),'utf8')
  assert.doesNotMatch(renderer,/fetch\(|FEATHERS_.*TOKEN|service\('notes'\)/)
  const qssg=await readFile(resolve(root,'examples/r17/quasar-ssg/scripts/check-compat.mjs'),'utf8')
  assert.match(qssg,/process.exitCode = 2/)
})
