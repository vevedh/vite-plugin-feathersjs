import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { lstatSync, realpathSync, readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve, dirname, relative, isAbsolute, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export const NAME = '@vevedh/vite-plugin-feathersjs'
// Deliberately pinned; a new version needs a new reviewed release contract.
export const VERSION = '0.3.0'
const required = ['index.js', 'index.d.ts', 'app.js', 'app.d.ts', 'options.js', 'options.d.ts', 'types.d.ts', 'performance.js', ...['events','oidc','transport'].flatMap(x => [`security/feathers-keycloak-${x}.js`, `security/feathers-keycloak-${x}.d.ts`])]
const exportsExpected = { '.': { types: './dist/index.d.ts', import: './dist/index.js' } }
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const samePath = (a,b) => relative(a,b) === ''
function inside(base, p) { const r = relative(base,p); return r !== '' && r !== '..' && !r.startsWith('..'+sep) && !isAbsolute(r) }
export function regular(p, kind) {
  const abs = resolve(p)
  for (let at = abs;; at = dirname(at)) {
    const s = lstatSync(at)
    assert.ok(!s.isSymbolicLink(), 'Alias refused')
    assert.ok(samePath(realpathSync.native(at), at), 'Noncanonical path refused')
    if (at === abs && kind === 'file') assert.ok(s.isFile() && s.nlink === 1, 'Nonregular or hardlinked file refused')
    else assert.ok(s.isDirectory(), 'Nonregular directory refused')
    if (dirname(at) === at) break
  }
  return abs
}
function bytes(p) { return readFileSync(regular(p,'file')) }
function json(p) { return JSON.parse(bytes(p).toString('utf8')) }
const pkgName = /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/
function dependencies(group) {
  assert.ok(group && typeof group === 'object' && !Array.isArray(group), 'Invalid dependency group')
  for (const [name,range] of Object.entries(group)) {
    assert.ok(pkgName.test(name), 'Invalid dependency name')
    assert.ok(typeof range === 'string' && /^[0-9xX*^~<>=. |+-]+$/.test(range) && /[0-9*xX]/.test(range), 'Unsupported dependency range')
  }
  return group
}
export function releaseManifest(root) {
  regular(root,'dir')
  const p = json(resolve(root,'package.json'))
  const lock = json(resolve(root,'package-lock.json'))
  assert.equal(p.name,NAME); assert.equal(p.version,VERSION); assert.equal(p.private,true, 'Source root must be private')
  assert.equal(p.scripts?.prepublishOnly,'node tools/release/npm-publish-guard.mjs')
  const guard = bytes(resolve(root,'tools/release/npm-publish-guard.mjs'))
  assert.equal(hash(Buffer.from(guard.toString('utf8').replace(/\r\n/g,'\n'))), '1c275b20e6927d8fbb3fac342a79999e09c0690542e81a62b34f9cdae7c84dcd')
  assert.equal(lock.name,NAME); assert.equal(lock.version,VERSION)
  assert.equal(lock.packages?.['']?.name,NAME); assert.equal(lock.packages?.['']?.version,VERSION)
  assert.equal(p.type,'module'); assert.equal(p.main,'./dist/index.js'); assert.equal(p.module,'./dist/index.js'); assert.equal(p.types,'./dist/index.d.ts')
  assert.deepEqual(p.exports,exportsExpected); assert.deepEqual(p.files,['dist','README.md','LICENSE'])
  assert.equal(p.license,'MIT'); assert.equal(p.sideEffects,false)
  assert.equal(typeof p.description,'string'); assert.ok(p.description.length>0)
  assert.ok(Array.isArray(p.keywords) && p.keywords.every(x=>typeof x==='string'))
  assert.equal(p.engines?.node,'>=20.19.0')
  assert.deepEqual(lock.packages[''].dependencies,p.dependencies); assert.deepEqual(lock.packages[''].peerDependencies,p.peerDependencies); assert.deepEqual(lock.packages[''].devDependencies,p.devDependencies)
  // Explicit projection; no inherited scripts, devDependencies, arbitrary npm config or metadata.
  return { name:NAME, version:VERSION, description:p.description, type:'module', license:'MIT', private:false, files:['dist','README.md','LICENSE'], main:p.main,module:p.module,types:p.types,exports:exportsExpected,sideEffects:false,engines:{node:p.engines.node},dependencies:dependencies(p.dependencies),peerDependencies:dependencies(p.peerDependencies),keywords:p.keywords,publishConfig:{access:'public'} }
}
function walkDist(root) {
  const dist = regular(resolve(root,'dist'),'dir'), output = new Map()
  function walk(dir) {
    for (const e of readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name,'en'))) {
      assert.ok(/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(e.name) && !e.name.endsWith('.'), 'Unexpected dist name')
      const p=resolve(dir,e.name); assert.ok(inside(dist,p))
      if(e.isDirectory()) {regular(p,'dir');walk(p);continue}
      assert.ok(e.isFile() && /(?:\.js|\.d\.ts|\.js\.map|\.d\.ts\.map|\.css)$/.test(e.name),'Unexpected dist asset')
      const b=bytes(p)
      if(e.name.endsWith('.map')) {
        const m=JSON.parse(b.toString('utf8'))
        assert.equal(m.version,3);assert.ok(!m.sourceRoot && !m.sourcesContent,'Embedded or redirected source map refused')
        assert.ok(Array.isArray(m.sources)&&m.sources.length>0)
        for(const s of m.sources) assert.ok(typeof s==='string' && !/[:\\\x00-\x1f]/.test(s) && !isAbsolute(s) && inside(resolve(root,'src'),resolve(dirname(p),s)), 'Source map escapes src')
      }
      output.set(relative(dist,p).split(sep).join('/'),b)
    }
  }
  walk(dist)
  for(const n of required) assert.ok(output.has(n),`Missing dist/${n}`)
  for(const n of output.keys()) if(n.endsWith('.map')) assert.ok(output.has(n.slice(0,-4)), 'Orphan source map')
  return output
}
export function expectedFiles(root) {
  const manifest=releaseManifest(root), dist=walkDist(root)
  const readme=bytes(resolve(root,'README.md'))
  const text=readme.toString('utf8')
  assert.ok(text.startsWith('# @vevedh/vite-plugin-feathersjs'))
  for(const token of ['serviceFiles',"adapter: 'koa'",'socketio: false','createFeathersRuntime','development-only','npm install']) assert.ok(text.includes(token),`README contract: ${token}`)
  const files = new Map([['package.json',Buffer.from(JSON.stringify(manifest,null,2)+'\n')],['README.md',readme],['LICENSE',bytes(resolve(root,'LICENSE'))]])
  for(const [n,b] of dist) files.set('dist/'+n,b)
  return files
}
export function stage(root=ROOT) {
  const files=expectedFiles(root), release=resolve(root,'.release'), dest=resolve(release,'npm')
  try { mkdirSync(release) } catch(e) { if(e.code!=='EEXIST') throw e }
  regular(release,'dir')
  // Never overwrite or remove an old staging directory; partial attempts remain evidence.
  mkdirSync(dest); regular(dest,'dir')
  for(const [n,b] of files) {
    const p=resolve(dest,n); assert.ok(inside(dest,p)); mkdirSync(dirname(p),{recursive:true}); regular(dirname(p),'dir');writeFileSync(p,b,{flag:'wx'})
  }
  return files.size
}
export function verify(root=ROOT) {
  const expected=expectedFiles(root), dest=regular(resolve(root,'.release/npm'),'dir'), seen=new Set()
  function walk(dir) {
    for(const e of readdirSync(dir,{withFileTypes:true})) {
      const p=resolve(dir,e.name), n=relative(dest,p).split(sep).join('/')
      if(e.isDirectory()) {regular(p,'dir'); assert.ok([...expected.keys()].some(k=>k.startsWith(n+'/')), 'Unexpected stage directory');walk(p)}
      else {assert.ok(e.isFile()&&expected.has(n),'Unexpected stage file');assert.equal(hash(bytes(p)),hash(expected.get(n)),`Stage drift: ${n}`);seen.add(n)}
    }
  }
  walk(dest);assert.equal(seen.size,expected.size,'Missing stage files');return seen.size
}
