# Basic r8-r2 — Build et snapshot pnpm local

## Diagnostic

Le premier scénario E2E échouait avec `ERR_MODULE_NOT_FOUND: dist/performance.js` : `src/performance.ts` avait été ajouté en r8, mais `dist/index.js` dans le snapshot `file:../..` installé par pnpm référençait un fichier absent. Le timeout HTTP était une conséquence de l'échec de chargement Vite.

## Correction

`examples/basic/scripts/prepare-local-plugin.mjs` compile d'abord les sources du plugin avec le TypeScript local, vérifie les artefacts requis, puis synchronise `dist/` dans le snapshot installé du package local. Le script limite l'écriture au chemin `node_modules` résolu et contrôle le nom et la version du package. Pas de `pnpm install --force` et aucune modification des dépendances.

`check:basic:release`, `test:feathers:e2e` et `PROFILE_R8.ps1` exécutent ce précontrôle. Ne pas confondre une vérification syntaxique locale avec la certification réseau Windows.

## Validation

Depuis `examples/basic` : `corepack pnpm run check:basic:release`, puis `.\scripts\PROFILE_R8.ps1 -Runs 3`.
