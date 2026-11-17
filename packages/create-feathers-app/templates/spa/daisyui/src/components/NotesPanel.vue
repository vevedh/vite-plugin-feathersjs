<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useNotesStore } from '../stores/notes'
const store = useNotesStore()
const title = ref('')
const onOnline = (): void => { store.setConnectivity(true) }
const onOffline = (): void => { store.setConnectivity(false) }
onMounted(() => {
  void store.load()
  store.connectRealtime()
  window.addEventListener('online', onOnline)
  window.addEventListener('offline', onOffline)
})
onUnmounted(() => {
  store.disconnectRealtime()
  window.removeEventListener('online', onOnline)
  window.removeEventListener('offline', onOffline)
})
async function submit(): Promise<void> {
  await store.create(title.value)
  if (!store.error) title.value = ''
}
</script>
<template>
  <section class="card bg-base-100 border border-base-300 shadow-lg"><div class="card-body">
    <h2 class="card-title">Notes FeathersJS</h2>
    <span class="badge badge-outline" data-testid="realtime-status" role="status" aria-live="polite">{{ !store.online ? 'Hors ligne' : !store.apiChecked ? 'Connexion à l’API…' : !store.apiAvailable ? 'API indisponible' : store.realtimeConnected ? 'Temps réel connecté' : 'REST disponible' }}</span>
    <div v-if="store.error" class="alert alert-warning" role="alert">{{ store.error }}</div>
    <form class="flex gap-3 flex-wrap" @submit.prevent="submit">
      <label class="input flex-1"><span class="label">Titre</span><input v-model="title" aria-label="Titre de la nouvelle note" maxlength="120" required /></label>
      <button class="btn btn-primary" type="submit" :disabled="store.loading || !store.online || !store.apiAvailable || !title.trim()">Créer une note</button>
    </form>
    <button v-if="store.online && !store.apiAvailable" class="btn btn-outline btn-sm" type="button" @click="store.load()">Réessayer la connexion</button>
    <p v-if="store.apiAvailable" data-testid="notes-count">{{ store.notes.length }} note(s)</p>
    <p v-else-if="store.notes.length">Les notes déjà affichées peuvent être périmées.</p>
    <p v-else>Les notes seront visibles lorsque l’API sera disponible.</p>
    <ul data-testid="notes" class="list bg-base-200 rounded-box"><li v-for="note in store.notes" :key="note.id" class="list-row">{{ note.title }}</li></ul>
  </div></section>
</template>
