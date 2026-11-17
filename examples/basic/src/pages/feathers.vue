<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useNotesStore } from '~/feathers/services/notes/store'

declare const __FEATHERS_ADAPTER__: 'koa' | 'express'
declare const __FEATHERS_SOCKET_ENABLED__: boolean
declare const __FEATHERS_SOCKET_PORT__: number

const store = useNotesStore()
const { notes, loading, error, status, events } = storeToRefs(store)
const title = ref('')
const health = ref('—')
const adapter = __FEATHERS_ADAPTER__
const realtime = __FEATHERS_SOCKET_ENABLED__

async function refresh(): Promise<void> {
  await store.refresh()
  try {
    const response = await fetch('/api/health', { headers: { Accept: 'application/json' } })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const payload: unknown = await response.json()
    if (typeof payload !== 'object' || payload === null || !('status' in payload) || payload.status !== 'ok')
      throw new Error('Invalid health response')
    health.value = 'ok'
  }
  catch { health.value = 'unavailable' }
}
async function createNote(): Promise<void> {
  if (!title.value.trim() || loading.value) return
  await store.create(title.value)
  if (!store.error) title.value = ''
}
async function renameNote(id: number): Promise<void> {
  if (!title.value.trim()) return
  await store.patch(id, title.value)
  if (!store.error) title.value = ''
}
onMounted(() => { store.connect(); void refresh() })
onUnmounted(() => store.disconnect())
</script>

<template>
  <div class="vf-page vf-service-page">
    <section class="vf-page-heading">
      <div><div class="vf-eyebrow"><span class="vf-eyebrow-dot" /> SERVICE EXPLORER</div><h1>Notes <span class="vf-title-muted">/ FeathersJS v5</span></h1><p>Manipulez les enregistrements par le store Pinia et observez l'état réel des transports.</p></div>
      <button class="vf-button vf-secondary" :disabled="loading" @click="refresh">{{ loading ? 'Chargement…' : '↻ Actualiser' }}</button>
    </section>
    <section class="vf-status-grid" aria-label="État du serveur">
      <article class="vf-status-card"><span>Adaptateur HTTP</span><strong>{{ adapter.toUpperCase() }}</strong><small>Service REST /api</small></article>
      <article class="vf-status-card"><span>API Health</span><strong data-testid="health-status" :class="health === 'ok' ? 'vf-positive' : health === 'unavailable' ? 'vf-negative' : ''">{{ health === 'ok' ? 'Disponible' : health === 'unavailable' ? 'Indisponible' : 'Vérification…' }}</strong><small>Réponse du service health</small></article>
      <article class="vf-status-card"><span>Socket.IO</span><strong data-testid="socket-status">{{ realtime ? status : 'Désactivé' }}</strong><small>{{ realtime ? `Port ${__FEATHERS_SOCKET_PORT__}` : 'Mode REST uniquement' }}</small></article>
      <article class="vf-status-card"><span>Enregistrements</span><strong>{{ notes.length }}</strong><small>Notes chargées</small></article>
    </section>
    <div class="vf-service-grid">
      <section class="vf-panel" aria-labelledby="vf-notes-title">
        <div class="vf-panel-head"><div><span class="vf-kicker">CRUD / NOTES</span><h2 id="vf-notes-title">Registre des notes</h2><p>Les mutations passent exclusivement par les services FeathersJS.</p></div><span class="vf-count">{{ notes.length }} élément(s)</span></div>
        <p v-if="error" role="alert" class="vf-error">{{ error }}</p>
        <form class="vf-add-note" @submit.prevent="createNote"><label class="vf-visually-hidden" for="vf-note-title">Titre de la note</label><input id="vf-note-title" v-model="title" maxlength="120" placeholder="Saisissez un titre de note…" aria-label="Note title"><button class="vf-button vf-primary" type="submit" :disabled="!title.trim() || loading || (realtime && status !== 'connected')">+ Créer</button></form>
        <div v-if="!notes.length" class="vf-empty" role="status"><span aria-hidden="true">▤</span><strong>Aucune note à afficher</strong><p>Ajoutez une note pour vérifier les opérations du service.</p></div>
        <ul v-else class="vf-note-list" aria-label="Liste des notes"><li v-for="note in notes" :key="note.id"><span class="vf-note-icon" aria-hidden="true">≡</span><div class="vf-note-content"><strong>{{ note.title }}</strong><small>Identifiant #{{ note.id }}</small></div><div class="vf-note-actions"><button :disabled="!title.trim() || loading || (realtime && status !== 'connected')" @click="renameNote(note.id)">Renommer</button><button class="vf-delete" :disabled="loading || (realtime && status !== 'connected')" @click="store.remove(note.id)">Supprimer</button></div></li></ul>
      </section>
      <aside class="vf-panel vf-sidepanel" aria-labelledby="vf-realtime-title"><div class="vf-panel-head"><div><span class="vf-kicker">ÉVÉNEMENTS</span><h2 id="vf-realtime-title">Activité temps réel</h2><p>Observabilité côté client Pinia.</p></div></div>
        <div class="vf-realtime-summary"><span>Messages reçus</span><strong data-testid="event-count">{{ events.length }}</strong></div>
        <p class="vf-realtime-hint">{{ realtime ? 'Les événements du service alimentent ce journal.' : 'Activez Socket.IO pour observer les événements.' }}</p>
        <ul v-if="realtime && events.length" class="vf-events" aria-label="Realtime events"><li v-for="(event, index) in events" :key="`${index}-${event}`"><span aria-hidden="true">●</span>{{ event }}</li></ul>
        <p v-else-if="realtime" class="vf-events-empty">En attente d’événements…</p>
        <div class="vf-panel-info">Contrats partagés · TypeScript strict · FeathersJS Dove</div>
      </aside>
    </div>
    <RouterLink class="vf-backlink" to="/">← Retour au tableau de bord</RouterLink>
  </div>
</template>
