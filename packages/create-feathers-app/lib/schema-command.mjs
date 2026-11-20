import { constants, lstatSync, openSync, fstatSync, readSync, closeSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { plan, parse, runSchemaBuild } from './schema-build.mjs'
import { runSchemaAdd } from './schema-add.mjs'
import { runSchemaDocs } from './schema-docs.mjs'

export const schemaHelp = `Schema Builder — local laboratory
  schema plan <name> --fields title:string!,priority:int? [--schema typebox|json|zod] [--api-docs off|json|swagger|vitepress|both] [--json]
  schema validate <name> --fields title:string! --data <relative-json> [--operation data|patch|query|result] [--schema typebox|json|zod] [--json]
  schema build <name> --fields title:string! [--schema typebox|json|zod] [--api-docs off|json|swagger|vitepress|both] [--dir <name>] [--dry-run] [--json]
  schema add <name> --fields title:string! [--project <local-folder>] [--schema typebox|json|zod] [--db <alias>] [--api-docs off|vitepress] [--dry-run] [--json] (Express REST separate, memory, no auth only)
  schema docs enable <name> --api-docs vitepress [--project <path>] [--dry-run] [--json]
  schema docs disable <name> [--project <path>] [--dry-run] [--json]
  schema docs status <name> [--project <path>] [--json] (VitePress only; Swagger policy independent)`
const limit = 65536
function flags(args, allowed) {
 const result = new Map()
 for (let i=0;i<args.length;i++) {
  const key=args[i]
  if (!allowed.includes(key)||result.has(key)) throw Error('INVALID_OR_DUPLICATE_OPTION')
  if (key==='--json') {result.set(key,true);continue}
  const value=args[++i]
  if (typeof value!=='string'||!value||value.startsWith('--')) throw Error('MISSING_VALUE')
  result.set(key,value)
 }
 return result
}
function regularPath(path, directory) {
 const info=lstatSync(path)
 if (info.isSymbolicLink() || (directory ? !info.isDirectory() : !info.isFile())) throw Error('UNSAFE_INPUT_PATH')
 return info
}
export function readLocalJson(cwd, input) {
 try {
  if(typeof input!=='string'||input.length>256||!input.endsWith('.json'))throw Error('INVALID_JSON_PATH')
  const parts=input.replace(/^\.\//,'').split('/')
  if(parts.some(p=>! /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,79}$/.test(p)||p.endsWith('.')||/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(p)))throw Error('INVALID_JSON_PATH')
  const root=resolve(cwd)
  for(let path=root;;path=dirname(path)){regularPath(path,true);if(dirname(path)===path)break}
  let path=root
  for(let i=0;i<parts.length;i++){path=join(path,parts[i]);regularPath(path,i<parts.length-1)}
  const fd=openSync(path,constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0))
  try {
   const info=fstatSync(fd)
   if(!info.isFile()||info.size>limit)throw Error('INPUT_SIZE_OR_TYPE')
   const bytes=Buffer.alloc(limit+1);let size=0
   while(size<bytes.length){const n=readSync(fd,bytes,size,bytes.length-size,null);if(n===0)break;size+=n}
   if(size>limit)throw Error('INPUT_SIZE_OR_TYPE')
   return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes.subarray(0,size)))
  }finally{closeSync(fd)}
 }catch{throw Error('LOCAL_JSON_REFUSED')}
}
function queryScalar(value, schema) {
 if(typeof value==='string'&&(schema.type==='integer'||schema.type==='number')){
  if(value.length>32||! /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/.test(value))throw Error('SCHEMA_VALIDATION_REFUSED')
  return Number(value)
 }
 if(typeof value==='string'&&schema.type==='boolean'){
  if(value==='true')return true
  if(value==='false')return false
  throw Error('SCHEMA_VALIDATION_REFUSED')
 }
 return value
}
function valid(value, schema) {
 switch(schema.type){
  case 'string': return typeof value==='string'&&Array.from(value).length>=schema.minLength&&Array.from(value).length<=schema.maxLength
  case 'boolean': return typeof value==='boolean'
  case 'integer': return Number.isSafeInteger(value)&&value>=schema.minimum&&value<=schema.maximum
  case 'number': return typeof value==='number'&&Number.isFinite(value)&&value>=schema.minimum&&value<=schema.maximum
  default: return false
 }
}
export function validatePlan(contract,value,operation='data') {
 if(!['data','patch','query','result'].includes(operation))throw Error('INVALID_SCHEMA_OPERATION')
 if(value===null||typeof value!=='object'||Array.isArray(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))throw Error('INVALID_SCHEMA_INPUT')
 const schema=contract.schemas[operation]
 const keys=Object.keys(value)
 if(schema.minProperties&&keys.length<schema.minProperties)throw Error('SCHEMA_EMPTY_PATCH_REFUSED')
 for(const key of keys){
  const descriptor=Object.getOwnPropertyDescriptor(value,key)
  if(!Object.hasOwn(schema.properties,key)||!descriptor||!('value' in descriptor))throw Error('SCHEMA_VALIDATION_REFUSED')
  const field=schema.properties[key]
  if(!valid(operation==='query'?queryScalar(descriptor.value,field):descriptor.value,field))throw Error('SCHEMA_VALIDATION_REFUSED')
 }
 for(const key of schema.required??[]) if(!Object.hasOwn(value,key))throw Error('SCHEMA_REQUIRED_FIELD_MISSING')
 return {status:'SCHEMA_VALIDATION_PASS',name:contract.name,operation,fields:keys.length,runtimeCertified:false}
}
export function runSchemaCommand(args,cwd=process.cwd()) {
 if(args.length===0||(args.length===1&&['--help','-h'].includes(args[0])))return schemaHelp
 const action=args[0]
 if(action==='add')return runSchemaAdd(args.slice(1),cwd)
 if(action==='docs')return runSchemaDocs(args.slice(1),cwd)
 if(action==='build'){
  // --json is a CLI presentation flag, not a generator option or value.
  const values=args.slice(1),position=values.indexOf('--json')
  if(position!==-1){if(values.lastIndexOf('--json')!==position||position===0||['--fields','--schema','--api-docs','--dir'].includes(values[position-1]))throw Error('INVALID_JSON_FLAG');values.splice(position,1)}
  parse(values)
  return runSchemaBuild(values,cwd)
 }
 if(!['plan','validate'].includes(action))throw Error('USE_SCHEMA_PLAN_VALIDATE_OR_BUILD')
 const allowed=action==='plan'?['--fields','--schema','--api-docs','--json']:['--fields','--schema','--data','--operation','--json']
 const options=flags(args.slice(2),allowed)
 const contract=plan(args[1],options.get('--fields'),options.get('--schema')??'typebox',options.get('--api-docs')??'off')
 if(action==='plan')return {status:'SCHEMA_PLAN_ONLY',...contract,runtimeCertified:false}
 return validatePlan(contract,readLocalJson(cwd,options.get('--data')),options.get('--operation')??'data')
}
