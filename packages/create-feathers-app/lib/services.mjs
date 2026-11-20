import { schemaSourceTs, classSourceTs, registrarTs, tsServiceConfig } from './typescript.mjs'
import { canonicalGeneratedContract } from './canonical-contract.mjs'
import { existsSync } from 'node:fs'
import { lstat, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join, resolve, sep } from 'node:path'

const VALID_NAME = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/
const VALID_SCHEMA = new Set(['typebox','json','zod'])
const VALID_AUTH = new Set(['none','jwt'])
const VALID_LANGUAGE = new Set(['js','ts'])
function safeName(s){return typeof s==='string' && s.length<=48 && VALID_NAME.test(s) && !/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(s)}
async function rejectLinks(path){
 let current=path
 while(true){if(existsSync(current)&&(await lstat(current)).isSymbolicLink())throw new Error('Symlink path refused');const next=dirname(current);if(next===current)break;current=next}
}
export function parseServiceArguments(args){
 if(args[0]!=='add')throw new Error('Use: service add <name> [--project <dir>] [--schema typebox|json|zod] [--db <alias>] [--auth none|jwt] [--dry-run]')
 if(!safeName(args[1]))throw new Error('Invalid service name (lowercase kebab-case)')
 const options={name:args[1],project:'.',schema:undefined,db:undefined,auth:undefined,lang:'js',dryRun:false}
 const keys=new Map([['--project','project'],['--schema','schema'],['--db','db'],['--auth','auth'],['--lang','lang']])
 const seen=new Set()
 for(let i=2;i<args.length;i++){
  const flag=args[i]
  if(seen.has(flag))throw new Error('Duplicate option: '+flag)
  seen.add(flag)
  if(flag==='--dry-run'){options.dryRun=true;continue}
  if(!keys.has(flag))throw new Error('Unknown service option: '+flag)
  const value=args[++i]
  if(!value||value.startsWith('--'))throw new Error('Missing service option: '+flag)
  options[keys.get(flag)]=value
 }
 if(!VALID_LANGUAGE.has(options.lang))throw new Error('Invalid language; use js|ts')
 if(!VALID_SCHEMA.has(options.schema??'typebox'))throw new Error('Invalid schema')
 if(!VALID_AUTH.has(options.auth??'none'))throw new Error('Invalid service auth: none|jwt')
 if(options.db!==undefined&&!safeName(options.db))throw new Error('Invalid database alias')
 if(!/^\.?\/?[a-zA-Z0-9._/-]*$/.test(options.project)||options.project.includes('..')||options.project.includes('\\')||options.project.startsWith('/'))throw new Error('Unsafe project path; use a local relative directory')
 return options
}
function schemaSource(schema){
 const opening="import { BadRequest } from '@feathersjs/errors'\n"
 const query=`
// Only a deliberately small, documented query dialect is accepted.
// Feathers adapter-specific $ operators must never pass through unchecked.
export function validateQuery(value){
 if(value === undefined || value === null) return {}
 if(typeof value !== 'object' || Array.isArray(value)) throw new BadRequest('Invalid query')
 const result={}
 for(const [key,raw] of Object.entries(value)){
  if(key==='title'){
   if(typeof raw!=='string'||raw.length>120||raw.trim().length<1)throw new BadRequest('Invalid query title')
   result.title=raw.trim()
   continue
  }
  if(key==='$limit'||key==='$skip'){
   if(typeof raw!=='number'&&typeof raw!=='string')throw new BadRequest('Invalid query pagination')
   if(typeof raw==='string'&&!/^(0|[1-9][0-9]*)$/.test(raw))throw new BadRequest('Invalid query pagination')
   const n=Number(raw)
   if(!Number.isSafeInteger(n)||n<0||n>1000)throw new BadRequest('Invalid query pagination')
   result[key]=n
   continue
  }
  throw new BadRequest('Unsupported query field')
 }
 return result
}
`
 if(schema==='zod')return opening+`import { z } from 'zod'
export const dataSchema=z.object({title:z.string().trim().min(1).max(120)}).strict()
export const patchSchema=dataSchema.partial()
export function validateData(value){const parsed=dataSchema.safeParse(value);if(!parsed.success)throw new BadRequest('Invalid service data');return parsed.data}
export function validatePatch(value){const parsed=patchSchema.safeParse(value);if(!parsed.success||!Object.keys(parsed.data).length)throw new BadRequest('Invalid service patch');return parsed.data}
`+query
 const shape=schema==='typebox'?`import { Type } from '@feathersjs/typebox'
const titleSchema=Type.String({minLength:1,maxLength:120})
export const dataSchema=Type.Object({title:titleSchema},{additionalProperties:false})
export const patchSchema=Type.Object({title:Type.Optional(titleSchema)},{additionalProperties:false})
`:`const titleSchema={type:'string',minLength:1,maxLength:120}
export const dataSchema={type:'object',additionalProperties:false,required:['title'],properties:{title:titleSchema}}
export const patchSchema={type:'object',additionalProperties:false,properties:{title:titleSchema}}
`
 return opening+`import Ajv from 'ajv'
`+shape+`const ajv=new Ajv({allErrors:true,coerceTypes:false,removeAdditional:false,useDefaults:false})
const validData=ajv.compile(dataSchema)
const validPatch=ajv.compile(patchSchema)
function normalized(value, validator, operation){
 // Apply the same trim-before-validation contract as the Zod preset.
 if(!value||typeof value!=='object'||Array.isArray(value)||typeof value.title!=='string')throw new BadRequest('Invalid service '+operation)
 const canonical={...value,title:value.title.trim()}
 if(!validator(canonical)||!canonical.title)throw new BadRequest('Invalid service '+operation)
 return {title:canonical.title}
}
export function validateData(value){return normalized(value,validData,'data')}
export function validatePatch(value){return normalized(value,validPatch,'patch')}
`+query
}
function classSource(){return `import { NotFound, BadRequest } from '@feathersjs/errors'
import { validateData, validatePatch, validateQuery } from './schema.mjs'
export class GeneratedService {
  #items=new Map()
  #counter=1
  constructor(){for(const method of ['find','get','create','patch','remove'])this[method]=this[method].bind(this)}
  #id(value){
    if(typeof value!=='number'&&typeof value!=='string')throw new BadRequest('Invalid ID')
    if(typeof value==='string'&&!/^[1-9][0-9]*$/.test(value))throw new BadRequest('Invalid ID')
    const n=Number(value)
    if(!Number.isSafeInteger(n)||n<1)throw new BadRequest('Invalid ID')
    return n
  }
  async find(params={}){
    const query=validateQuery(params?.query)
    const values=[...this.#items.values()].filter(row=>query.title===undefined||row.title===query.title)
    return values.slice(query.$skip??0,(query.$skip??0)+(query.$limit??values.length)).map(row=>({...row}))
  }
  async get(id){const item=this.#items.get(this.#id(id));if(!item)throw new NotFound('Not found');return {...item}}
  async create(data){const input=validateData(data);const row={id:this.#counter++,...input};this.#items.set(row.id,row);return {...row}}
  async patch(id,data){const key=this.#id(id);const row=this.#items.get(key);if(!row)throw new NotFound('Not found');const next={...row,...validatePatch(data)};this.#items.set(key,next);return {...next}}
  async remove(id){const key=this.#id(id);const row=this.#items.get(key);if(!row)throw new NotFound('Not found');this.#items.delete(key);return {...row}}
}
`}
function registrar(name,auth){
 return `import { GeneratedService } from './service.class.mjs'
${auth==='jwt'?"import { authenticate } from '@feathersjs/authentication'\n":''}export default function register(app){
 app.use('${name}',new GeneratedService(),{methods:['find','get','create','patch','remove']})
 ${auth==='jwt'?`app.service('${name}').hooks({before:{all:[authenticate('jwt')]}})`:'// This demonstration service has no authentication; bind HTTP only to loopback.'}
}
`
}
// Non-public IO injection enables deterministic Windows-safe fault tests. CLI calls use default fs.
export async function generateService(opts, cwd=process.cwd(), io={writeFile}) {
 if(!opts || !safeName(opts.name))throw new Error('Invalid service name')
 const projectOption=opts.project??'.'
 if(typeof projectOption!=='string'||!/^\.?\/?[a-zA-Z0-9._/-]*$/.test(projectOption)||projectOption.includes('..')||projectOption.includes('\\')||projectOption.startsWith('/'))throw new Error('Unsafe project path')
 if(opts.schema!==undefined&&!VALID_SCHEMA.has(opts.schema))throw new Error('Invalid schema')
 if(opts.lang!==undefined&&!VALID_LANGUAGE.has(opts.lang))throw new Error('Invalid language')
 if(opts.auth!==undefined&&!VALID_AUTH.has(opts.auth))throw new Error('Invalid service auth')
 if(opts.db!==undefined&&!safeName(opts.db))throw new Error('Invalid database alias')
 const project=resolve(cwd,projectOption)
 if(projectOption!=='.' && !project.startsWith(resolve(cwd)+sep))throw new Error('Project escapes current directory')
 await rejectLinks(project)
 const manifestPath=join(project,'package.json'),serverPath=join(project,'api/server.mjs'),profilePath=join(project,'api/config/profile.json')
 const lockPath=join(project,'api/.create-feathers-service.lock')
 for(const file of [manifestPath,serverPath,profilePath,lockPath]) await rejectLinks(file)
 if(!existsSync(manifestPath)||!existsSync(serverPath)||!existsSync(profilePath))throw new Error('Not a CLI generated project')
 // Only one service may update the registry and manifest at a time. A stale lock
 // must be inspected by the operator rather than automatically stolen.
 let ownsLock=false
 if(!opts.dryRun){
  try{await writeFile(lockPath,JSON.stringify({pid:process.pid})+'\n',{flag:'wx'});ownsLock=true}
  catch(error){if(error?.code==='EEXIST')throw new Error('Concurrent service generation or stale lock; refusing changes');throw error}
 }
 try {
  const manifestSource=await readFile(manifestPath,'utf8')
  const text=await readFile(serverPath,'utf8')
  const manifest=JSON.parse(manifestSource)
  const profile=JSON.parse(await readFile(profilePath,'utf8'))
  if(!manifest||typeof manifest!=='object'||Array.isArray(manifest)||!manifest.dependencies||typeof manifest.dependencies!=='object'||Array.isArray(manifest.dependencies))throw new Error('Invalid project dependencies manifest')
  const schema=opts.schema??profile.schema,auth=opts.auth??profile.auth,db=opts.db??profile.primary,lang=opts.lang??'js'
  if(!VALID_SCHEMA.has(schema))throw new Error('Invalid schema')
  if(!VALID_AUTH.has(auth))throw new Error('Service supports none|jwt; OAuth2/OIDC/Keycloak require audited identity integration')
  if(auth!=='none' && profile.auth!==auth)throw new Error('Service auth must match configured project profile')
  if(!Array.isArray(profile.databases))throw new Error('Invalid project database profile')
  const connection=profile.databases.find(x=>x && x.alias===db)
  if(!connection)throw new Error('Unknown database alias: '+db)
  const destination=join(project,'api/services',opts.name)
  await rejectLinks(destination)
  if(existsSync(destination))throw new Error('Service already exists; refusing overwrite')
  const marker='const modules = [\n'
  if(text.split(marker).length!==2)throw new Error('Missing or ambiguous Feathers modules registry; no changes made')
  const ext=lang==='ts'?'ts':'mjs'
  const moduleEntry=`  new URL('./services/${opts.name}/${opts.name}.service.${ext}', import.meta.url),\n`
  if(text.includes(moduleEntry))throw new Error('Duplicate service registration')
  const tsReady = lang !== 'ts' || (typeof manifest.scripts?.['dev:api'] === 'string' && manifest.scripts['dev:api'].includes('api/server.mjs') && manifest.scripts?.['dev:all'] !== 'vite --host 127.0.0.1')
  const ready=connection.adapter==='memory'&&auth==='none'&&profile.auth==='none'&&tsReady
  const output={name:opts.name,project,database:{alias:db,adapter:connection.adapter},auth,schema,lang,files:[`api/services/${opts.name}/schema.${ext}`,`api/services/${opts.name}/service.class.${ext}`,`api/services/${opts.name}/${opts.name}.service.${ext}`,`api/services/${opts.name}/contract.json`],ready}
  if(opts.dryRun)return output
  if(connection.adapter!=='memory')throw new Error('Database adapter not provisioned for service: '+connection.adapter+'. Refusing implicit in-memory fallback')
  if(!tsReady)throw new Error('TypeScript services require a separate API runtime; Vite-embedded runtime not yet certified')
  if(!ready)throw new Error('Authentication infrastructure not provisioned; refusing service generation')
  const deps=schema==='zod'?{'zod':'^4.1.0'}:schema==='typebox'?{'@feathersjs/typebox':'5.0.51','ajv':'^8.17.1'}:{'ajv':'^8.17.1'}
  const dependencies={...manifest.dependencies}
  for(const [name,version] of Object.entries(deps))dependencies[name]??=version
  let manifestResult
  const tsconfigPath = join(project, 'api/tsconfig.json')
  let writeTsconfig = false
  if(lang==='ts'){
   await rejectLinks(tsconfigPath)
   if(existsSync(tsconfigPath)){
    const existing = JSON.parse(await readFile(tsconfigPath,'utf8'))
    if(existing?.compilerOptions?.strict!==true||existing?.compilerOptions?.noEmit!==true||existing?.compilerOptions?.allowImportingTsExtensions!==true)throw new Error('Unsafe existing TypeScript API configuration')
   } else writeTsconfig=true
   // Node --import tsx ensures .ts service registration is executable by the standalone Feathers API.
   const scripts={...manifest.scripts,'dev:api':manifest.scripts['dev:api'].includes('--import tsx')?manifest.scripts['dev:api']:manifest.scripts['dev:api'].replace(/^node\s+/, 'node --import tsx '), 'typecheck:api':'tsc --noEmit -p api/tsconfig.json'}
   // Preserve any project-level Vue/Quasar typecheck command while requiring strict backend checks.
   if(!scripts.typecheck?.includes('typecheck:api')) scripts.typecheck=(scripts.typecheck??'tsc --noEmit')+' && npm run typecheck:api'
   const devDependencies={...manifest.devDependencies,tsx:manifest.devDependencies?.tsx??'^4.20.0',typescript:manifest.devDependencies?.typescript??'^5.9.3','@types/node':manifest.devDependencies?.['@types/node']??'^22.0.0'}
   manifestResult=JSON.stringify({...manifest,dependencies,devDependencies,scripts},null,2)+'\n'
  } else manifestResult=JSON.stringify({...manifest,dependencies},null,2)+'\n'
  const files=lang==='ts'
    ? Object.entries({'schema.ts':schemaSourceTs(schema),'service.class.ts':classSourceTs(),[`${opts.name}.service.ts`]:registrarTs(opts.name)})
    : Object.entries({'schema.mjs':schemaSource(schema),'service.class.mjs':classSource(),[`${opts.name}.service.mjs`]:registrar(opts.name,auth)})
  const templates = Object.fromEntries(files)
  const contractText = canonicalGeneratedContract({ name: opts.name, schema, lang, schemaContents: templates[`schema.${ext}`], registrarContents: templates[`${opts.name}.service.${ext}`] })
  files.push(['contract.json', contractText])
  let directoryCreated=false, serverAttempted=false, manifestAttempted=false, tsconfigAttempted=false
  try {
   await mkdir(destination,{recursive:false});directoryCreated=true
   for(const [name,contents] of files)await io.writeFile(join(destination,name),contents,{flag:'wx'})
   if(writeTsconfig){tsconfigAttempted=true;await io.writeFile(tsconfigPath,tsServiceConfig,{flag:'wx'})}
   serverAttempted=true
   await io.writeFile(serverPath,text.replace(marker,marker+moduleEntry))
   manifestAttempted=true
   await io.writeFile(manifestPath,manifestResult)
  } catch(error) {
   const failures=[]
   // Restore even when a write was interrupted in the middle of a file.
   if(manifestAttempted)try{await writeFile(manifestPath,manifestSource)}catch(e){failures.push(e)}
   if(tsconfigAttempted)try{await rm(tsconfigPath,{force:true})}catch(e){failures.push(e)}
   if(serverAttempted)try{await writeFile(serverPath,text)}catch(e){failures.push(e)}
   if(directoryCreated)try{await rm(destination,{recursive:true,force:true})}catch(e){failures.push(e)}
   if(failures.length)throw new AggregateError([error,...failures],'Service generation failed; rollback incomplete; inspect project before retry')
   throw error
  }
  return output
 } finally {
  if(ownsLock)await rm(lockPath,{force:true})
 }
}
export async function runServiceCommand(args,cwd){
 const result=await generateService(parseServiceArguments(args),cwd)
 console.log(JSON.stringify(result,null,2))
}
