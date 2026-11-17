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

Avant de choisir un canal de distribution, vérifiez les [versions disponibles sur npm](/maintenance/publication). Si le tag `next` est disponible :

```powershell
npx --yes --package=@vevedh/create-feathers-app@next create-feathers-app mon-projet --ui daisyui --render spa
```

Pour afficher l'aide avec le raccourci `cfapp` :

```powershell
npx --yes --package=@vevedh/create-feathers-app@next cfapp --help
```

Le tag `next` peut évoluer. Pour une installation reproductible, utilisez une version exacte réellement publiée ; pour tester les sources de la RC10, consultez le [guide de démarrage](/guide/installation).

La génération ne rend pas automatiquement les profils avancés prêts pour Internet. Consultez les [limites d'authentification et de persistance](/guide/identites-bases).
