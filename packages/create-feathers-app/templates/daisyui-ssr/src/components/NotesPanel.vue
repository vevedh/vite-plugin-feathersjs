<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useNotesStore } from '../stores/notes'
const store = useNotesStore()
const title = ref('')
onMounted(() => { void store.load(); store.connectRealtime() })
onUnmounted(() => store.disconnectRealtime())
async function submit() { await store.create(title.value); if (!store.error) title.value = '' }
</script>
<template>
  <section class="card bg-base-100 border border-base-300 shadow-lg"><div class="card-body">
    <h2 class="card-title">Notes FeathersJS</h2>
    <span class="badge badge-outline" data-testid="realtime-status">{{ store.realtimeConnected ? 'Temps réel connecté' : 'REST actif' }}</span>
    <div v-if="store.error" class="alert alert-error" role="alert">{{ store.error }}</div>
    <form class="flex gap-3 flex-wrap" @submit.prevent="submit">
      <label class="input flex-1"><span class="label">Titre</span><input v-model="title" aria-label="Titre de la nouvelle note" maxlength="120" required /></label>
      <button class="btn btn-primary" type="submit" :disabled="store.loading || !title.trim()">Créer une note</button>
    </form>
    <p data-testid="notes-count">{{ store.notes.length }} note(s)</p>
    <ul data-testid="notes" class="list bg-base-200 rounded-box"><li v-for="note in store.notes" :key="note.id" class="list-row">{{ note.title }}</li></ul>
  </div></section>
</template>
