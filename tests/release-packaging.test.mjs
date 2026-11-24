import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, realpathSync, mkdirSync, readFileSync, writeFileSync, rmSync, copyFileSync, symlinkSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { stage,verify,releaseManifest } from '../scripts/release-package-common.mjs'
const kit=fileURLToPath(new URL('../',import.meta.url))
function fixture(t) {
  // Canonicalize Windows temp aliases before constructing guarded paths.
  const root=realpathSync.native(mkdtempSync(join(realpathSync.native(tmpdir()),'r30-b1-')))
  t.after(()=>rmSync(root,{recursive:true,force:true}))
  const write=(p,data)=>{const full=join(root,p);mkdirSync(dirname(full),{recursive:true});writeFileSync(full,data)}
  const json=(p,v)=>write(p,JSON.stringify(v))
  const pkg=JSON.parse(readFileSync(join(kit,'package.json'),'utf8'));pkg.private=true;pkg.version='0.3.0'
  const lock={name:pkg.name,version:pkg.version,lockfileVersion:3,packages:{'':{name:pkg.name,version:pkg.version,dependencies:pkg.dependencies,peerDependencies:pkg.peerDependencies,devDependencies:pkg.devDependencies}}}
  json('package.json',pkg);json('package-lock.json',lock)
  write('README.md',"# @vevedh/vite-plugin-feathersjs\nserviceFiles adapter: 'koa' socketio: false createFeathersRuntime development-only npm install\n")
  write('LICENSE','MIT fixture');write('src/index.ts','export {}');write('dist/index.js.map',JSON.stringify({version:3,sources:['../src/index.ts'],sourceRoot:'',names:[],mappings:''}))
  for(const n of ['index.js','index.d.ts','app.js','app.d.ts','options.js','options.d.ts','types.d.ts','performance.js',...['events','oidc','transport'].flatMap(x=>[`security/feathers-keycloak-${x}.js`,`security/feathers-keycloak-${x}.d.ts`])])write('dist/'+n,'export {}\n')
  write('tools/release/npm-publish-guard.mjs',readFileSync(join(kit,'tools/release/npm-publish-guard.mjs')))
  return {root,pkg,lock,write,json}
}
test('scoped private root produces exact script-free public stage',t=>{const f=fixture(t);const n=stage(f.root);assert.equal(verify(f.root),n);const p=JSON.parse(readFileSync(join(f.root,'.release/npm/package.json'),'utf8'));assert.equal(p.name,f.pkg.name);assert.equal(p.version,'0.3.0');assert.equal(p.private,false);assert.ok(!('scripts' in p)&&!('devDependencies' in p));assert.deepEqual(p.publishConfig,{access:'public'});assert.equal(JSON.parse(readFileSync(join(f.root,'package.json'),'utf8')).private,true)})
test('public source root refused without stage creation',t=>{const f=fixture(t);f.pkg.private=false;f.json('package.json',f.pkg);assert.throws(()=>stage(f.root));assert.equal(existsSync(join(f.root,'.release')),false)})
test('legacy name or old version rejected',t=>{const f=fixture(t);f.pkg.version='0.2.7';f.json('package.json',f.pkg);assert.throws(()=>stage(f.root));f.pkg.version='0.3.0';f.pkg.name='vite-plugin-feathersjs';f.json('package.json',f.pkg);assert.throws(()=>stage(f.root))})
test('lockfile version and dependency drift refused',t=>{const f=fixture(t);f.lock.packages[''].version='0.2.7';f.json('package-lock.json',f.lock);assert.throws(()=>stage(f.root));f.lock.packages[''].version='0.3.0';f.lock.packages[''].dependencies={};f.json('package-lock.json',f.lock);assert.throws(()=>stage(f.root))})
test('root publication guard remains blocking and cannot be removed or replaced',t=>{const f=fixture(t);const guard=join(f.root,'tools/release/npm-publish-guard.mjs');assert.equal(spawnSync(process.execPath,[guard]).status,1);f.write('tools/release/npm-publish-guard.mjs','process.exit(0)');assert.throws(()=>stage(f.root))})
test('unsupported dependency references denied',t=>{const f=fixture(t);f.pkg.dependencies={bad:'file:../private'};f.lock.packages[''].dependencies=f.pkg.dependencies;f.json('package.json',f.pkg);f.json('package-lock.json',f.lock);assert.throws(()=>releaseManifest(f.root))})
test('arbitrary metadata and lifecycle scripts do not propagate',t=>{const f=fixture(t);f.pkg.scripts.install='unexpected';f.pkg.publishConfig={registry:'https://example.invalid'};f.pkg.internal='private';f.json('package.json',f.pkg);const p=releaseManifest(f.root);assert.equal(p.internal,undefined);assert.equal(p.scripts,undefined);assert.deepEqual(p.publishConfig,{access:'public'})})
test('missing compiled Keycloak output fails before stage',t=>{const f=fixture(t);rmSync(join(f.root,'dist/security/feathers-keycloak-oidc.js'));assert.throws(()=>stage(f.root));assert.equal(existsSync(join(f.root,'.release')),false)})
test('hidden or unexpected dist assets rejected',t=>{const f=fixture(t);f.write('dist/.env','fixture');assert.throws(()=>stage(f.root));rmSync(join(f.root,'dist/.env'));f.write('dist/private.json','{}');assert.throws(()=>stage(f.root))})
test('source map rejects embedded contents and path outside src',t=>{const f=fixture(t);const m={version:3,sources:['../src/index.ts'],sourcesContent:['fixture']};f.json('dist/index.js.map',m);assert.throws(()=>stage(f.root));delete m.sourcesContent;m.sources=['../../private.ts'];f.json('dist/index.js.map',m);assert.throws(()=>stage(f.root))})
test('existing stage is not deleted or overwritten',t=>{const f=fixture(t);f.write('.release/npm/sentinel','keep');assert.throws(()=>stage(f.root));assert.equal(readFileSync(join(f.root,'.release/npm/sentinel'),'utf8'),'keep')})
test('release ancestor alias refused; external directory intact',t=>{const f=fixture(t);mkdirSync(join(f.root,'other'));symlinkSync(join(f.root,'other'),join(f.root,'.release'),'junction');assert.throws(()=>stage(f.root));assert.equal(existsSync(join(f.root,'other/npm')),false)})
test('dist ancestor alias refused',t=>{const f=fixture(t);rmSync(join(f.root,'dist/security'),{recursive:true});mkdirSync(join(f.root,'other'));symlinkSync(join(f.root,'other'),join(f.root,'dist/security'),'junction');assert.throws(()=>stage(f.root))})
test('stage corruption or extra file detected',t=>{const f=fixture(t);stage(f.root);f.write('.release/npm/dist/index.js','modified');assert.throws(()=>verify(f.root));f.write('.release/npm/dist/index.js','export {}\n');f.write('.release/npm/extra.txt','unexpected');assert.throws(()=>verify(f.root))})
test('stage missing file detected',t=>{const f=fixture(t);stage(f.root);rmSync(join(f.root,'.release/npm/LICENSE'));assert.throws(()=>verify(f.root))})
