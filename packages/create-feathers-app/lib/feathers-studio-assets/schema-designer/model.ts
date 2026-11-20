/** R14-S4-R2: draft-only constraints and logical references. Never executes schemas. */
export type SchemaEngine = 'zod' | 'json' | 'typebox'
export type FieldType = 'string' | 'boolean' | 'int' | 'number'
export type DocsMode = 'off' | 'vitepress'
export type RelationKind = 'many-to-one' | 'one-to-one'

export interface DesignerField { name: string; type: FieldType; required: boolean; constraints?: FieldConstraints }
export interface DesignerService {
  name: string
  route: string
  engine: SchemaEngine
  docs: DocsMode
  fields: DesignerField[]
  contractSha256: string
}
export interface DesignerCatalog {
  version: 1
  status: 'READ_ONLY'
  source: string
  services: DesignerService[]
  relations: []
}
export interface DesignerPosition { x: number; y: number }
export interface FieldConstraints { minLength?: number; maxLength?: number; minimum?: number; maximum?: number }
export interface DesignerDraftField extends DesignerField { constraints?: FieldConstraints }
export interface DesignerDraft { name: string; engine: SchemaEngine; docs: DocsMode; fields: DesignerDraftField[] }
/** Logical draft reference: integer field -> generated integer id on a different service. */
export interface DesignerRelation {
  id: string
  fromService: string
  fromField: string
  toService: string
  toField: 'id'
  kind: RelationKind
}

const types: readonly string[] = ['string','boolean','int','number']
const engines: readonly string[] = ['typebox','json','zod']
const sha = /^[0-9a-f]{64}$/
const identifier = /^[a-z][a-z0-9]{0,47}$/
const relationId = /^r[1-9][0-9]{0,5}$/
const dangerous = new Set(['__proto__','prototype','constructor'])
const record = (v: unknown): v is Record<string,unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const safeId = (v: string): boolean => identifier.test(v) && !dangerous.has(v)
const finiteIn = (v: unknown, low: number, high: number, int = false): v is number => typeof v === 'number' && Number.isFinite(v) && v >= low && v <= high && (!int || Number.isInteger(v))

/** Parse *only* the reviewed R1 read-only catalog, not raw arbitrary contracts. */
export function parseCatalog(value: unknown): DesignerCatalog {
  if (!record(value) || value.version !== 1 || value.status !== 'READ_ONLY' || !Array.isArray(value.services) || value.services.length > 32 || !Array.isArray(value.relations) || value.relations.length !== 0) throw Error('CATALOG_INVALID')
  const names = new Set<string>()
  const services: DesignerService[] = value.services.map((input: unknown) => {
    if (!record(input) || typeof input.name !== 'string' || !safeId(input.name) || typeof input.route !== 'string' || input.route !== `/api/${input.name}` || !engines.includes(String(input.engine)) || !['off','vitepress'].includes(String(input.docs)) || typeof input.contractSha256 !== 'string' || !sha.test(input.contractSha256) || !Array.isArray(input.fields) || input.fields.length < 1 || input.fields.length > 32 || names.has(input.name)) throw Error('CATALOG_SERVICE_INVALID')
    names.add(input.name)
    const fields = input.fields.map((entry: unknown): DesignerField => {
      if (!record(entry) || typeof entry.name !== 'string' || !safeId(entry.name) || typeof entry.type !== 'string' || !types.includes(entry.type) || typeof entry.required !== 'boolean') throw Error('CATALOG_FIELD_INVALID')
      if (Object.keys(entry).some(key => !['name','type','required','constraints'].includes(key))) throw Error('CATALOG_FIELD_KEYS_INVALID')
      let constraints: FieldConstraints | undefined
      if (Object.hasOwn(entry, 'constraints')) {
        const c = entry.constraints
        if (!record(c) || entry.type !== 'string' || Object.keys(c).length !== 2 || !Object.hasOwn(c,'minLength') || !Object.hasOwn(c,'maxLength') || !finiteIn(c.minLength,0,120,true) || !finiteIn(c.maxLength,1,120,true) || c.minLength > c.maxLength) throw Error('CATALOG_CONSTRAINTS_INVALID')
        constraints = { minLength: c.minLength, maxLength: c.maxLength }
      }
      return { name: entry.name, type: entry.type as FieldType, required: entry.required, ...(constraints ? { constraints } : {}) }
    })
    if (new Set(fields.map(f => f.name)).size !== fields.length) throw Error('CATALOG_DUPLICATE_FIELD')
    return {name:input.name,route:input.route,engine:input.engine as SchemaEngine,docs:input.docs as DocsMode,fields,contractSha256:input.contractSha256}
  })
  return {version:1,status:'READ_ONLY',source:typeof value.source==='string'?value.source.slice(0,64):'',relations:[],services}
}

export function makeDraft(service: DesignerService): DesignerDraft {
  return {name:service.name,engine:service.engine,docs:service.docs,fields:service.fields.map(field=>({...field, ...(field.constraints ? { constraints: { ...field.constraints } } : {})}))}
}
export function validateDraft(draft: DesignerDraft): string[] {
  const errors: string[] = []
  if (!safeId(draft.name)) errors.push('Nom du service invalide')
  if (!engines.includes(draft.engine)) errors.push('Moteur invalide')
  if (!['off','vitepress'].includes(draft.docs)) errors.push('Documentation invalide')
  if (draft.fields.length < 1 || draft.fields.length > 32) errors.push('1 à 32 champs requis')
  const names = new Set<string>()
  for (const field of draft.fields) {
    if (!safeId(field.name)) errors.push(`Nom de champ invalide : ${field.name.slice(0,48)}`)
    if (names.has(field.name)) errors.push(`Champ dupliqué : ${field.name.slice(0,48)}`)
    names.add(field.name)
    if (!types.includes(field.type)) errors.push('Type invalide')
    if (typeof field.required !== 'boolean') errors.push('Obligation invalide')
    const c = field.constraints
    if (c === undefined) continue
    if (!record(c) || Object.keys(c).some(k=>!['minLength','maxLength','minimum','maximum'].includes(k))) { errors.push(`Contraintes inconnues : ${field.name}`); continue }
    if (field.type === 'string') {
      if ('minimum' in c || 'maximum' in c) errors.push(`Bornes numériques interdites : ${field.name}`)
      if (c.minLength !== undefined && !finiteIn(c.minLength,0,120,true)) errors.push(`Longueur minimale invalide : ${field.name}`)
      if (c.maxLength !== undefined && !finiteIn(c.maxLength,1,120,true)) errors.push(`Longueur maximale invalide : ${field.name}`)
      if (typeof c.minLength === 'number' && typeof c.maxLength === 'number' && c.minLength > c.maxLength) errors.push(`Longueurs incohérentes : ${field.name}`)
    } else if (field.type === 'int' || field.type === 'number') {
      if ('minLength' in c || 'maxLength' in c) errors.push(`Longueur interdite : ${field.name}`)
      const isInt = field.type === 'int'
      if (c.minimum !== undefined && !finiteIn(c.minimum,-1_000_000_000,1_000_000_000,isInt)) errors.push(`Minimum invalide : ${field.name}`)
      if (c.maximum !== undefined && !finiteIn(c.maximum,-1_000_000_000,1_000_000_000,isInt)) errors.push(`Maximum invalide : ${field.name}`)
      if (typeof c.minimum === 'number' && typeof c.maximum === 'number' && c.minimum > c.maximum) errors.push(`Bornes incohérentes : ${field.name}`)
    } else if (Object.keys(c).length) errors.push(`Contraintes interdites : ${field.name}`)
  }
  return errors
}

export function validateRelations(catalog: DesignerCatalog, drafts: Record<string,DesignerDraft>, relations: readonly DesignerRelation[]): string[] {
  const errors: string[] = []
  if (relations.length > 32) errors.push('Maximum 32 relations de brouillon')
  const services = new Set(catalog.services.map(s=>s.name))
  const ids = new Set<string>()
  const links = new Set<string>()
  for (const rel of relations) {
    if (!relationId.test(rel.id) || ids.has(rel.id)) errors.push('Identifiant de relation invalide ou dupliqué')
    ids.add(rel.id)
    if (!services.has(rel.fromService) || !services.has(rel.toService) || rel.fromService === rel.toService) errors.push(`Services de relation invalides : ${rel.id}`)
    const sourceField = drafts[rel.fromService]?.fields.find(f=>f.name===rel.fromField)
    if (!sourceField || sourceField.type !== 'int') errors.push(`Référence entière absente : ${rel.id}`)
    if (rel.toField !== 'id' || !['many-to-one','one-to-one'].includes(rel.kind)) errors.push(`Cible ou cardinalité invalide : ${rel.id}`)
    const key=`${rel.fromService}/${rel.fromField}/${rel.toService}`
    if (links.has(key)) errors.push(`Relation dupliquée : ${rel.id}`)
    links.add(key)
  }
  return errors
}
export function layoutServices(services: readonly DesignerService[]): Record<string,DesignerPosition> {
  const out=Object.create(null) as Record<string,DesignerPosition>
  services.forEach((s,i)=>{out[s.name]={x:42+(i%2)*334,y:42+Math.floor(i/2)*266}})
  return out
}
export function exportDraft(catalog: DesignerCatalog, drafts: Record<string,DesignerDraft>, positions: Record<string,DesignerPosition>, relations: readonly DesignerRelation[] = []): string {
  if (catalog.services.some(s=>{ const draft=drafts[s.name]; return !draft || validateDraft(draft).length>0 })) throw Error('DRAFT_INVALID')
  if (validateRelations(catalog,drafts,relations).length) throw Error('RELATIONS_INVALID')
  const payload={
    format:'feathers-schema-designer-draft',version:2,executable:false,generatedAt:new Date().toISOString(),
    services:catalog.services.map(s=>({
      name:s.name,sourceSha256:s.contractSha256,engine:s.engine,docs:s.docs,route:s.route,
      fields:drafts[s.name]?.fields.map(f=>({...f,...(f.constraints && Object.keys(f.constraints).length?{constraints:{...f.constraints}}:{})})) ?? [],
      position:positions[s.name] ?? {x:0,y:0},
    })),
    relations:relations.map(r=>({...r})),
  }
  return JSON.stringify(payload,null,2)+'\n'
}


/** R14-S4-R3: deterministic, non-executable preview against canonical source fields. */
export type DraftChangeKind = 'field-added' | 'field-removed' | 'field-type' | 'field-required' | 'field-constraints' | 'logical-relation'
export interface DraftChange {
  service: string
  field: string
  kind: DraftChangeKind
  before: string
  after: string
}
export interface DraftPreview {
  version: 1
  mode: 'PREVIEW_ONLY'
  executable: false
  source: 'CANONICAL_REGISTRY'
  serviceCount: number
  modifiedServices: number
  changeCount: number
  blockedForApply: true
  changes: DraftChange[]
  warnings: string[]
}
/** Original source is never changed. This is an advisory diff, NOT a backend migration. */
export function compareDraft(catalog: DesignerCatalog, drafts: Record<string, DesignerDraft>, relations: readonly DesignerRelation[]): DraftPreview {
  if (catalog.services.some(s => { const draft = drafts[s.name]; return !draft || validateDraft(draft).length > 0 || draft.name !== s.name || draft.engine !== s.engine || draft.docs !== s.docs })) throw Error('DRAFT_INVALID')
  if (validateRelations(catalog, drafts, relations).length) throw Error('RELATIONS_INVALID')
  const changes: DraftChange[] = []
  const touched = new Set<string>()
  for (const service of catalog.services) {
    const draft = drafts[service.name]
    if (!draft) throw Error('DRAFT_MISSING')
    const prev = new Map(service.fields.map(f => [f.name, f]))
    const next = new Map(draft.fields.map(f => [f.name, f]))
    for (const field of service.fields) {
      const candidate = next.get(field.name)
      if (!candidate) changes.push({ service: service.name, field: field.name, kind: 'field-removed', before: field.type, after: '' })
      else {
        if (field.type !== candidate.type) changes.push({ service: service.name, field: field.name, kind: 'field-type', before: field.type, after: candidate.type })
        if (field.required !== candidate.required) changes.push({ service: service.name, field: field.name, kind: 'field-required', before: String(field.required), after: String(candidate.required) })
        const serializeConstraints = (f: DesignerField): string => JSON.stringify(f.constraints ? Object.fromEntries(['minLength','maxLength','minimum','maximum'].filter(key => f.constraints && Object.hasOwn(f.constraints,key)).map(key => [key,(f.constraints as Record<string,number>)[key]])) : {})
        const originalBounds = serializeConstraints(field)
        const requestedBounds = serializeConstraints(candidate)
        if (originalBounds !== requestedBounds) changes.push({ service: service.name, field: field.name, kind: 'field-constraints', before: originalBounds, after: requestedBounds })
      }
    }
    for (const field of draft.fields) if (!prev.has(field.name)) changes.push({ service: service.name, field: field.name, kind: 'field-added', before: '', after: `${field.type}${field.required ? '!' : '?'}` })
  }
  for (const r of relations) changes.push({ service: r.fromService, field: r.fromField, kind: 'logical-relation', before: '', after: `${r.kind} -> ${r.toService}.${r.toField}` })
  for (const change of changes) touched.add(change.service)
  return {
    version: 1, mode: 'PREVIEW_ONLY', executable: false, source: 'CANONICAL_REGISTRY',
    serviceCount: catalog.services.length, modifiedServices: touched.size, changeCount: changes.length,
    blockedForApply: true, changes,
    warnings: [
      'Aucune écriture backend. Les services existants nécessitent une migration certifiée.',
      ...(relations.length ? ['Les relations logiques ne créent aucune clé étrangère.'] : []),
      ...(changes.some(c => c.kind === 'field-constraints') ? ['Les bornes personnalisées ne sont pas encore générées par le moteur actuel.'] : []),
    ],
  }
}
