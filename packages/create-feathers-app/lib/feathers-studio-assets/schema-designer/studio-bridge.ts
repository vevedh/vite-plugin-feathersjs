/**
 * R14-S5-R6: explicit adapter from the VERIFIED R14-S5-R5 development catalog
 * to the unchanged R14-S4 draft model. No arbitrary schema inference.
 * Manual services stay visible in DevTools, but are not editable in this designer.
 */
import { parseCatalog } from './model'
import type { DesignerCatalog, DesignerService } from './model'

const hex = /^[a-f0-9]{64}$/
const identifier = /^[a-z][a-z0-9]{0,47}$/
const requiredMethods = ['find', 'get', 'create', 'patch', 'remove'] as const
const safe = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const exact = (value: Record<string, unknown>, keys: readonly string[]): boolean => Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key))

export interface BridgeCatalog {
  readonly catalog: DesignerCatalog
  readonly excludedManual: number
}

/** Every accepted service is already verified server-side against two source SHA-256 hashes. */
export function parseStudioBridge(input: unknown): BridgeCatalog {
  if (!safe(input) || !exact(input, ['version', 'mode', 'services']) || input.version !== 1 || input.mode !== 'READ_ONLY' || !Array.isArray(input.services) || input.services.length > 32) throw Error('R6_STUDIO_CATALOG_INVALID')
  const services: DesignerService[] = []
  let excludedManual = 0
  const seen = new Set<string>()
  for (const raw of input.services as unknown[]) {
    if (!safe(raw) || !exact(raw, ['name', 'route', 'schema', 'docs', 'methods', 'fields', 'fingerprint', 'sourceVerified']) || typeof raw.name !== 'string' || !identifier.test(raw.name) || seen.has(raw.name) || raw.route !== `/api/${raw.name}` || raw.sourceVerified !== true || typeof raw.fingerprint !== 'string' || !hex.test(raw.fingerprint) || !Array.isArray(raw.methods) || raw.methods.length !== requiredMethods.length || raw.methods.some((m, i) => m !== requiredMethods[i]) || !Array.isArray(raw.fields) || raw.fields.length < 1 || raw.fields.length > 32) throw Error('R6_STUDIO_SERVICE_INVALID')
    seen.add(raw.name)
    const fields = raw.fields.map((field: unknown) => {
      if (!safe(field) || !exact(field, ['name', 'type', 'required', 'minLength', 'maxLength']) || typeof field.name !== 'string' || !identifier.test(field.name) || field.type !== 'string' || typeof field.required !== 'boolean' || field.minLength !== 1 || field.maxLength !== 120) throw Error('R6_STUDIO_FIELD_INVALID')
      return { name: field.name, type: 'string' as const, required: field.required, constraints: { minLength: field.minLength as number, maxLength: field.maxLength as number } }
    })
    if (new Set(fields.map(field => field.name)).size !== fields.length) throw Error('R6_STUDIO_FIELD_DUPLICATE')
    if (raw.schema === 'manual') { excludedManual++; continue }
    if (!['zod', 'json', 'typebox'].includes(String(raw.schema)) || !['off', 'vitepress'].includes(String(raw.docs))) throw Error('R6_STUDIO_ENGINE_UNSUPPORTED')
    services.push({name: raw.name, route: raw.route as string, engine: raw.schema as DesignerService['engine'], docs: raw.docs as DesignerService['docs'], fields, contractSha256: raw.fingerprint})
  }
  const catalog = parseCatalog({version: 1, status: 'READ_ONLY', source: 'R14-S5-R5-VERIFIED', services, relations: []})
  return {catalog, excludedManual}
}

/** Query parameters are merely a selection hint, never a filesystem path. */
export function resolveSelection(query: string, catalog: DesignerCatalog): string {
  if (query.length > 256) return catalog.services[0]?.name ?? ''
  const name = new URLSearchParams(query).get('service')
  return catalog.services.find(service => service.name === name)?.name ?? catalog.services[0]?.name ?? ''
}
