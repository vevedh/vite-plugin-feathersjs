// Opt-in strict TypeScript Feathers service output for separately hosted API.
// Keep the established JS defaults untouched; never generate a TypeScript facade.
export const tsServiceConfig = JSON.stringify({
  compilerOptions: {
    target: 'ES2022', module: 'NodeNext', moduleResolution: 'NodeNext',
    lib: ['ES2022'], types: ['node'], strict: true, noEmit: true,
    isolatedModules: true, exactOptionalPropertyTypes: true,
    noUncheckedIndexedAccess: true, allowImportingTsExtensions: true,
    skipLibCheck: true,
  }, include: ['services/**/*.ts'],
}, null, 2) + '\n'

const querySource = `
export interface ValidQuery { title?: string; $limit?: number; $skip?: number }
export function validateQuery(value: unknown): ValidQuery {
  if (value === undefined || value === null) return {}
  if (typeof value !== 'object' || Array.isArray(value)) throw new BadRequest('Invalid query')
  const result: ValidQuery = {}
  for (const [key, raw] of Object.entries(value)) {
    if (key === 'title') {
      if (typeof raw !== 'string' || raw.length > 120 || raw.trim().length < 1) throw new BadRequest('Invalid query title')
      result.title = raw.trim()
      continue
    }
    if (key === '$limit' || key === '$skip') {
      if (typeof raw !== 'number' && typeof raw !== 'string') throw new BadRequest('Invalid query pagination')
      if (typeof raw === 'string' && !/^(0|[1-9][0-9]*)$/.test(raw)) throw new BadRequest('Invalid query pagination')
      const n = Number(raw)
      if (!Number.isSafeInteger(n) || n < 0 || n > 1000) throw new BadRequest('Invalid query pagination')
      result[key] = n
      continue
    }
    throw new BadRequest('Unsupported query field')
  }
  return result
}
`

export function schemaSourceTs(schema) {
  const opening = "import { BadRequest } from '@feathersjs/errors'\n" +
    'export interface ServiceData { title: string }\n' +
    'export type ServicePatch = Partial<ServiceData>\n'
  if (schema === 'zod') return opening + `import { z } from 'zod'
export const dataSchema = z.object({title: z.string().trim().min(1).max(120)}).strict()
export const patchSchema = dataSchema.partial()
export function validateData(value: unknown): ServiceData {
  const parsed = dataSchema.safeParse(value)
  if (!parsed.success) throw new BadRequest('Invalid service data')
  return parsed.data
}
export function validatePatch(value: unknown): ServicePatch {
  const parsed = patchSchema.safeParse(value)
  // .partial() permits an explicit undefined; never allow it to erase an existing title.
  if (!parsed.success || typeof parsed.data.title !== 'string') throw new BadRequest('Invalid service patch')
  return { title: parsed.data.title }
}
` + querySource
  const declarations = schema === 'typebox'
    ? `import { Type } from '@feathersjs/typebox'
const titleSchema = Type.String({minLength:1,maxLength:120})
export const dataSchema = Type.Object({title:titleSchema},{additionalProperties:false})
export const patchSchema = Type.Object({title:Type.Optional(titleSchema)},{additionalProperties:false})
`
    : `const titleSchema = {type:'string',minLength:1,maxLength:120}
export const dataSchema = {type:'object',additionalProperties:false,required:['title'],properties:{title:titleSchema}}
export const patchSchema = {type:'object',additionalProperties:false,properties:{title:titleSchema}}
`
  return opening + "import AjvModule, { type ValidateFunction } from 'ajv'\n" + declarations + `// Ajv v8 ships CommonJS: NodeNext resolves its default import to the module namespace.\nconst Ajv = AjvModule.default\nconst ajv = new Ajv({allErrors:true,coerceTypes:false,removeAdditional:false,useDefaults:false})
const validData = ajv.compile(dataSchema)
const validPatch = ajv.compile(patchSchema)
function normalized(value: unknown, validator: ValidateFunction, operation: string): ServiceData {
  if (value === null || typeof value !== 'object' || Array.isArray(value) ||
      !('title' in value) || typeof value.title !== 'string') throw new BadRequest('Invalid service ' + operation)
  const canonical = { ...value, title: value.title.trim() }
  if (!validator(canonical) || !canonical.title) throw new BadRequest('Invalid service ' + operation)
  return { title: canonical.title }
}
export function validateData(value: unknown): ServiceData { return normalized(value, validData, 'data') }
export function validatePatch(value: unknown): ServicePatch { return normalized(value, validPatch, 'patch') }
` + querySource
}

export function classSourceTs() {
  return `import { NotFound, BadRequest } from '@feathersjs/errors'
import type { Id, Params } from '@feathersjs/feathers'
import { validateData, validatePatch, validateQuery, type ServiceData, type ServicePatch } from './schema.ts'
export interface ServiceRecord { id: number; title: string }
export class GeneratedService {
  readonly #items = new Map<number, ServiceRecord>()
  #counter = 1
  constructor() {
    this.find = this.find.bind(this)
    this.get = this.get.bind(this)
    this.create = this.create.bind(this)
    this.patch = this.patch.bind(this)
    this.remove = this.remove.bind(this)
  }
  #id(value: Id): number {
    if (typeof value !== 'number' && typeof value !== 'string') throw new BadRequest('Invalid ID')
    if (typeof value === 'string' && !/^[1-9][0-9]*$/.test(value)) throw new BadRequest('Invalid ID')
    const n = Number(value)
    if (!Number.isSafeInteger(n) || n < 1) throw new BadRequest('Invalid ID')
    return n
  }
  async find(params: Params = {}): Promise<ServiceRecord[]> {
    const query = validateQuery(params.query)
    const values = [...this.#items.values()].filter(row => query.title === undefined || row.title === query.title)
    return values.slice(query.$skip ?? 0, (query.$skip ?? 0) + (query.$limit ?? values.length)).map(row => ({...row}))
  }
  async get(id: Id): Promise<ServiceRecord> {
    const item = this.#items.get(this.#id(id))
    if (!item) throw new NotFound('Not found')
    return {...item}
  }
  async create(data: ServiceData): Promise<ServiceRecord> {
    const input = validateData(data)
    const row = {id: this.#counter++, ...input}
    this.#items.set(row.id, row)
    return {...row}
  }
  async patch(id: Id, data: ServicePatch): Promise<ServiceRecord> {
    const key = this.#id(id)
    const row = this.#items.get(key)
    if (!row) throw new NotFound('Not found')
    const next = {...row, ...validatePatch(data)}
    this.#items.set(key, next)
    return {...next}
  }
  async remove(id: Id): Promise<ServiceRecord> {
    const key = this.#id(id)
    const row = this.#items.get(key)
    if (!row) throw new NotFound('Not found')
    this.#items.delete(key)
    return {...row}
  }
}
`
}

export function registrarTs(name) {
  return `import type { Application } from '@feathersjs/feathers'
import { GeneratedService } from './service.class.ts'
export default function register(app: Application): void {
  app.use('${name}', new GeneratedService(), {methods: ['find','get','create','patch','remove']})
  // No authentication: demo service must only listen on loopback.
}
`
}
