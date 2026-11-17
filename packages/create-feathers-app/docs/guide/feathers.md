# Les services FeathersJS

Un projet généré contient deux services de démonstration : `health` pour vérifier la disponibilité et `notes` pour créer, lire et supprimer des notes.

![Du navigateur aux services FeathersJS](/diagrams/architecture.svg)

```powershell
Invoke-RestMethod http://127.0.0.1:5173/api/health
Invoke-RestMethod http://127.0.0.1:5173/api/notes
```

Les services sont enregistrés côté serveur avec FeathersJS v5. Vite ne remplace pas l'API en production. En mode SPA avec `--dev-api vite`, les services sont montés par le plugin pendant le développement. En mode `--dev-api separate`, le serveur Feathers reste autonome.

Le service `notes` est en mémoire et accessible sans authentification. Il sert uniquement aux tests de démarrage, d'intégration et de transport.

Le port `5173` correspond au mode SPA natif (RC4). En mode séparé, utiliser le port `3030` pour l’API autonome.

## SPA : API intégrée au serveur de développement

Dans le CLI source `0.1.0-rc.10`, le paramètre `--dev-api vite`
monte les services Feathers REST directement dans le serveur Vite, sur `/api`.
Le fichier `vite.config.ts` initialise `@vevedh/vite-plugin-feathersjs`,
et conserve le rechargement des modules de services en développement.
Le proxy REST séparé n'est donc plus requis pour les SPA générées ainsi.

L'option `--dev-api separate` garde une API autonome pour les usages nécessitant
deux processus. Pour SSR/SSG, ce mode est le seul pris en charge.
En production, Vite ne démarre pas Feathers : déployez `api/server.mjs`
derrière un reverse proxy, avec les protections d'accès appropriées.
