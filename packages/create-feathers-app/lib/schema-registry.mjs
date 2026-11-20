import { lstatSync, readFileSync, readdirSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { createHash } from 'node:crypto'
import { isDeepStrictEqual } from 'node:util'
import { plan, generateFiles } from './schema-build.mjs'
import { referenceServer, referenceDevAll } from './schema-add.mjs'
const fail = code => { throw new Error(code) }
const norm = bytes => bytes.toString('utf8').replace(/\r\n/g, '\n')
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const safeName = value => typeof value === 'string' && value.length <= 48 && /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(value) && !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(value)
function info(path) { try { return lstatSync(path) } catch (error) { if (error.code === 'ENOENT') return null; throw error } }
function safe(path) { for (let current = path; ; current = dirname(current)) { if (info(current)?.isSymbolicLink()) fail('SYMLINK_REFUSED'); if (current === dirname(current)) break } }
function read(path) { safe(path); const stat = info(path); if (!stat?.isFile() || stat.size > 1024 * 1024) fail('SOURCE_MISSING_OR_INVALID'); const bytes = readFileSync(path); if (bytes.length > 1024 * 1024) fail('SOURCE_MISSING_OR_INVALID'); return bytes }
function json(path) { return JSON.parse(norm(read(path))) }
function exact(root, path, expected) { const bytes = read(join(root, path)); if (norm(bytes) !== expected) fail('GENERATED_SOURCE_DRIFT'); return hash(bytes) }
function equal(left, right, code) { if (!isDeepStrictEqual(left, right)) fail(code) }
const config = { target:'ES2022', lib:['ES2022'], module:'NodeNext', moduleResolution:'NodeNext', strict:true, exactOptionalPropertyTypes:true, noUncheckedIndexedAccess:true, esModuleInterop:true, skipLibCheck:true, noEmit:true, types:['node'] }
export function inspectRegistry(project) {
 const root = resolve(project); safe(root); if (!info(root)?.isDirectory()) fail('PROJECT_NOT_FOUND')
 const lock = join(root,'api/.create-feathers-service.lock'); safe(lock); if (info(lock)) fail('INSTALL_LOCK_PRESENT')
 const profile = json(join(root,'api/config/profile.json')); const manifest = json(join(root,'package.json'))
 if (profile.auth !== 'none' || profile.operational !== true || profile.cache !== 'none' || profile.storage !== 'none' || profile.databaseMode !== 'single' || !Array.isArray(profile.databases) || profile.databases.length !== 1 || profile.databases[0]?.alias !== profile.primary || profile.databases[0]?.adapter !== 'memory') fail('UNSUPPORTED_PROFILE')
 if (manifest.private !== true || manifest.type !== 'module' || manifest.version !== '0.1.0' || manifest.dependencies?.['@vevedh/vite-plugin-feathersjs'] !== '0.2.7' || manifest.scripts?.['dev:api'] !== 'node --import tsx --env-file=.env.example api/server.mjs' || manifest.scripts?.['dev:all'] !== 'node scripts/dev-all.mjs' || manifest.scripts?.['typecheck:schema'] !== 'tsc --noEmit -p api/tsconfig.schema.json') fail('UNSUPPORTED_RUNTIME')
 const env = norm(read(join(root,'.env.example')))
 for (const [key,value] of [['FEATHERS_ADAPTER','express'],['FEATHERS_SOCKETIO','0'],['VITE_FEATHERS_REALTIME','0']]) if (env.split('\n').filter(line=>line.startsWith(key+'=')).join('') !== key+'='+value) fail('EXPRESS_REST_ONLY')
 const source = norm(read(join(root,'api/server.mjs')))
 const marker = /const modules = \[\n([\s\S]*?)\n\]/; const match = marker.exec(source)
 if (!match || source.trimEnd() !== referenceServer.replace(marker,match[0]).trimEnd()) fail('SERVER_SOURCE_DRIFT')
 const dev = referenceDevAll.replace('const api=spawn(process.execPath,[',"const api=spawn(process.execPath,['--import','tsx',")
 exact(root,'scripts/dev-all.mjs',dev)
 const entries = new Map()
 for (const line of match[1].split('\n')) {
  const m = /^  new URL\('\.\/services\/([a-z][a-z0-9-]*)\/\1\.service\.(mjs|ts)', import\.meta\.url\),$/.exec(line)
  if (!m || !safeName(m[1]) || entries.has(m[1])) fail('REGISTRY_ENTRY_REFUSED')
  entries.set(m[1],m[2])
 }
 for (const name of ['health','notes']) { if (entries.get(name) !== 'mjs') fail('LEGACY_REGISTRY_REFUSED'); read(join(root,`api/services/${name}/${name}.service.mjs`)) }
 const services = [], files = []
 for (const [name,ext] of [...entries].sort(([a],[b])=>a.localeCompare(b,'en'))) {
  if (['health','notes'].includes(name)) continue
  if (ext !== 'ts') fail('UNREVIEWED_SERVICE_REFUSED')
  const prefix=`api/services/${name}/${name}`; const contractPath=`api/services/${name}/contract.json`
  const raw=json(join(root,contractPath))
  if (!Array.isArray(raw?.fields) || raw.fields.length>32 || !raw.fields.every(field=>field && typeof field.name==='string' && typeof field.type==='string' && typeof field.required==='boolean') || !['off','vitepress'].includes(raw.docs)) fail('CONTRACT_INVALID')
  const canonical=plan(name,raw.fields.map(f=>`${f.name}:${f.type}${f.required?'!':'?'}`).join(','),raw.schema,raw.docs)
  equal(raw,canonical,'CONTRACT_DRIFT')
  const generated=generateFiles(canonical); const src=`src/services/${name}/${name}`; const sha256={}
  for (const suffix of ['.schema.ts','.class.ts','.shared.ts']) { const path=prefix+suffix; const expected=generated.get(src+suffix); sha256[path]=exact(root,path,suffix==='.shared.ts'?expected.replace(`'api/${name}'`,`'${name}'`):expected); files.push(path.slice(4)) }
  const registrar=generated.get(src+'.ts').replace('export function register','export default function register').replace(`app.use('api/${name}'`,`app.use('${name}'`).replace('export default function register(app:Application):void {',"export default function register(app:Application):void {\n if (process.env.FEATHERS_ADAPTER !== 'express' || process.env.FEATHERS_SOCKETIO !== '0') throw new Error('Schema service requires Express REST, local lab only')")
  sha256[prefix+'.service.ts']=exact(root,prefix+'.service.ts',registrar); files.push((prefix+'.service.ts').slice(4))
  sha256[contractPath]=hash(read(join(root,contractPath)))
  if (canonical.docs==='vitepress') { const path=`docs/api-schema/services/${name}.md`; sha256[path]=exact(root,path,generated.get(`docs/services/${name}.md`)) }
  const dir=join(root,'api/services',name); const expectedNames=[`${name}.schema.ts`,`${name}.class.ts`,`${name}.shared.ts`,`${name}.service.ts`,'contract.json'].sort()
  equal(readdirSync(dir).sort(),expectedNames,'UNREVIEWED_GENERATED_DIRECTORY')
  services.push({name, route:'/'+canonical.path, schema:canonical.schema, docs:canonical.docs, methods:canonical.methods, contract:canonical, sha256})
 }
 if (!services.length) fail('NO_SCHEMA_SERVICES')
 // A generated directory cannot silently disappear from the runtime registry.
 const serviceRoot=join(root,'api/services'); safe(serviceRoot)
 for (const name of readdirSync(serviceRoot)) { const dir=join(serviceRoot,name); safe(dir); if (!info(dir)?.isDirectory() || !entries.has(name)) fail('UNREGISTERED_SERVICE_DIRECTORY') }
 const ts=json(join(root,'api/tsconfig.schema.json')); equal(ts,{compilerOptions:config,files:files.sort()},'SCHEMA_TSCONFIG_DRIFT')
 const documented=services.filter(s=>s.docs==='vitepress').map(s=>s.name+'.md').sort(); const docsPath=join(root,'docs/api-schema/services'); safe(docsPath)
 if (documented.length || info(docsPath)) equal(readdirSync(docsPath).sort(),documented,'DOCS_REGISTRY_DRIFT')
 if (info(lock)) fail('INSTALL_LOCK_PRESENT')
 return {status:'R14_S2_R4_REGISTRY_PASS',catalogVersion:1,profile:'local-express-rest-memory',generatedServices:services.length,legacyExcluded:['health','notes'],swaggerAllowlist:services.map(s=>s.name),services,productWrites:0,runtimeCertified:false}
}
