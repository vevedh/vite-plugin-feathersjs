import { defineConfig } from 'vitepress'
export default defineConfig({
  lang: 'fr-FR',
  base: process.env.VITEPRESS_BASE || '/',
  title: 'create-feathers-app',
  description: 'Créer des applications Vue 3, Quasar 2, daisyUI et FeathersJS v5',
  lastUpdated: true,
  cleanUrls: true,
  head: [['meta',{name:'theme-color',content:'#0f172a'}]],
  themeConfig: {
    logo: '/logo.svg',
    nav: [
      {text:'Démarrer',link:'/guide/installation'},
      {text:'Choisir un rendu',link:'/guide/rendus'},
      {text:'CLI',link:'/reference/commandes'},
      {text:'Services',link:'/guide/services'},
      {text:'Publication',link:'/maintenance/publication'},
    ],
    sidebar: [
      {text:'Premiers pas',items:[
        {text:'Vue d’ensemble',link:'/'},
        {text:'Installation',link:'/guide/installation'},
        {text:'Quasar SPA',link:'/guide/quasar-spa'},
        {text:'Quasar SSR',link:'/guide/quasar-ssr'},
        {text:'daisyUI SPA',link:'/guide/daisyui-spa'},
        {text:'daisyUI SSR / SSG',link:'/guide/daisyui-ssr-ssg'},
      ]},
      {text:'Comprendre et exploiter',items:[
        {text:'Choix du rendu',link:'/guide/rendus'},
        {text:'API Feathers',link:'/guide/feathers'},
        {text:'Générer un service',link:'/guide/services'},
        {text:'Identités et bases',link:'/guide/identites-bases'},
        {text:'Développement Windows',link:'/guide/windows'},
        {text:'Sécurité et déploiement',link:'/guide/securite'},
        {text:'Problèmes courants',link:'/guide/depannage'},
      ]},
      {text:'Référence',items:[
        {text:'Options CLI',link:'/reference/commandes'},
        {text:'Maintenir et publier',link:'/maintenance/publication'},
        {text:'GitHub Pages',link:'/maintenance/pages-github'},
      ]},
    ],
    outline: [2,3],
    socialLinks: [],
    search: {provider:'local'},
    footer: {message:'Documentation de create-feathers-app',copyright:'MIT'},
  },
})
