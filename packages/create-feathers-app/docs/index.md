---
layout: home
hero:
  name: Create Feathers App
  text: Une application Vue et FeathersJS, sans configuration superflue
  tagline: Choisissez Quasar 2 ou daisyUI, votre rendu et votre API. Le CLI prépare le projet ; vous gardez la main sur son architecture.
  actions:
    - theme: brand
      text: Démarrer
      link: /guide/installation
    - theme: alt
      text: Commandes
      link: /reference/commandes
features:
  - title: Un démarrage simple
    details: Une commande, un nom de projet et des options explicites.
  - title: Choisissez votre interface
    details: Vue 3, Pinia, Quasar 2 ou daisyUI, SPA, SSR ou SSG selon le profil.
  - title: Une API FeathersJS
    details: Koa ou Express, REST et Socket.IO lorsque le mode choisi le permet.
---

## Créer un projet

Une fois le package **publié sur npm**, lancez :

```powershell
npx --yes --package=@vevedh/create-feathers-app@latest create-feathers-app mon-projet --ui daisyui --render spa
```

Pour afficher l'aide avec le raccourci `cfapp` :

```powershell
npx --yes --package=@vevedh/create-feathers-app@latest cfapp --help
```

**Avant la publication** : ces commandes npm ne sont pas garanties disponibles. Pour tester la RC10 depuis le dépôt, consultez le [guide de démarrage](/guide/installation).

La génération ne rend pas automatiquement les profils avancés prêts pour Internet. Consultez les [limites d'authentification et de persistance](/guide/identites-bases).
