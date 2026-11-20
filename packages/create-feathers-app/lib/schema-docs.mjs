import { createHash, randomUUID } from 'node:crypto'
import { lstatSync, readFileSync, writeFileSync, unlinkSync, mkdirSync, renameSync, rmdirSync } from 'node:fs'
import { resolve, dirname, join, isAbsolute, win32 } from 'node:path'
import { isDeepStrictEqual } from 'node:util'
import { inspectRegistry } from './schema-registry.mjs'
import { plan, generateFiles } from './schema-build.mjs'

const digest = bytes => createHash('sha256').update(bytes).digest('hex')
const asText = bytes => Buffer.from(bytes).toString('utf8').replace(/\r\n/g, '\n')
const json = value => JSON.stringify(value, null, 2) + '\n'
const fail = code => { throw Error(code) }
const nameOk = name => typeof name === 'string' && name.length <= 48 && /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(name) && !/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(name)
function info(path) { try { return lstatSync(path) } catch(error) { if(error.code === 'ENOENT') return null; throw error } }
function safe(path) { for(let current=path;;current=dirname(current)) { if(info(current)?.isSymbolicLink()) fail('SYMLINK_REFUSED'); if(current===dirname(current)) break } }
function read(path) { safe(path); const s=info(path); if(!s?.isFile() || s.size > 1024 * 1024) fail('SOURCE_MISSING_OR_INVALID'); return readFileSync(path) }
function same(a,b) { return asText(a).trimEnd() === asText(b).trimEnd() }
function mkdirTracked(path,dirs) { safe(path); const s=info(path); if(s) { if(!s.isDirectory()) fail('DIRECTORY_CONFLICT');return } mkdirTracked(dirname(path),dirs);mkdirSync(path);dirs.push(path) }
function atomicallyWrite(path,bytes) { safe(path); const temp=path+'.r14-'+randomUUID()+'.tmp';try { writeFileSync(temp,bytes,{flag:'wx',mode:info(path)?.mode??0o600});renameSync(temp,path) } finally { if(info(temp)) unlinkSync(temp) } }

const docsConfig=`import { defineConfig } from 'vitepress'
import { readdirSync } from 'node:fs'
import { resolve } from 'node:path'
const names = readdirSync(resolve(process.cwd(), 'docs/api-schema/services')).filter(name => /^[a-z][a-z0-9-]*\\.md$/.test(name)).sort()
export default defineConfig({ lang:'fr', title:'Documentation API', themeConfig:{ search:{provider:'local'},sidebar:[{text:'Services',items:names.map(name=>({text:name.slice(0,-3),link:'/services/'+name.slice(0,-3)}))}] } })
`
const docsIndex='# Documentation API\n\nSélectionnez un service dans le menu. Les contrats sont générés à partir des définitions du Schema Builder. Démonstration locale, mémoire uniquement.\n'

function parseArgs(args,cwd) {
 const [action,name,...tail]=args
 if(!['enable','disable','status'].includes(action))fail('INVALID_DOCS_ACTION')
 if(!nameOk(name)||['health','notes','users','authentication','doc-api'].includes(name))fail('INVALID_SERVICE_NAME')
 const flags=new Map()
 for(let i=0;i<tail.length;i++) {
  const key=tail[i]
  if(!['--project','--api-docs','--dry-run','--json'].includes(key)||flags.has(key))fail('INVALID_OR_DUPLICATE_OPTION')
  if(key==='--dry-run'||key==='--json'){flags.set(key,true);continue}
  const value=tail[++i]
  if(typeof value!=='string'||!value||value.startsWith('--')||value.includes('\0'))fail('MISSING_OR_UNSAFE_VALUE')
  flags.set(key,value)
 }
 if(action==='enable'&&flags.get('--api-docs')!=='vitepress')fail('VITEPRESS_ONLY_R14_S2_R5')
 if(action==='disable'&&flags.has('--api-docs')&&flags.get('--api-docs')!=='off')fail('DISABLE_REQUIRES_OFF')
 if(action==='status'&&(flags.has('--dry-run')||flags.has('--api-docs')))fail('STATUS_FLAGS_REFUSED')
 const dir=flags.get('--project')??'.'
 if(dir.length>512||dir.startsWith('\\\\')||dir.startsWith('//')||/^[A-Za-z]:/.test(dir)&&!win32.isAbsolute(dir))fail('INVALID_PROJECT_PATH')
 if(dir.split(/[\\/]/).includes('..')||dir.split(/[\\/]/).includes('.env')||(!isAbsolute(dir)&&dir!=='.'&&!nameOk(dir)))fail('INVALID_PROJECT_PATH')
 const root=resolve(cwd,dir)
 safe(root)
 if(!info(root)?.isDirectory())fail('PROJECT_NOT_FOUND')
 return {action,name,root,flags,dryRun:flags.has('--dry-run')}
}

function createPlan(args,cwd) {
 const opts=parseArgs(args,cwd)
 const {root,name,action}=opts
 // The certified R4 inspector is the authoritative fail-closed boundary:
 // it checks the profile, exact generated schema files, registrar, contracts,
 // the Feathers service registry, and the current docs pages before mutation.
 safe(join(root,'docs/api-schema/services',name+'.md'))
 const before=inspectRegistry(root)
 const current=before.services.find(item=>item.name===name)
 if(!current)fail('SERVICE_NOT_GENERATED_OR_NOT_REGISTERED')
 if(!['off','vitepress'].includes(current.docs))fail('UNSUPPORTED_DOCS_MODE')
 const target=action==='status'?current.docs:action==='enable'?'vitepress':'off'
 const contractPath=`api/services/${name}/contract.json`
 const docPath=`docs/api-schema/services/${name}.md`
 const contractFile=join(root,contractPath)
 const docFile=join(root,docPath)
 const currentContract=read(contractFile)
 const originalDoc=info(docFile)?read(docFile):null
 if((current.docs==='vitepress')!==Boolean(originalDoc))fail('DOCS_REGISTRY_DRIFT')
 const originalFiles=[...before.services.map(s=>s.name)].sort()
 if(!originalFiles.includes(name))fail('REGISTRY_DRIFT')
 const canonical=plan(name,current.contract.fields.map(f=>`${f.name}:${f.type}${f.required?'!':'?'}`).join(','),current.schema,target)
 const previous=plan(name,current.contract.fields.map(f=>`${f.name}:${f.type}${f.required?'!':'?'}`).join(','),current.schema,current.docs)
 if(!isDeepStrictEqual(previous,current.contract))fail('CONTRACT_DRIFT')
 // A documentation toggle must not change the service semantics.
 const {docs:_previousDocs,...previousStable}=previous
 const {docs:_nextDocs,...nextStable}=canonical
 if(!isDeepStrictEqual(previousStable,nextStable))fail('SCHEMA_SEMANTIC_DRIFT')
 const generated=generateFiles(canonical)
 const nextDoc=target==='vitepress'?generated.get(`docs/services/${name}.md`):null
 if(target==='vitepress'&&typeof nextDoc!=='string')fail('DOC_GENERATOR_MISSING')
 const nextContract=json(canonical)
 const changed=target!==current.docs
 if(changed) {
  // R3's VitePress workspace uses a dynamic, strictly filtered sidebar.
  // This patch does not edit or replace the sidebar or the package manifest.
  const index=read(join(root,'docs/api-schema/index.md'))
  const config=read(join(root,'docs/api-schema/.vitepress/config.ts'))
  if(!same(index,docsIndex)||!same(config,docsConfig))fail('DOCS_WORKSPACE_DRIFT')
  const manifest=JSON.parse(asText(read(join(root,'package.json'))))
  if(manifest.devDependencies?.vitepress!=='1.6.4'||manifest.scripts?.['docs:schema:build']!=='vitepress build docs/api-schema')fail('DOCS_WORKSPACE_DEPENDENCIES_REFUSED')
  const ignored=asText(read(join(root,'.gitignore'))).split('\n')
  if(!ignored.includes('.ai/'))fail('PRIVATE_BACKUP_IGNORE_REQUIRED')
  if(target==='vitepress'&&info(docFile))fail('DESTINATION_CONFLICT')
 }
 const result={status:action==='status'?'SCHEMA_DOCS_STATUS':opts.dryRun?'SCHEMA_DOCS_DRY_RUN':changed?'SCHEMA_DOCS_READY':'SCHEMA_DOCS_NO_CHANGE',service:name,project:root,previousMode:current.docs,targetMode:target,pending:changed?2:0,swaggerPolicy:'UNCHANGED',serviceImplementation:'UNCHANGED',dependencies:'UNCHANGED',runtimeCertified:false}
 return {opts,root,contractPath,docPath,contractFile,docFile,currentContract,originalDoc,nextContract,nextDoc,changed,result}
}

export function runSchemaDocs(args,cwd=process.cwd()) {
 const p=createPlan(args,cwd)
 if(p.opts.action==='status'||p.opts.dryRun||!p.changed)return p.result
 const lock=join(p.root,'api/.create-feathers-service.lock')
 safe(lock)
 const dirs=[]
 let backup=null,docAdded=false,docRemoved=false,contractChanged=false
 writeFileSync(lock,'schema docs toggle in progress\n',{flag:'wx',mode:0o600})
 try {
  if(digest(read(p.contractFile))!==digest(p.currentContract)||Boolean(info(p.docFile))!==Boolean(p.originalDoc))fail('CONCURRENT_PROJECT_CHANGE')
  if(p.originalDoc&&digest(read(p.docFile))!==digest(p.originalDoc))fail('CONCURRENT_PROJECT_CHANGE')
  backup=join(p.root,'.ai/patch-memory/R14-S2-R5',p.opts.name+'-'+randomUUID())
  mkdirTracked(backup,dirs)
  writeFileSync(join(backup,'contract.json.original'),p.currentContract,{flag:'wx',mode:0o600})
  if(p.originalDoc)writeFileSync(join(backup,'service.md.original'),p.originalDoc,{flag:'wx',mode:0o600})
  writeFileSync(join(backup,'receipt.json'),json({operation:p.opts.action,service:p.opts.name,before:{contract:digest(p.currentContract),doc:p.originalDoc?digest(p.originalDoc):null},after:{contract:digest(p.nextContract),doc:p.nextDoc?digest(Buffer.from(p.nextDoc)):null},codeUntouched:true,swaggerPolicyUntouched:true}),{flag:'wx',mode:0o600})
  if(p.opts.action==='enable') {
   if(info(p.docFile))fail('CONCURRENT_PROJECT_CHANGE')
   writeFileSync(p.docFile,p.nextDoc,{flag:'wx',mode:0o600})
   docAdded=true
   if(digest(read(p.contractFile))!==digest(p.currentContract))fail('CONCURRENT_PROJECT_CHANGE')
   atomicallyWrite(p.contractFile,p.nextContract)
   contractChanged=true
  } else {
   atomicallyWrite(p.contractFile,p.nextContract)
   contractChanged=true
   if(digest(read(p.docFile))!==digest(p.originalDoc))fail('CONCURRENT_PROJECT_CHANGE')
   unlinkSync(p.docFile)
   docRemoved=true
  }
 } catch(error) {
  const failures=[]
  if(contractChanged)try {if(digest(read(p.contractFile))!==digest(p.nextContract))fail('CONCURRENT_PROJECT_CHANGE');atomicallyWrite(p.contractFile,p.currentContract)}catch(e){failures.push(e)}
  if(docAdded)try {if(digest(read(p.docFile))!==digest(Buffer.from(p.nextDoc)))fail('CONCURRENT_PROJECT_CHANGE');unlinkSync(p.docFile)}catch(e){failures.push(e)}
  if(docRemoved)try {if(info(p.docFile))fail('CONCURRENT_PROJECT_CHANGE');writeFileSync(p.docFile,p.originalDoc,{flag:'wx',mode:0o600})}catch(e){failures.push(e)}
  for(const dir of dirs.reverse())try {rmdirSync(dir)}catch{}
  if(failures.length)fail('ROLLBACK_INCOMPLETE')
  throw error
 } finally {unlinkSync(lock)}
 // Fail closed on generated-page drift, without silently claiming runtime certification.
 // A post-apply full inspection should also be run by the Windows operator.
 const result=inspectRegistry(p.root)
 if(!result.services.some(s=>s.name===p.opts.name&&s.docs===p.opts.action.replace('enable','vitepress').replace('disable','off')))fail('POST_APPLY_REGISTRY_MISMATCH')
 return {...p.result,status:'SCHEMA_DOCS_APPLY_PASS',pending:0,backup}
}
