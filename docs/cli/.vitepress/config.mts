import { defineConfig } from 'vitepress'

export default defineConfig({
  lang: 'fr-FR',
  base: process.env.VITEPRESS_BASE || '/',
  title: 'create-feathers-app',
  description: 'Créer une application Vue 3, Quasar 2 ou daisyUI avec FeathersJS v5.',
  cleanUrls: false,
  lastUpdated: true,
  themeConfig: {
    nav: [
      { text: 'Démarrer', link: '/guide/installation' },
      { text: 'Rendus', link: '/guide/rendus' },
      { text: 'Options CLI', link: '/reference/commandes' },
      { text: 'Guide du plugin', link: 'https://vevedh.github.io/vite-plugin-feathersjs/' },
    ],
    sidebar: [
      {
        text: 'Guide',
        items: [
          { text: 'Présentation', link: '/' },
          { text: 'Installation', link: '/guide/installation' },
          { text: 'Modes de rendu', link: '/guide/rendus' },
          { text: 'Sécurité et déploiement', link: '/guide/securite' },
        ],
      },
      { text: 'Référence', items: [{ text: 'Commandes', link: '/reference/commandes' }] },
    ],
    search: { provider: 'local' },
    socialLinks: [{ icon: 'github', link: 'https://github.com/vevedh/vite-plugin-feathersjs' }],
    footer: { message: 'Projet sous licence MIT.' },
  },
})
