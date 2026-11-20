/** R14-S4-R4.1: imported JSON is untrusted. Strict v2 schema; no executable content. */
import {validateDraft,validateRelations} from './model'
import type {DesignerCatalog,DesignerDraft,DesignerPosition,DesignerRelation,DesignerDraftField,FieldConstraints,RelationKind,FieldType} from './model'
const record=(x:unknown):x is Record<string,unknown>=>typeof x==='object'&&x!==null&&!Array.isArray(x)
const exact=(o:Record<string,unknown>,keys:readonly string[])=>Object.keys(o).length===keys.length&&keys.every(k=>Object.hasOwn(o,k))
const sha=/^[a-f0-9]{64}$/
const id=/^[a-z][a-z0-9]{0,47}$/
const types:readonly string[]=['string','boolean','int','number']
function refuse(reason:string):never{throw Error('IMPORT_DRAFT_'+reason)}
export interface ImportedDraft { drafts:Record<string,DesignerDraft>; positions:Record<string,DesignerPosition>; relations:DesignerRelation[] }
function parseConstraints(v:unknown):FieldConstraints {
 if(!record(v)||Object.keys(v).length===0||Object.keys(v).some(k=>!['minLength','maxLength','minimum','maximum'].includes(k)))return refuse('CONSTRAINTS')
 const r:FieldConstraints={}
 for(const k of ['minLength','maxLength','minimum','maximum'] as const){if(Object.hasOwn(v,k)){if(typeof v[k]!=='number'||!Number.isFinite(v[k]))return refuse('CONSTRAINTS');r[k]=v[k]}}
 return r
}
export function parseImportedDraft(raw:string,catalog:DesignerCatalog):ImportedDraft{
 if(raw.length<80||new TextEncoder().encode(raw).byteLength>65536)return refuse('SIZE')
 let payload:unknown
 try{payload=JSON.parse(raw.replace(/^\uFEFF/,'')) as unknown}catch{return refuse('JSON')}
 if(!record(payload)||!exact(payload,['format','version','executable','generatedAt','services','relations'])||payload.format!=='feathers-schema-designer-draft'||payload.version!==2||payload.executable!==false||typeof payload.generatedAt!=='string'||!/^\d{4}-\d{2}-\d{2}T/.test(payload.generatedAt))return refuse('FORMAT')
 if(!Array.isArray(payload.services)||payload.services.length!==catalog.services.length||!Array.isArray(payload.relations)||payload.relations.length>32)return refuse('COUNT')
 const drafts=Object.create(null) as Record<string,DesignerDraft>
 const positions=Object.create(null) as Record<string,DesignerPosition>
 const known=new Map(catalog.services.map(s=>[s.name,s]))
 for(const s of payload.services as unknown[]){
  if(!record(s)||!exact(s,['name','sourceSha256','engine','docs','route','fields','position'])||typeof s.name!=='string'||!known.has(s.name)||Object.hasOwn(drafts,s.name))return refuse('SERVICE')
  const canonical=known.get(s.name)
  if(!canonical||s.sourceSha256!==canonical.contractSha256||!sha.test(String(s.sourceSha256))||s.engine!==canonical.engine||s.docs!==canonical.docs||s.route!==canonical.route||!Array.isArray(s.fields)||s.fields.length<1||s.fields.length>32)return refuse('DRIFT')
  if(!record(s.position)||!exact(s.position,['x','y'])||typeof s.position.x!=='number'||typeof s.position.y!=='number'||!Number.isFinite(s.position.x)||!Number.isFinite(s.position.y)||s.position.x<0||s.position.x>1440||s.position.y<0||s.position.y>1100)return refuse('POSITION')
  const fields:DesignerDraftField[]=[]
  for(const f of s.fields as unknown[]){
   if(!record(f)||!(exact(f,['name','type','required'])||exact(f,['name','type','required','constraints']))||typeof f.name!=='string'||!id.test(f.name)||!types.includes(String(f.type))||typeof f.required!=='boolean')return refuse('FIELD')
   const field:DesignerDraftField={name:f.name,type:f.type as FieldType,required:f.required}
   if(Object.hasOwn(f,'constraints'))field.constraints=parseConstraints(f.constraints)
   fields.push(field)
  }
  const draft:DesignerDraft={name:s.name,engine:canonical.engine,docs:canonical.docs,fields}
  if(validateDraft(draft).length)return refuse('VALIDATION')
  drafts[s.name]=draft;positions[s.name]={x:s.position.x,y:s.position.y}
 }
 const relations:DesignerRelation[]=[]
 for(const r of payload.relations as unknown[]){
  if(!record(r)||!exact(r,['id','fromService','fromField','toService','toField','kind'])||typeof r.id!=='string'||!/^r[1-9][0-9]{0,5}$/.test(r.id)||typeof r.fromService!=='string'||typeof r.fromField!=='string'||typeof r.toService!=='string'||r.toField!=='id'||(r.kind!=='many-to-one'&&r.kind!=='one-to-one'))return refuse('RELATION')
  relations.push({id:r.id,fromService:r.fromService,fromField:r.fromField,toService:r.toService,toField:'id',kind:r.kind as RelationKind})
 }
 if(validateRelations(catalog,drafts,relations).length)return refuse('RELATION_VALIDATION')
 return {drafts,positions,relations}
}
