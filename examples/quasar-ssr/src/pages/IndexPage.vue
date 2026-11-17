<script setup lang="ts">
import { onMounted, onServerPrefetch, onUnmounted, ref } from 'vue'
import { useNotesStore } from '../stores/notes'

const store = useNotesStore()
const newTitle = ref('')
const health = ref<'checking' | 'ok' | 'error'>('checking')
const realtimeEnabled = import.meta.env.VITE_FEATHERS_REALTIME === '1'

async function submit(): Promise<void> {
  if (!newTitle.value.trim() || store.loading) return
  try {
    await store.create(newTitle.value)
    newTitle.value = ''
  }
  catch { /* The store exposes the service error in its reactive state. */ }
}

async function checkHealth(): Promise<void> {
  try {
    const response = await fetch('/api/health', { headers: { Accept: 'application/json' } })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const body: unknown = await response.json()
    health.value = typeof body === 'object' && body !== null && 'status' in body && body.status === 'ok' ? 'ok' : 'error'
  }
  catch { health.value = 'error' }
}

// Prefetch only into this request's Pinia instance. Never open a socket during SSR.
onServerPrefetch(async () => { await store.load().catch(() => {}) })
onMounted(() => {
  if (!store.notes.length) void store.load().catch(() => {})
  void checkHealth()
  store.connectRealtime()
})
onUnmounted(() => store.disconnectRealtime())
</script>

<template>
  <div class="console-shell">
    <aside class="console-sidebar" aria-label="Navigation de la console">
      <a class="console-brand" href="/" aria-label="Feathers Console — accueil">
        <span class="brand-mark" aria-hidden="true">F</span>
        <span><strong>Feathers Console</strong><small>Quasar SSR workspace</small></span>
      </a>
      <p class="sidebar-label">Espace de travail</p>
      <nav class="sidebar-nav" aria-label="Navigation principale">
        <a class="sidebar-link active" href="/" aria-current="page"><span aria-hidden="true">▦</span> Vue d'ensemble</a>
        <a class="sidebar-link" href="#notes"><span aria-hidden="true">≡</span> Service notes</a>
        <a class="sidebar-link" href="#architecture"><span aria-hidden="true">◇</span> Architecture</a>
      </nav>
      <div class="sidebar-foot">
        <span class="sidebar-foot-icon" aria-hidden="true">●</span>
        <div><strong>Environnement de certification</strong><small>API locale · données de démonstration</small></div>
      </div>
    </aside>

    <div class="console-workspace">
      <header class="console-topbar">
        <div class="breadcrumbs">Laboratoire <span aria-hidden="true">/</span> <strong>Vue d'ensemble</strong></div>
        <div class="topbar-end">
          <span class="topbar-technology">Vite · Vue 3 · Pinia</span>
          <span class="environment-tag"><span aria-hidden="true">●</span> SSR</span>
        </div>
      </header>

      <main class="console-main">
        <section class="console-hero" aria-labelledby="page-heading">
          <div>
            <p class="eyebrow">Vue d'ensemble / Intégration full stack</p>
            <h1 id="page-heading">Quasar 2 SSR + FeathersJS v5 + Pinia</h1>
            <p id="ssr-proof" class="hero-intro">Vue SSR : liste issue du service Feathers notes. Gérez des données via les services FeathersJS, avec une interface rendue côté serveur et hydratée côté navigateur.</p>
          </div>
          <a class="hero-link" href="#notes">Explorer le service <span aria-hidden="true">↗</span></a>
        </section>

        <section class="metric-grid" aria-label="État des services">
          <article class="metric-card">
            <div class="metric-top"><span>Enregistrements</span><span class="metric-symbol" aria-hidden="true">≡</span></div>
            <strong class="metric-value" data-testid="notes-count">{{ store.notes.length }}</strong>
            <p>Notes du service Feathers</p>
          </article>
          <article class="metric-card">
            <div class="metric-top"><span>API REST</span><span class="metric-symbol" aria-hidden="true">⌁</span></div>
            <strong class="metric-value metric-state" :class="`state-${health}`" data-testid="health-status">{{ health === 'ok' ? 'Disponible' : health === 'error' ? 'Indisponible' : 'Vérification…' }}</strong>
            <p>Contrôle réel de /api/health</p>
          </article>
          <article class="metric-card">
            <div class="metric-top"><span>Rendu</span><span class="metric-symbol" aria-hidden="true">◇</span></div>
            <strong class="metric-value metric-state">SSR</strong>
            <p>Quasar CLI avec Vite</p>
          </article>
        </section>

        <div class="console-content-grid">
          <section id="notes" class="console-panel" aria-labelledby="notes-heading">
            <div class="panel-head">
              <div><p class="eyebrow">Service Feathers / notes</p><h2 id="notes-heading">Registre des notes</h2><p>CRUD depuis le store Pinia, sans accès direct au transport dans cette page.</p></div>
              <div class="notes-panel-badges">
                <q-badge class="panel-count" :label="`${store.notes.length} élément(s)`" />
                <span class="realtime-indicator" data-testid="realtime-status" role="status">
                  {{ !realtimeEnabled ? 'Temps réel désactivé' : store.realtimeConnected ? 'Temps réel connecté' : 'Temps réel en attente' }}
                </span>
              </div>
            </div>
            <q-banner v-if="store.error" class="console-error" role="alert">{{ store.error }}</q-banner>
            <form class="note-form" aria-label="Créer une note" @submit.prevent="submit">
              <div class="note-input-shell">
                <!-- Quasar QInput can generate a different inline caret style on the SSR server.
                     Render only this interactive field after hydration; keep the notes and
                     surrounding form server-rendered. Never silence hydration diagnostics. -->
                <q-no-ssr>
                  <q-input v-model="newTitle" data-testid="note-title-input" class="note-input" label="Titre de la nouvelle note" outlined dense maxlength="120" :disable="store.loading" />
                  <template #placeholder>
                    <div class="note-input-placeholder" aria-hidden="true">Titre de la nouvelle note</div>
                  </template>
                </q-no-ssr>
              </div>
              <q-btn class="console-create" label="Créer une note" type="submit" unelevated no-caps :loading="store.loading" :disable="!newTitle.trim() || store.loading" />
            </form>
            <div v-if="store.loading && store.notes.length === 0" class="notes-feedback" role="status">Chargement des notes…</div>
            <div v-else-if="store.notes.length === 0" class="notes-feedback" role="status">Aucune note pour l'instant. Créez-en une pour vérifier le service.</div>
            <q-list v-else class="notes-list" separator data-testid="notes">
              <q-item v-for="note in store.notes" :key="note.id" class="notes-item">
                <q-item-section avatar><span class="note-avatar" aria-hidden="true">≡</span></q-item-section>
                <q-item-section><q-item-label>{{ note.title }}</q-item-label><q-item-label caption>Note #{{ note.id }}</q-item-label></q-item-section>
                <q-item-section side><q-badge outline color="grey-7" label="Feathers" /></q-item-section>
              </q-item>
            </q-list>
          </section>

          <aside id="architecture" class="console-panel architecture-panel" aria-labelledby="architecture-heading">
            <div class="panel-head"><div><p class="eyebrow">Architecture</p><h2 id="architecture-heading">Chaîne de données</h2><p>Responsabilités séparées et testables.</p></div></div>
            <ol class="architecture-steps">
              <li><span>01</span><div><strong>Vue 3 + Quasar</strong><small>Rendu HTML SSR / hydratation</small></div></li>
              <li><span>02</span><div><strong>Store Pinia</strong><small>État réactif par requête SSR</small></div></li>
              <li><span>03</span><div><strong>FeathersJS v5</strong><small>REST, services et Socket.IO optionnel</small></div></li>
            </ol>
            <div class="architecture-note"><span aria-hidden="true">ⓘ</span><p>Les données affichées proviennent du service actif. Les connexions temps réel ne démarrent qu'après hydratation.</p></div>
          </aside>
        </div>
        <footer class="console-bottom">Feathers Console <span aria-hidden="true">·</span> Exemple de certification Quasar SSR</footer>
      </main>
    </div>
  </div>
</template>
