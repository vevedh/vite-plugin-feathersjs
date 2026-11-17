<script setup lang="ts">import NotesPanel from './components/NotesPanel.vue'</script>
<template><q-layout view="hHh lpR fFf"><q-header class="bg-primary text-white"><q-toolbar><q-toolbar-title>Feathers Console — Quasar 2 SPA</q-toolbar-title></q-toolbar></q-header>
<q-page-container><q-page padding><main class="q-mx-auto" style="max-width: 920px"><h1 class="text-h4">Vue 3, Quasar 2 et FeathersJS v5</h1><p>Le service Feathers est exécuté dans un processus séparé.</p><NotesPanel /></main></q-page></q-page-container></q-layout></template>
