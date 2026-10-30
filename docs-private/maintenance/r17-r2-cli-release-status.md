# R17-r2 — CLI npm et documentation VitePress

## Décision

- Nom npm proposé : `@vevedh/create-feathers-app` (indépendant de `@vevedh/vite-plugin-feathersjs@0.2.6`).
- Commande : `create-feathers-app`, publication candidate `0.1.0-rc.1` au tag npm `next` **après** validation du compte, du registre et des tests Windows.
- Publication non effectuée. Un résultat npm E404 avant publication ne prouve pas la disponibilité du nom à l'instant de la publication ; revérifier.

## Provenance des certifications

Les résultats Windows précédemment transmis confirment le SSR Quasar R16 en développement et production avec Edge, Koa et Express. Les tests utilisateur R17 montrent daisyUI SPA REST/Socket.IO Koa/Express PASS, daisyUI SSR Dev Koa et Production Express PASS, daisyUI SSG Koa/Express PASS. Quasar SPA REST Koa/Express PASS ; Socket.IO dans ce mode reste à confirmer. Ces résultats concernent les exemples du dépôt, **pas encore les nouveaux projets créés par le paquet CLI**.

## Gates CLI de cette archive

- Gel R16 : `node scripts/check-r16-freeze.mjs`
- Tests locaux Node : `node --test tests/r17-generator.test.mjs tests/r17-runner.test.mjs tests/r17-cli-package.test.mjs`
- Staging : `node scripts/stage-r17-cli.mjs`
- Manifest npm : `npm pack --dry-run .release/create-feathers-app`
- Installation d'un tarball npm dans un dossier isolé puis génération de deux modèles : réalisée localement hors Windows avec Node 22.
- Documentation : `node scripts/check-r17-docs.mjs` (contrat des liens et pages). `docs/cli` build VitePress à valider sous Windows.
- Certification Windows des quatre générations et de `dev:all` : en attente.

## Garde-fous

- `private: true` dans `packages/create-feathers-app/package.json`; seul `.release/create-feathers-app/package.json` retire cette protection.
- Le package contient CLI et templates, pas les fichiers des secrets, `node_modules`, `docs-private` ni les captures internes.
- `gitignore.template` est reconverti en `.gitignore` lors de la génération à partir du paquet installé.
- Quasar SSR : référence R16 conservée, non générée; Quasar SSG bloqué. daisyUI SSR/SSG REST uniquement.
- Aucun ajout d'authentification, de DB persistante ou de publication de ports en production ; exemples de laboratoire locaux.
