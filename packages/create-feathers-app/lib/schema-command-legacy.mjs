import { emit, localPath, parseFlags, readSafeJson, safeName } from './command-safety.mjs'

const TYPES = new Set(['string','int','number','boolean'])
const BANNED = new Set(['id','__proto__','constructor','prototype','toString','valueOf'])
export function parseFields(text) {
  if (typeof text !== 'string' || text.length > 2048 || !text.length) throw new Error('INVALID_FIELDS')
  const fields = text.split(',')
  if (fields.length > 32) throw new Error('TOO_MANY_FIELDS')
  const parsed = new Map()
  for (const field of fields) {
    const m = /^([a-z][a-zA-Z0-9_]{0,40}):(string|int|number|boolean)([!?])$/.exec(field)
    if (!m || BANNED.has(m[1]) || parsed.has(m[1]) || !TYPES.has(m[2])) throw new Error('UNSAFE_OR_DUPLICATE_FIELD')
    parsed.set(m[1], { type: m[2], required: m[3] === '!' })
  }
  return parsed
}
function typeSchema(type) {
  if (type === 'string') return { type: 'string', minLength: 1, maxLength: 120 }
  if (type === 'int') return { type: 'integer', minimum: -1000000000, maximum: 1000000000 }
  if (type === 'number') return { type: 'number', minimum: -1000000000, maximum: 1000000000 }
  return { type: 'boolean' }
}
function sortedEntries(fields) { return [...fields.entries()].sort(([a], [b]) => a.localeCompare(b, 'en')) }
export function planSchema(name, rawFields) {
  if (!safeName(name)) throw new Error('INVALID_SERVICE_NAME')
  const fields = parseFields(rawFields)
  const properties = Object.fromEntries(sortedEntries(fields).map(([key, value]) => [key, typeSchema(value.type)]))
  const required = sortedEntries(fields).filter(([,v])=>v.required).map(([key])=>key)
  const data = { type:'object', additionalProperties:false, properties, required }
  const patch = { type:'object', additionalProperties:false, minProperties:1, properties }
  const result = { type:'object', additionalProperties:false, properties: { id: { type: 'integer', minimum: 1 }, ...properties }, required: ['id', ...required] }
  const query = { type:'object', additionalProperties:false, properties:{...properties, $limit:{type:'integer',minimum:0,maximum:1000},$skip:{type:'integer',minimum:0,maximum:1000}} }
  return {status:'SCHEMA_PLAN_ONLY', message:`${name}: schemas generated in memory; not registered in a Feathers service`, name, data, patch, query, result, runtimeReady:false }
}
function validScalar(value, schema) {
  if (schema.type === 'string') return typeof value === 'string' && value.length >= 1 && value.length <= 120
  if (schema.type === 'boolean') return typeof value === 'boolean'
  if (schema.type === 'integer') return Number.isSafeInteger(value) && value >= (schema.minimum ?? -Infinity) && value <= (schema.maximum ?? Infinity)
  return typeof value === 'number' && Number.isFinite(value) && value >= (schema.minimum ?? -Infinity) && value <= (schema.maximum ?? Infinity)
}
export function validateAgainstPlan(plan, data, operation = 'data') {
  if (!['data','patch','query','result'].includes(operation)) throw new Error('INVALID_SCHEMA_OPERATION')
  if (data === null || typeof data !== 'object' || Array.isArray(data)) throw new Error('INVALID_SCHEMA_INPUT')
  const schema = plan[operation]
  const properties = schema.properties
  for (const key of Object.keys(data)) {
    if (!Object.hasOwn(properties, key) || !validScalar(data[key], properties[key])) throw new Error('SCHEMA_VALIDATION_REFUSED')
  }
  for (const required of schema.required || []) if (!Object.hasOwn(data, required)) throw new Error('SCHEMA_REQUIRED_FIELD_MISSING')
  if (operation === 'patch' && Object.keys(data).length === 0) throw new Error('SCHEMA_EMPTY_PATCH_REFUSED')
  return { status:'SCHEMA_VALIDATION_PASS', message:`${plan.name}: ${operation} validation passed`, operation, fields: Object.keys(data).length }
}
export async function runSchemaCommand(args, cwd = process.cwd()) {
  const action = args[0]
  if (action === 'add') throw new Error('SCHEMA_ADD_BLOCKED_PENDING_SERVICE_GENERATOR_CERTIFICATION')
  if (action !== 'plan' && action !== 'validate') throw new Error('USE_SCHEMA_PLAN_OR_VALIDATE')
  const name = args[1]
  if (!safeName(name)) throw new Error('INVALID_SERVICE_NAME')
  const allowed = action === 'plan' ? new Set(['--fields','--json']) : new Set(['--fields','--data','--operation','--json'])
  const flags = parseFlags(args.slice(2), allowed)
  const plan = planSchema(name, flags.get('--fields'))
  let result = plan
  if (action === 'validate') {
    const path = localPath(cwd, flags.get('--data'))
    const json = readSafeJson(path)
    result = validateAgainstPlan(plan, json, flags.get('--operation') || 'data')
  }
  emit(result, flags.has('--json'))
  return result
}
