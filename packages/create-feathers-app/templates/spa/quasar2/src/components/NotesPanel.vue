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
  <q-card flat bordered class="q-pa-lg">
    <q-card-section><div class="text-h6">Notes FeathersJS</div>
      <div data-testid="realtime-status" role="status" aria-live="polite">{{ !store.online ? 'Hors ligne' : !store.apiChecked ? 'Connexion à l’API…' : !store.apiAvailable ? 'API indisponible' : store.realtimeConnected ? 'Temps réel connecté' : 'REST disponible' }}</div></q-card-section>
    <q-banner v-if="store.error" role="alert">{{ store.error }}</q-banner>
    <q-card-section>
      <form class="row items-center q-gutter-sm" @submit.prevent="submit">
        <q-input v-model="title" label="Titre de la nouvelle note" data-testid="note-title-input" maxlength="120" outlined dense class="col" />
        <q-btn label="Créer une note" type="submit" color="primary" :disable="store.loading || !store.online || !store.apiAvailable || !title.trim()"/>
      </form>
      <q-btn v-if="store.online && !store.apiAvailable" flat label="Réessayer la connexion" @click="store.load()" />
      <p v-if="store.apiAvailable" data-testid="notes-count" class="q-mt-md">{{ store.notes.length }} note(s)</p>
      <p v-else-if="store.notes.length">Les notes déjà affichées peuvent être périmées.</p>
      <p v-else>Les notes seront visibles lorsque l’API sera disponible.</p>
      <q-list bordered separator data-testid="notes"><q-item v-for="note in store.notes" :key="note.id"><q-item-section>{{ note.title }}</q-item-section></q-item></q-list>
    </q-card-section>
  </q-card>
</template>
