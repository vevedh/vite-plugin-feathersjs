// Vue DevTools v8 only. This module is imported exclusively from the local SPA entry.
import type { App } from 'vue'
import { addCustomTab, setupDevtoolsPlugin } from '@vue/devtools-api'

interface StudioField { name: string; type: 'string'; required: boolean; minLength: number; maxLength: number }
interface StudioService { name: string; route: string; schema: string; docs: string; methods: string[]; fields: StudioField[]; fingerprint: string; sourceVerified: boolean }
interface StudioCatalog { version: 1; mode: 'READ_ONLY'; services: StudioService[] }
const inspectorId = 'vevedh.feathers-studio.services'
let tabRegistered = false

async function fetchCatalog(): Promise<StudioCatalog> {
  const response = await fetch('/__feathers-studio/catalog', { credentials: 'omit', cache: 'no-store' })
  if (!response.ok) throw new Error('CATALOG_UNAVAILABLE')
  const value: unknown = await response.json()
  if (!value || typeof value !== 'object' || !('mode' in value) || value.mode !== 'READ_ONLY' || !('services' in value) || !Array.isArray(value.services)) throw new Error('CATALOG_INVALID')
  return value as StudioCatalog
}

export function registerFeathersStudioDevtools(app: App): void {
  if (!import.meta.env.DEV) return
  setupDevtoolsPlugin(
    { id: 'vevedh.feathers-studio', label: 'Feathers Studio', app, packageName: 'feathers-studio-schema-builder', enableEarlyProxy: true },
    (api) => {
      api.addInspector({ id: inspectorId, label: 'Services Feathers', icon: 'storage', noSelectionText: 'Sélectionner un service', treeFilterPlaceholder: 'Rechercher un service' })
      api.on.getInspectorTree(async (payload) => {
        if (payload.app !== app || payload.inspectorId !== inspectorId) return
        try {
          const catalog = await fetchCatalog()
          payload.rootNodes = catalog.services.filter((service) => service.name.includes(payload.filter || '')).map((service) => ({ id: service.name, label: service.name, tags: [{ label: service.schema, textColor: 0xffffff, backgroundColor: 0x225d66 }] }))
        } catch { payload.rootNodes = [] }
      })
      api.on.getInspectorState(async (payload) => {
        if (payload.app !== app || payload.inspectorId !== inspectorId) return
        try {
          const catalog = await fetchCatalog()
          const service = catalog.services.find((entry) => entry.name === payload.nodeId)
          if (!service) return
          payload.state = {
            service: [{ key: 'Route', value: service.route, editable: false }, { key: 'Schéma', value: service.schema, editable: false }, { key: 'Méthodes', value: service.methods.join(', '), editable: false }, { key: 'Empreintes sources', value: service.sourceVerified ? 'Vérifiées' : 'Non vérifiées', editable: false }, { key: 'SHA-256 contrat', value: service.fingerprint, editable: false }],
            fields: service.fields.map((field) => ({ key: field.name, value: `${field.type} [${field.minLength}, ${field.maxLength}]${field.required ? ' (requis)' : ' (facultatif)'}`, editable: false })),
          }
        } catch { payload.state = {} }
      })
      if (!tabRegistered) {
        tabRegistered = true
        addCustomTab({ name: 'feathers-studio-schema', title: 'Feathers Studio', icon: 'storage', category: 'modules', view: { type: 'iframe', src: '/__feathers-studio/', persistent: true } })
      }
    },
  )
}
