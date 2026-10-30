# R17-r2-r1 — Durcissement de la publication npm du CLI (Windows)

## Incident observé le 29 octobre 2026

La candidate R17-r2 affichait `npm pack` avec 16 447 fichiers, 54,4 Mo compressés et 224,4 Mo décompressés. Le paquet embarquait `templates/daisyui-ssr/node_modules`, des binaires Windows et les artefacts `dist`. Le test `r17-cli-package.test.mjs` expirait après 30 secondes, son `spawnSync` renvoyant `status: null`.

Le problème ne venait ni du plugin Vite publié `0.2.6`, ni des modèles d'application : le script de staging copiait les exemples en utilisant une exclusion de chemin qui ne reconnaissait pas les séparateurs Windows.

## Correction

- Copie par liste blanche des fichiers source SSR/SSG, jamais du dossier complet de l'exemple.
- Exclusion portable POSIX/Windows sur les chemins, rejet des liens symboliques.
- Contrôle bloquant du contenu `.release` : aucun `node_modules`, `dist`, fichier d'environnement privé ou lockfile d'exemple ; maximum 120 fichiers et 1 Mo non compressé.
- Test npm `pack --dry-run --json` avec contrôle du nombre et de la taille des fichiers.
- Timeout du test emballage relevé à 120 s avec diagnostic d'erreur explicite, et lancement de npm compatible PowerShell/Windows.
- Documentation VitePress de publication complétée.

**Ne pas publier la candidate R17-r2 d'origine.** La correction ne publie rien sur npm ; le tag `next` sera attribué après certification Windows.

## Portes de validation

```powershell
node scripts/check-r16-freeze.mjs
node --test tests/r17-generator.test.mjs tests/r17-runner.test.mjs tests/r17-cli-package.test.mjs
node scripts/check-r17-docs.mjs
node scripts/stage-r17-cli.mjs
npm pack --dry-run --json .release/create-feathers-app
```

La baseline R16 et le code runtime npm sont inchangés.
