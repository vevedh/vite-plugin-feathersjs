# @vevedh/vite-plugin-feathersjs

Intégrer des services FeathersJS v5 dans le serveur de développement Vite 7, avec un seul point d'entrée pour l'interface et les routes REST. Le plugin prend en charge Koa et Express, ainsi que Socket.IO en option.

## Installation

```powershell
npm install @vevedh/vite-plugin-feathersjs
```

Installez également les dépendances FeathersJS nécessaires à votre application et configurez vos modules de services.

## Démarrage avec Vite

Dans `vite.config.ts` :

```ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import feathers from '@vevedh/vite-plugin-feathersjs'

export default defineConfig({
  plugins: [
    vue(),
    feathers({
      serviceFiles: 'server/services/*/*.service.ts',
      adapter: 'koa',
      prefix: '/api',
      socketio: false
    })
  ]
})
```

Chaque module découvert doit exporter une fonction `default` ou `register` qui enregistre ses services auprès de l'application Feathers. Le plugin démarre le runtime après la mise en écoute de Vite et surveille les fichiers de services pour faciliter le développement.

## REST, Express et Socket.IO

L'option `adapter` accepte `koa` (par défaut) ou `express`. La valeur `socketio: false` conserve uniquement les routes REST. Pour utiliser Socket.IO, définissez explicitement son port dédié et les origines autorisées :

```ts
feathers({
  serviceFiles: 'server/services/*/*.service.ts',
  adapter: 'express',
  prefix: '/api',
  socketio: {
    port: 3031,
    host: '127.0.0.1',
    origins: ['http://127.0.0.1:5173']
  }
})
```

Le port Socket.IO doit être distinct de celui de Vite. Le mode Socket.IO `external` requiert une gestion explicite par l'application hôte et s'utilise avec `createFeathersRuntime()`, pas avec l'initialisation automatique du plugin.

## Options utiles

- `serviceFiles` : glob ou liste de globs des modules de services.
- `watchDirectories` : dossiers supplémentaires à surveiller pendant le développement.
- `prefix` : préfixe REST, généralement `/api`.
- `cors` : politique CORS explicite.
- `lifecycle: 'managed'` : cycle de vie géré, sur activation explicite.
- `serviceRegistration: 'reject-duplicates'` : protection contre les collisions d'enregistrement de services.

Le package expose également `createFeathersRuntime`, `createManagedFeathersRuntime` et les utilitaires de cycle de vie pour les architectures qui gèrent elles-mêmes leur serveur.

## Développement et production

Le plugin relie Vite et Feathers **pendant le développement** (development-only). En production, démarrez et sécurisez l'API Feathers dans votre serveur Node.js ou Bun selon l'architecture retenue. Validez les règles d'authentification, les autorisations par service, les origines CORS et le stockage des secrets avant déploiement.

La documentation du dépôt présente les exemples Vite et Quasar 2, les options et les points de dépannage.

## Compatibilité

Cette documentation concerne `@vevedh/vite-plugin-feathersjs` **0.3.0** pour **Vite 7** et **FeathersJS v5**. Elle remplace le code historique du dépôt GitHub ; elle ne prétend pas maintenir l'API de l'ancien package npm non scopé `vite-plugin-feathersjs` 1.4.0.

## Authentification Keycloak

Le plugin expose `createKeycloakTransportBridge` et `installKeycloakEventFence` pour les applications Feathers qui valident des jetons OIDC. Ces fonctions sont optionnelles et nécessitent une configuration serveur explicite, une audience API dédiée et une résolution des droits côté serveur. Le filtre d’événements ne protège pas les émissions Socket.IO brutes. Les essais Keycloak réels restent distincts des tests JWKS locaux. Voir [le guide de qualification](https://vevedh.github.io/vite-plugin-feathersjs/guide/release.html).

## Licence

Voir le fichier [`LICENSE`](LICENSE).
