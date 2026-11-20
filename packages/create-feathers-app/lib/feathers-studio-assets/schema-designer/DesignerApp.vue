<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { compareDraft, exportDraft, layoutServices, makeDraft, validateDraft } from './model'
import { parseImportedDraft } from './draft-import'
import { parseStudioBridge, resolveSelection } from './studio-bridge'
import type { DesignerCatalog, DesignerDraft, DesignerDraftField, DesignerPosition, FieldType } from './model'

const catalog = ref<DesignerCatalog | null>(null)
const drafts = ref<Record<string, DesignerDraft>>(Object.create(null) as Record<string, DesignerDraft>)
const positions = ref<Record<string, DesignerPosition>>(Object.create(null) as Record<string, DesignerPosition>)
const selected = ref('')
const loading = ref(false)
const failure = ref('')
const notice = ref('')
const excludedManual = ref(0)
const zoom = ref(1)
const showDiff = ref(false)
const showPreview = ref(false)
const drag = ref<{ name: string; px: number; py: number; x: number; y: number } | null>(null)
const types: readonly FieldType[] = ['string', 'boolean', 'int', 'number']
const services = computed(() => catalog.value?.services ?? [])
const currentService = computed(() => services.value.find(item => item.name === selected.value) ?? null)
const currentDraft = computed(() => drafts.value[selected.value] ?? null)
const errors = computed(() => currentDraft.value ? validateDraft(currentDraft.value) : [])
const allValid = computed(() => services.value.length > 0 && services.value.every(service => {
  const draft = drafts.value[service.name]
  return draft !== undefined && draft.name === service.name && draft.engine === service.engine && draft.docs === service.docs && validateDraft(draft).length === 0
}))
const diff = computed(() => {
  if (!allValid.value || !catalog.value) return null
  try { return compareDraft(catalog.value, drafts.value, []) } catch { return null }
})
const preview = computed(() => {
  if (!allValid.value || !catalog.value) return ''
  try { return exportDraft(catalog.value, drafts.value, positions.value, []) } catch { return '' }
})

async function reload(): Promise<void> {
  loading.value = true
  failure.value = ''
  notice.value = ''
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 7000)
  try {
    const response = await fetch('/__feathers-studio/catalog', { method: 'GET', credentials: 'omit', cache: 'no-store', headers: { Accept: 'application/json' }, signal: controller.signal })
    if (!response.ok) throw Error(`CATALOG_HTTP_${response.status}`)
    const body: unknown = await response.json()
    const bridged = parseStudioBridge(body)
    const next = Object.create(null) as Record<string, DesignerDraft>
    for (const service of bridged.catalog.services) next[service.name] = makeDraft(service)
    catalog.value = bridged.catalog
    drafts.value = next
    positions.value = layoutServices(bridged.catalog.services)
    excludedManual.value = bridged.excludedManual
    selected.value = resolveSelection(window.location.search, bridged.catalog)
    showDiff.value = false
    showPreview.value = false
    if (bridged.excludedManual > 0) notice.value = `${bridged.excludedManual} service(s) manuel(s) consultable(s) uniquement dans DevTools.`
  } catch (cause: unknown) {
    catalog.value = null
    drafts.value = Object.create(null) as Record<string, DesignerDraft>
    failure.value = cause instanceof Error ? cause.message : 'CATALOG_UNAVAILABLE'
  } finally {
    window.clearTimeout(timeout)
    loading.value = false
  }
}
function addField(): void {
  const draft = currentDraft.value
  if (!draft || draft.fields.length >= 32) return
  const used = new Set(draft.fields.map(field => field.name))
  for (let i = 1; i <= 32; i++) {
    const name = `field${i}`
    if (!used.has(name)) { draft.fields.push({name, type: 'string', required: false}); return }
  }
}
function deleteField(index: number): void {
  const draft = currentDraft.value
  if (draft && draft.fields.length > 1 && index >= 0 && index < draft.fields.length) draft.fields.splice(index, 1)
}
function resetSelected(): void {
  if (currentService.value) drafts.value[currentService.value.name] = makeDraft(currentService.value)
}
function setConstraint(field: DesignerDraftField, key: 'minLength'|'maxLength'|'minimum'|'maximum', event: Event): void {
  const target = event.target
  if (!(target instanceof HTMLInputElement)) return
  if (!field.constraints) field.constraints = {}
  if (target.value.trim() === '') {
    delete field.constraints[key]
    if (Object.keys(field.constraints).length === 0) delete field.constraints
    return
  }
  const n = Number(target.value)
  if (!Number.isFinite(n)) return
  field.constraints[key] = n
}
function startDrag(event: PointerEvent, name: string): void {
  if (event.button !== 0 || !(event.currentTarget instanceof HTMLElement)) return
  const pos = positions.value[name]
  if (!pos) return
  drag.value = {name, px: event.clientX, py: event.clientY, x: pos.x, y: pos.y}
  selected.value = name
  event.currentTarget.setPointerCapture(event.pointerId)
}
function moveDrag(event: PointerEvent): void {
  const item = drag.value
  if (!item) return
  positions.value[item.name] = {x: Math.min(1150,Math.max(0, item.x + (event.clientX-item.px)/zoom.value)),y:Math.min(850,Math.max(0,item.y + (event.clientY-item.py)/zoom.value))}
}
function stopDrag(): void { drag.value = null }
function moveKeyboard(event: KeyboardEvent, name: string): void {
  if (event.key === 'Enter' || event.key === ' ') {event.preventDefault();selected.value=name;return}
  const delta: Record<string, [number, number]> = {ArrowLeft:[-12,0],ArrowRight:[12,0],ArrowUp:[0,-12],ArrowDown:[0,12]}
  const step = delta[event.key]
  const pos = positions.value[name]
  if (!step || !pos) return
  event.preventDefault()
  positions.value[name] = {x: Math.min(1150,Math.max(0,pos.x+step[0])),y:Math.min(850,Math.max(0,pos.y+step[1]))}
  selected.value = name
}
function saveDraft(): void {
  if (!catalog.value || !allValid.value) return
  try {
    const json = exportDraft(catalog.value, drafts.value, positions.value, [])
    if (new TextEncoder().encode(json).byteLength > 65536) throw Error('R6_DRAFT_SIZE_LIMIT')
    const url = URL.createObjectURL(new Blob([json],{type:'application/json'}))
    const element = document.createElement('a')
    element.href = url
    element.download = 'feathers-schema-designer-draft-r6.json'
    element.click()
    window.setTimeout(() => URL.revokeObjectURL(url),1000)
    notice.value = 'Brouillon non exécutable exporté. Vérifier la compatibilité du CLI local avant toute migration.'
  } catch (cause: unknown) {failure.value = cause instanceof Error ? cause.message : 'EXPORT_REFUSED'}
}
async function importDraft(event: Event): Promise<void> {
  const input = event.target
  if (!(input instanceof HTMLInputElement)) return
  const file = input.files?.item(0)
  input.value = ''
  if (!file || !catalog.value) return
  try {
    if (file.size > 65536) throw Error('R6_IMPORT_SIZE_LIMIT')
    const result = parseImportedDraft(await file.text(),catalog.value)
    drafts.value = result.drafts
    positions.value = result.positions
    selected.value = catalog.value.services[0]?.name ?? ''
    showDiff.value = true
    notice.value = 'Brouillon importé et vérifié contre les empreintes affichées ; aucune écriture backend.'
    failure.value = ''
  } catch (cause: unknown) {failure.value = cause instanceof Error ? cause.message : 'IMPORT_REFUSED'}
}
onMounted(() => {void reload()})
</script>

<template>
  <div class="sd-app">
    <header class="sd-header">
      <div class="sd-brand"><div class="sd-brand-icon">F</div><div><strong>Feathers Studio</strong><span>SCHEMA DESIGNER · R14-S5-R6</span></div></div>
      <nav class="sd-links" aria-label="Navigation développeur"><a href="/">Console</a><a href="/__devtools__/">Vue DevTools</a></nav>
      <div class="sd-header-end"><span class="sd-badge">BROUILLON UNIQUEMENT</span><button type="button" class="sd-button sd-button-primary" :disabled="!allValid" @click="saveDraft">Exporter JSON v2</button></div>
    </header>
    <div class="sd-shell">
      <aside class="sd-sidebar">
        <div class="sd-section-top"><span>SERVICES FEATHERS</span><span class="sd-light">LOCAL</span></div>
        <h2>Contrats vérifiés</h2>
        <p class="sd-muted">Catalogue R14-S5-R5 · source SHA-256</p>
        <div v-if="loading" class="sd-empty">Lecture du catalogue…</div>
        <div v-else-if="failure" class="sd-error" role="alert">{{ failure }}<button type="button" class="sd-button" @click="reload">Réessayer</button></div>
        <div v-else class="sd-service-list">
          <button v-for="service in services" :key="service.name" type="button" class="sd-service-item" :class="{'sd-active':selected===service.name}" @click="selected=service.name"><span class="sd-service-icon">▦</span><span class="sd-service-label"><strong>{{ service.name }}</strong><small>{{ service.engine }} · {{ service.fields.length }} champ(s)</small></span></button>
          <p v-if="!services.length" class="sd-muted">Aucun service avec schéma Zod, JSON Schema ou TypeBox éligible.</p>
        </div>
        <div class="sd-sidebar-bottom"><div class="sd-stat"><span>Éditables en brouillon</span><strong>{{ services.length }}</strong></div><div class="sd-stat"><span>Manuels exclus</span><strong>{{ excludedManual }}</strong></div><div class="sd-safe">✓ Contrats vérifiés en lecture seule</div><p>Le navigateur ne peut ni modifier le backend ni appliquer de migration. Le CLI R14-S4 doit être qualifié séparément pour ces nouveaux contrats.</p></div>
      </aside>
      <main class="sd-workarea">
        <div class="sd-toolbar"><div><h1>Modèle de schémas</h1><p>Canvas local · déplacement et modifications de brouillon seulement</p></div><div class="sd-tools"><button type="button" class="sd-button" :disabled="loading" @click="reload">Actualiser</button><label class="sd-zoom">Zoom <input v-model.number="zoom" aria-label="Zoom du canvas" type="range" min="0.65" max="1.4" step="0.05">{{ Math.round(zoom*100) }} %</label></div></div>
        <section class="sd-canvas" aria-label="Canvas des services">
          <div v-if="loading" class="sd-center-msg">Chargement…</div><div v-else-if="!services.length" class="sd-center-msg">Aucun service éligible</div>
          <div v-else class="sd-canvas-inner" :style="{transform:`scale(${zoom})`}">
            <div v-for="service in services" :key="service.name" tabindex="0" role="button" class="sd-node" :class="{'sd-node-selected':selected===service.name}" :style="{left:`${positions[service.name]?.x ?? 0}px`,top:`${positions[service.name]?.y ?? 0}px`}" :aria-label="`Sélectionner et déplacer ${service.name}`" @pointerdown="startDrag($event,service.name)" @pointermove="moveDrag" @pointerup="stopDrag" @pointercancel="stopDrag" @keydown="moveKeyboard($event,service.name)">
              <div class="sd-node-head"><span class="sd-node-symbol">▦</span><div><strong>{{ service.name }}</strong><small>{{ service.route }}</small></div></div>
              <div class="sd-node-tags"><span>{{ service.engine }}</span><span>SHA vérifié</span></div>
              <div class="sd-node-fields"><div v-for="field in drafts[service.name]?.fields ?? []" :key="field.name" class="sd-node-field"><span><b>{{ field.required ? '●' : '○' }}</b>{{ field.name }}</span><em>{{ field.type }}</em></div></div>
              <div class="sd-node-foot">Contrat : {{ service.contractSha256.slice(0,12) }}…</div>
            </div>
          </div>
          <div class="sd-canvas-label">ÉDITION LOCALE · NON EXÉCUTABLE</div>
        </section>
        <div class="sd-bottom"><span><span class="sd-green">●</span> Aucune écriture serveur</span><span>Flèches pour déplacer · Entrée pour sélectionner</span></div>
      </main>
      <aside class="sd-inspector">
        <div class="sd-section-top"><span>INSPECTEUR</span><span class="sd-light">DRAFT</span></div>
        <template v-if="currentService && currentDraft">
          <h2>{{ currentService.name }}</h2><p class="sd-muted">{{ currentService.route }}</p>
          <div class="sd-inspector-meta"><div><span>Moteur</span><strong>{{ currentService.engine }}</strong></div><div><span>Source SHA-256</span><code>{{ currentService.contractSha256.slice(0,16) }}…</code></div></div>
          <div class="sd-panel-head"><h3>Champs</h3><button class="sd-button" type="button" :disabled="currentDraft.fields.length>=32" @click="addField">+ Ajouter</button></div>
          <div class="sd-field-editor"><div v-for="(field,index) in currentDraft.fields" :key="index" class="sd-edit-field"><div class="sd-field-title"><span>Champ {{ index+1 }}</span><button type="button" class="sd-delete" :aria-label="`Supprimer champ ${index+1}`" :disabled="currentDraft.fields.length<=1" @click="deleteField(index)">×</button></div><input v-model.trim="field.name" :aria-label="`Nom champ ${index+1}`" maxlength="48" spellcheck="false"><div class="sd-field-row"><select v-model="field.type" :aria-label="`Type champ ${index+1}`"><option v-for="type in types" :key="type" :value="type">{{ type }}</option></select><label><input v-model="field.required" type="checkbox"> Requis</label></div><div v-if="field.type==='string'" class="sd-constraint-inputs"><label>Min longueur<input type="number" min="0" max="120" step="1" :aria-label="`Min longueur ${field.name}`" :value="field.constraints?.minLength ?? ''" @input="setConstraint(field,'minLength',$event)"></label><label>Max longueur<input type="number" min="1" max="120" step="1" :aria-label="`Max longueur ${field.name}`" :value="field.constraints?.maxLength ?? ''" @input="setConstraint(field,'maxLength',$event)"></label></div></div></div>
          <div v-if="errors.length" class="sd-error" role="alert"><div v-for="error in errors" :key="error">{{ error }}</div></div><div v-else class="sd-validation">Brouillon valide · aucune migration autorisée</div>
          <button class="sd-button sd-reset" type="button" @click="resetSelected">Réinitialiser ce service</button>
          <div class="sd-panel-head"><h3>Import / export local</h3></div>
          <label class="sd-import-file">Importer un brouillon JSON v2<input type="file" accept=".json,application/json" aria-label="Importer un brouillon JSON" @change="importDraft"></label>
          <button class="sd-button sd-reset" type="button" :disabled="!allValid" @click="showDiff=!showDiff">{{ showDiff ? 'Masquer' : 'Prévisualiser' }} le diff</button>
          <div v-if="showDiff && diff" class="sd-diff"><div class="sd-diff-summary">{{ diff.changeCount }} modification(s) sur {{ diff.modifiedServices }} service(s)</div><ul class="sd-diff-list"><li v-for="(change,index) in diff.changes" :key="index"><span>{{ change.kind }}</span><strong>{{ change.service }} / {{ change.field }}</strong><small>{{ change.before }} → {{ change.after }}</small></li></ul><p class="sd-diff-warning">Simulation uniquement : aucune migration, aucun fichier modifié.</p></div>
          <button class="sd-button sd-reset" type="button" :disabled="!allValid" @click="showPreview=!showPreview">{{ showPreview ? 'Masquer' : 'Prévisualiser' }} le JSON</button>
          <pre v-if="showPreview && preview" class="sd-preview" aria-label="Prévisualisation du brouillon">{{ preview }}</pre>
        </template>
        <div v-else class="sd-empty">Sélectionnez un service éligible.</div>
        <div v-if="notice" class="sd-notice" role="status">{{ notice }}</div>
      </aside>
    </div>
  </div>
</template>
