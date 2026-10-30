<script setup lang="ts">
import TheFooter from '~/components/TheFooter.vue'
</script>

<template>
  <div class="vf-shell">
    <header class="vf-header">
      <div class="vf-header-inner">
        <RouterLink class="vf-brand" to="/" aria-label="Feathers Workspace — accueil">
          <span class="vf-brand-mark" aria-hidden="true">F</span>
          <span><strong>Feathers Workspace</strong><small>Vite · Vue 3 · Pinia</small></span>
        </RouterLink>
        <nav class="vf-nav" aria-label="Navigation principale">
          <RouterLink to="/" exact-active-class="vf-nav-active">Accueil</RouterLink>
          <RouterLink to="/feathers" active-class="vf-nav-active">Services Feathers</RouterLink>
        </nav>
        <span class="vf-header-badge">Exemple Vitesse</span>
      </div>
    </header>
    <main id="main-content" class="vf-main"><RouterView /></main>
    <footer class="vf-footer">
      <div class="vf-footer-inner">
        <span>Feathers Workspace · Projet de démonstration</span>
        <TheFooter />
      </div>
    </footer>
  </div>
</template>
