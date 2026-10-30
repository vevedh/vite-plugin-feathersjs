<script setup lang="ts">
import NotesPanel from './components/NotesPanel.vue'
defineProps<{ route: string }>()
</script>
<template>
  <main class="min-h-screen bg-base-200 p-6"><div class="max-w-4xl mx-auto space-y-6">
    <header class="navbar bg-base-100 rounded-box px-6 gap-4"><span class="font-bold">Feathers Console — daisyUI</span>
      <a href="/" class="link">Accueil</a><a href="/about" class="link">À propos</a></header>
    <h1 class="text-3xl font-semibold">{{ route === '/about' ? 'À propos de cet exemple' : 'Vue 3, Pinia et FeathersJS v5' }}</h1>
    <p>Cette page publique ne contient aucune donnée personnelle. Les notes sont demandées au service Feathers après hydratation.</p>
    <NotesPanel v-if="route !== '/about'" />
    <p v-else>Rendu HTML public. API REST séparée et données de démonstration non prérendues.</p>
  </div></main>
</template>
