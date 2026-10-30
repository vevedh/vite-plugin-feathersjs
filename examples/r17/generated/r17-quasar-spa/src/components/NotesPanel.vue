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
  <q-card flat bordered class="q-pa-lg">
    <q-card-section><div class="text-h6">Notes FeathersJS</div><div data-testid="realtime-status">{{ store.realtimeConnected ? 'Temps réel connecté' : 'REST actif' }}</div></q-card-section>
    <q-banner v-if="store.error" role="alert">{{ store.error }}</q-banner>
    <q-card-section>
      <form class="row items-center q-gutter-sm" @submit.prevent="submit">
        <q-input v-model="title" label="Titre de la nouvelle note" data-testid="note-title-input" maxlength="120" outlined dense class="col" />
        <q-btn label="Créer une note" type="submit" color="primary" :disable="store.loading || !title.trim()"/>
      </form>
      <p data-testid="notes-count" class="q-mt-md">{{ store.notes.length }} note(s)</p>
      <q-list bordered separator data-testid="notes"><q-item v-for="note in store.notes" :key="note.id"><q-item-section>{{ note.title }}</q-item-section></q-item></q-list>
    </q-card-section>
  </q-card>
</template>
