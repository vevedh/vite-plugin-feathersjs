# R17 — maintenance des exemples et étude d'intégration Vite

Date : 2026-10-30. Type : correctif conservateur + démonstration autonome.

## Provenance / limite d'audit

La dernière archive R17 complète n'était pas accessible dans cette session. Le dépôt GitHub public consulté ne contient pas `/examples` R17. Ce kit est **un ajout non destructif**, et non une archive cumulative ou une certification de la base R17. Aucun fichier `src/` de l'application existante n'a été modifié.

## Inventaire de conservation

- `examples/basic` : conserver (contrats Koa/Express, REST et Socket.IO).
- `examples/quasar-ssr` : conserver (serveur Quasar SSR + séparation de transports).
- `examples/r17` (scripts, templates, tests et documentation) : conserver.
- `examples/r17/generated/*` : déplacer en quarantaine externe uniquement pour les noms de packages explicitement identifiés comme générés. La suppression n'est jamais effectuée.
- `examples/runtime-vite` : référence additionnelle, totalement isolée, sans remplacement de la base R17.

## Script de nettoyage

`node scripts/maintenance/clean-examples.mjs` : lecture seule et inventaire JSON par défaut.

`node scripts/maintenance/clean-examples.mjs --apply --quarantine C:\perso\vite-r17-quarantine` : déplace les candidats identifiés vers un emplacement externe, sur le même volume, sans écraser les fichiers existants.

`node scripts/maintenance/clean-examples.mjs --report docs-private/maintenance/examples-cleanup.json` : enregistre le rapport de l'inventaire. Le rapport refuse d'écraser un rapport préexistant.

Le script refuse les répertoires symboliques, les destinations à l'intérieur du dépôt et les projets suivis par Git. Il ne lit aucun `.env` ni secret.

## Runtime embarqué (référence)

`examples/runtime-vite` est un exemple autonome Vue 3 + Vite 7 + Feathers v5 REST. `createFeathersRuntime()` est **chargé et initialisé depuis `vite.config.ts`** à travers un plugin utilisant `configureServer`. Vite charge le fichier TypeScript serveur au moyen de `ssrLoadModule`, non comme import exécuté à la construction.

- `/api/health/status` est servi sur le même port que Vite, sans proxy REST supplémentaire.
- Le backend n'est pas créé lors du `vite build` (`apply: 'serve'`).
- `closeServer` appelle `dispose()`, puis `app.teardown()`.
- Écoute de développement limitée à `127.0.0.1`, avec refus de port alternatif (`strictPort`).
- Cette référence ne prend pas en charge Socket.IO, SSR ou le hot-reload serveur métier complet : leurs contrats doivent rester inchangés jusqu'à des tests d'intégration dédiés.

## Plan d'intégration à la version R17

1. Auditer la signature existante de `createFeathersRuntime` et ses responsabilités (écoute HTTP, adaptateur, socket et cycle de vie).
2. Extraire une fabrique pure et réutilisable ; éviter le démarrage dans `vite.config.ts` au moment de son évaluation.
3. Ajouter à `feathers(...)` un mode optionnel, par défaut inchangé ; la déclaration du plugin doit déclencher son initialisation via `configureServer`.
4. Ne pas brancher directement les adaptateurs Express et Koa sur un même objet HTTP sans contrat précis de `handle`; le montage REST sur Connect doit être testé par adaptateur.
5. Laisser Quasar SSR indépendant ; ne pas confondre Vite SPA middleware et serveur SSR de production.
6. Ajouter des tests E2E pour Koa REST / Express REST / Koa+Socket.IO / Express+Socket.IO et le nouveau mode embarqué, puis build, pack, typings, HMR et arrêt sans fuite.

## Vérifications réalisées ici

- `node --test tests/clean-examples.test.mjs` : exécuté dans environnement isolé.
- Exemple REST Vite : sources fournies ; dépendances réseau indisponibles pour `npm install`, `vue-tsc`, démarrage navigateur et E2E. Il ne faut donc **pas** déclarer cet exemple certifié.
