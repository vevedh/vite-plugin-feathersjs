<script setup lang="ts">
defineOptions({ name: 'IndexPage' })
const user = useUserStore()
const name = ref(user.savedName)
const router = useRouter()
function go() { if (name.value.trim()) router.push(`/hi/${encodeURIComponent(name.value.trim())}`) }
const { t } = useI18n()
useHead({ title: () => `${t('button.home')} · Feathers Workspace` })
</script>

<template>
  <div class="vf-page">
    <section class="vf-landing-hero">
      <div class="vf-hero-copy">
        <div class="vf-eyebrow"><span class="vf-eyebrow-dot" /> Vite 7 · FeathersJS v5 · Pinia</div>
        <h1>Des services Feathers.<br><span>Une interface réactive.</span></h1>
        <p>Un laboratoire de référence pour générer des services typés, piloter leur état avec Pinia et choisir un transport REST ou Socket.IO.</p>
        <div class="vf-hero-actions">
          <RouterLink class="vf-button vf-primary" to="/feathers">Ouvrir le service notes <span aria-hidden="true">↗</span></RouterLink>
          <a class="vf-button vf-secondary" href="https://feathersjs.com" target="_blank" rel="noopener noreferrer">Documentation Feathers ↗</a>
        </div>
        <div class="vf-hero-facts"><span><b>02</b> services de référence</span><span><b>04</b> modes de transport</span><span><b>v5</b> FeathersJS Dove</span></div>
      </div>
      <div class="vf-hero-art" aria-label="Architecture service-first">
        <div class="vf-art-label">FLUX DE DONNÉES</div>
        <div class="vf-art-node"><span class="vf-node-icon">◈</span><div><strong>Vue 3</strong><small>Composants UI</small></div><span class="vf-art-tag">Vite</span></div>
        <div class="vf-art-line" />
        <div class="vf-art-node"><span class="vf-node-icon">▦</span><div><strong>Pinia Store</strong><small>État, CRUD, événements</small></div><span class="vf-art-tag">Typed</span></div>
        <div class="vf-art-line" />
        <div class="vf-art-node vf-art-node-accent"><span class="vf-node-icon">⌁</span><div><strong>FeathersJS v5</strong><small>REST · Socket.IO</small></div><span class="vf-art-tag">API</span></div>
        <div class="vf-art-caption">Contrats partagés · Services découvrables · TypeScript strict</div>
      </div>
    </section>

    <section class="vf-section" aria-labelledby="features-title">
      <div class="vf-section-head"><div><span class="vf-kicker">STACK</span><h2 id="features-title">Un socle conçu pour évoluer</h2></div><p>Les exemples exposent les contrats et le cycle de vie des services, sans masquer les transports.</p></div>
      <div class="vf-feature-grid">
        <article class="vf-feature"><span class="vf-feature-icon">⌘</span><h3>Service-first</h3><p>Une classe, un enregistrement et un schéma par service, prêts pour la génération CLI.</p></article>
        <article class="vf-feature"><span class="vf-feature-icon">▤</span><h3>Pinia typé</h3><p>CRUD réactif, erreurs explicites, gestion des abonnements et nettoyage des listeners.</p></article>
        <article class="vf-feature"><span class="vf-feature-icon">◇</span><h3>Transport au choix</h3><p>Express ou Koa, avec une option Socket.IO. Les modes REST-only restent utilisables.</p></article>
      </div>
    </section>

    <section class="vf-demo-strip" aria-labelledby="demo-heading">
      <div><span class="vf-kicker">DÉMONSTRATION VITESSE</span><h2 id="demo-heading">Conservez aussi les fonctions du starter.</h2><p>La navigation personnalisée du modèle Vitesse reste disponible.</p></div>
      <form class="vf-demo-form" @submit.prevent="go">
        <label for="input">{{ t('intro.whats-your-name') }}</label>
        <TheInput v-model="name" :placeholder="t('intro.whats-your-name')" autocomplete="name" @keydown.enter="go" />
        <button class="vf-button vf-primary" type="submit" :disabled="!name.trim()">{{ t('button.go') }}</button>
      </form>
    </section>
  </div>
</template>

<route lang="yaml">
meta:
  layout: home
</route>
