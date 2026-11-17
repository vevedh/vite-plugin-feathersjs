import { defineConfig } from 'vitepress'

export default defineConfig({
  lang: 'fr-FR',
  title: 'Vite + FeathersJS',
  description: 'Guide pour démarrer avec Vitesse, Vue 3 et FeathersJS.',
  srcDir: './site',
  // This is a locally running Vitesse demonstration, not a VitePress page.
  // Keep all other dead-link checks enabled.
  ignoreDeadLinks: [/^https?:\/\/localhost:3333\/feathers$/],
  base: process.env.VITEPRESS_BASE || '/',
  cleanUrls: false,
  lastUpdated: false,
  appearance: true,
  head: [
    ['meta', { name: 'theme-color', content: '#0a7187' }],
    ['meta', { name: 'robots', content: 'index,follow' }],
  ],
  themeConfig: {
    logo: '/logo.svg',
    siteTitle: 'Vite + FeathersJS',
    search: { provider: 'local', options: { translations: {
      button: { buttonText: 'Rechercher', buttonAriaLabel: 'Rechercher dans le guide' },
      modal: { displayDetails: 'Détails', resetButtonTitle: 'Effacer', backButtonTitle: 'Retour', noResultsText: 'Aucun résultat', footer: { selectText: 'pour choisir', navigateText: 'pour naviguer', closeText: 'pour fermer' } },
    } } },
    nav: [
      { text: 'Premiers pas', link: '/guide/demarrage' },
      { text: 'Exemples', link: '/guide/exemples' },
      { text: 'Aide', link: '/guide/depannage' },
    ],
    sidebar: [
      { text: 'Bienvenue', items: [
        { text: 'Accueil', link: '/' },
        { text: 'Démarrer', link: '/guide/demarrage' },
        { text: 'Premières notes', link: '/guide/premieres-notes' },
      ] },
      { text: 'Découvrir', items: [
        { text: 'Choisir un exemple', link: '/guide/exemples' },
        { text: 'Vite minimal', link: '/guide/vite-minimal' },
        { text: 'Quasar 2 SSR', link: '/guide/quasar-ssr' },
        { text: 'Configurer le projet', link: '/guide/configuration' },
      ] },
      { text: 'Besoin d’aide ?', items: [
        { text: 'Problèmes courants', link: '/guide/depannage' },
        { text: 'Pour aller plus loin', link: '/guide/pour-aller-plus-loin' },
        { text: 'Lexique', link: '/reference/lexique' },
      ] },
    ],
    editLink: undefined,
    outline: { level: [2, 3], label: 'Sur cette page' },
    docFooter: { prev: 'Page précédente', next: 'Page suivante' },
    darkModeSwitchLabel: 'Apparence',
    sidebarMenuLabel: 'Menu',
    returnToTopLabel: 'Retour en haut',
    footer: { message: 'Un guide pour apprendre à votre rythme.', copyright: 'Licence MIT' },
    socialLinks: [],
  },
})
