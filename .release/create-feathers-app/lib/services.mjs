import { existsSync } from 'node:fs'
import { lstat, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve, sep } from 'node:path'

const VALID_NAME = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/
const VALID_SCHEMA = new Set(['typebox','json','zod'])
const VALID_AUTH = new Set(['none','jwt'])
function safeName(s){return typeof s==='string' && s.length<=48 && VALID_NAME.test(s) && !/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(s)}
async function rejectLinks(path){
 let current=path
 while(true){if(existsSync(current)&&(await lstat(current)).isSymbolicLink())throw new Error('Symlink path refused');const next=dirname(current);if(next===current)break;current=next}
}
export function parseServiceArguments(args){
 if(args[0]!=='add')throw new Error('Use: service add <name> [--project <dir>] [--schema typebox|json|zod] [--db <alias>] [--auth none|jwt] [--dry-run]')
 if(!safeName(args[1]))throw new Error('Invalid service name (lowercase kebab-case)')
 const options={name:args[1],project:'.',schema:undefined,db:undefined,auth:undefined,dryRun:false}
 const keys=new Map([['--project','project'],['--schema','schema'],['--db','db'],['--auth','auth']])
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
 if(!VALID_SCHEMA.has(options.schema??'typebox'))throw new Error('Invalid schema')
 if(!VALID_AUTH.has(options.auth??'none'))throw new Error('Invalid service auth: none|jwt')
 if(options.db!==undefined&&!safeName(options.db))throw new Error('Invalid database alias')
 if(!/^\.?\/?[a-zA-Z0-9._/-]*$/.test(options.project)||options.project.includes('..')||options.project.includes('\\')||options.project.startsWith('/'))throw new Error('Unsafe project path; use a local relative directory')
 return options
}
function schemaSource(schema){
 const opening="import { BadRequest } from '@feathersjs/errors'\n"
 if(schema==='zod')return opening+`import { z } from 'zod'
export const dataSchema=z.object({title:z.string().trim().min(1).max(120)}).strict()
export function validateData(value){const parsed=dataSchema.safeParse(value);if(!parsed.success)throw new BadRequest('Invalid service data');return parsed.data}
`
 const def=schema==='typebox'?`import { Type } from '@feathersjs/typebox'
export const dataSchema=Type.Object({title:Type.String({minLength:1,maxLength:120})},{additionalProperties:false})
`:`export const dataSchema={type:'object',additionalProperties:false,required:['title'],properties:{title:{type:'string',minLength:1,maxLength:120}}}
`
 return opening+`import Ajv from 'ajv'
`+def+`const valid=new Ajv({allErrors:true}).compile(dataSchema)
export function validateData(value){if(!valid(value))throw new BadRequest('Invalid service data');return {title:value.title.trim()}}
`
}
function classSource(){return `import { NotFound, BadRequest } from '@feathersjs/errors'
import { validateData } from './schema.mjs'
export class GeneratedService {
  #items=new Map()
  #counter=1
  constructor(){for(const method of ['find','get','create','patch','remove'])this[method]=this[method].bind(this)}
  #id(value){const n=Number(value);if(!Number.isSafeInteger(n)||n<1)throw new BadRequest('Invalid ID');return n}
  async find(){return [...this.#items.values()].map(x=>({...x}))}
  async get(id){const item=this.#items.get(this.#id(id));if(!item)throw new NotFound('Not found');return {...item}}
  async create(data){const row={id:this.#counter++,...validateData(data)};this.#items.set(row.id,row);return {...row}}
  async patch(id,data){const key=this.#id(id);if(!this.#items.has(key))throw new NotFound('Not found');const row={id:key,...validateData(data)};this.#items.set(key,row);return {...row}}
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
export async function generateService(opts, cwd=process.cwd()){
 const project=resolve(cwd,opts.project)
 if(opts.project!=='.' && !project.startsWith(resolve(cwd)+sep))throw new Error('Project escapes current directory')
 await rejectLinks(project)
 const manifestPath=join(project,'package.json'),serverPath=join(project,'api/server.mjs'),profilePath=join(project,'api/config/profile.json')
 if(!existsSync(manifestPath)||!existsSync(serverPath)||!existsSync(profilePath))throw new Error('Not a CLI generated project')
 const manifest=JSON.parse(await readFile(manifestPath,'utf8'))
 const profile=JSON.parse(await readFile(profilePath,'utf8'))
 const schema=opts.schema??profile.schema,auth=opts.auth??profile.auth,db=opts.db??profile.primary
 if(!VALID_SCHEMA.has(schema))throw new Error('Invalid schema')
 if(!VALID_AUTH.has(auth))throw new Error('Service supports none|jwt; OAuth2/OIDC/Keycloak require audited identity integration')
 if(auth!=='none' && profile.auth!==auth)throw new Error('Service auth must match configured project profile')
 const connection=profile.databases.find(x=>x.alias===db)
 if(!connection)throw new Error('Unknown database alias: '+db)
 const destination=join(project,'api/services',opts.name)
 await rejectLinks(destination)
 if(existsSync(destination))throw new Error('Service already exists; refusing overwrite')
 const text=await readFile(serverPath,'utf8')
 const marker='const modules = [\n'
 if(!text.includes(marker))throw new Error('Missing Feathers modules registry; no changes made')
 const moduleEntry=`  new URL('./services/${opts.name}/${opts.name}.service.mjs', import.meta.url),\n`
 if(text.includes(moduleEntry))throw new Error('Duplicate service registration')
 // Never replace a user-controlled arbitrary string outside of the explicit registry.
 const output={name:opts.name,project,database:{alias:db,adapter:connection.adapter},auth,schema,files:[`api/services/${opts.name}/schema.mjs`,`api/services/${opts.name}/service.class.mjs`,`api/services/${opts.name}/${opts.name}.service.mjs`],ready:connection.adapter==='memory'&&auth==='none'}
 if(opts.dryRun)return output
 const dependencies=manifest.dependencies||{}
 const deps=schema==='zod'?{'zod':'^4.1.0'}:schema==='typebox'?{'@feathersjs/typebox':'^5.0.50','ajv':'^8.17.1'}:{'ajv':'^8.17.1'}
 if(auth==='jwt')deps['@feathersjs/authentication']='^5.0.50'
 for(const [name,version] of Object.entries(deps))dependencies[name]??=version
 await mkdir(destination,{recursive:false})
 for(const [name,contents] of Object.entries({'schema.mjs':schemaSource(schema),'service.class.mjs':classSource(),[`${opts.name}.service.mjs`]:registrar(opts.name,auth)}))await writeFile(join(destination,name),contents,{flag:'wx'})
 await writeFile(serverPath,text.replace(marker,marker+moduleEntry))
 await writeFile(manifestPath,JSON.stringify({...manifest,dependencies},null,2)+'\n')
 return output
}
export async function runServiceCommand(args,cwd){
 const result=await generateService(parseServiceArguments(args),cwd)
 console.log(JSON.stringify(result,null,2))
}
