<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useNotesStore } from '../stores/notes'
const store = useNotesStore()
const title = ref('')
onMounted(() => { void store.load(); store.connectRealtime() })
onUnmounted(() => store.disconnectRealtime())
async function submit() {
  await store.create(title.value)
  if (!store.error) title.value = ''
}
</script>
<template>
  <section aria-labelledby="notes-heading" class="notes-panel">
    <h2 id="notes-heading">Service Feathers : notes</h2>
    <p data-testid="realtime-status">{{ store.realtimeConnected ? 'Temps réel connecté' : 'REST actif' }}</p>
    <p v-if="store.error" role="alert">{{ store.error }}</p>
    <form @submit.prevent="submit"><label for="note-title">Nouvelle note</label>
      <input id="note-title" v-model="title" aria-label="Titre de la nouvelle note" maxlength="120" required />
      <button type="submit" :disabled="store.loading || !title.trim()">Créer une note</button>
    </form>
    <p data-testid="notes-count">{{ store.notes.length }} note(s)</p>
    <ul data-testid="notes"><li v-for="note in store.notes" :key="note.id">{{ note.title }}</li></ul>
  </section>
</template>
