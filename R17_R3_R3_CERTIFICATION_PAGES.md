# R17-r3-r3 — Quasar SSR HTTP + Edge / VitePress Pages

## Résultat au 29 octobre 2026

- Baseline R16 : 20/20 fichiers identiques, vérification locale PASS.
- Unit et contrats R17 : **30/30 PASS** dans l'environnement de préparation (Node 22).
- Typescript réel/build Quasar 2 SSR : **PASS sur Windows**, selon le journal d'exécution fourni dans le chat avant ce correctif.
- Koa et Express, modèles npm `0.1.0-rc.1` : tests HTTP + Playwright Edge PASS sur Windows selon le journal précédent.
- Suite nouvelle Quasar SSR généré `rc.2` : **écrite, syntaxe vérifiée, contrat Node PASS**. Exécution HTTP/Playwright Edge réelle sur Windows **à effectuer**.
- GitHub Pages : sources VitePress validées (16 pages, 21 fichiers publics), workflow présent. **Non déployé** : la connexion GitHub actuelle reçoit HTTP 403 à la création de branche. Publier via Git Windows de l'utilisateur et confirmer la source Pages dans Settings > Pages.
- Package npm `@vevedh/create-feathers-app@0.1.0-rc.2` : 95 fichiers propres en staging, **non publié**, ne pas remplacer `0.1.0-rc.1`.

## A. Certifier le Quasar SSR généré sur Windows

```powershell
Set-Location C:\devs
Expand-Archive -LiteralPath "C:\perso\vite-plugin-feathersjs-0.2.6-r17-r3-r3-quasar-ssr-edge-pages-cumulative.zip" -DestinationPath C:\devs -Force
Set-Location C:\devs\vite-plugin-feathersjs\examples\quasar-ssr
corepack pnpm install
if ($LASTEXITCODE -ne 0) { throw "Playwright dependencies FAILED" }
Set-Location C:\devs\vite-plugin-feathersjs
.\scripts\r17\certify-quasar-ssr-generated-windows.ps1 -Adapter both
if ($LASTEXITCODE -ne 0) { throw "Quasar SSR certification FAILED" }
```

Attendu : installation du projet, `vue-tsc --noEmit`, `quasar build -m ssr`, API JSON 200, CRUD notes/tickets, note visible dans le HTML SSR avant JavaScript, **4 tests Edge** par adaptateur. Ports 3030, 3031, 8080 et 9100 libres. Logs locaux sous `examples/r17/docs-private/certifications`.

## B. Publier la documentation VitePress

```powershell
Set-Location C:\devs\vite-plugin-feathersjs
.\scripts\r17\certify-and-stage-pages-windows.ps1
# Après revue de la branche préparée :
.\scripts\r17\certify-and-stage-pages-windows.ps1 -Push
```

Ce script clone le dépôt historique GitHub dans un dossier temporaire et prépare un commit **docs seulement**, en préservant intégralement son code d'application. Créer une PR vers `main`, fusionner, puis dans `Settings > Pages` définir la source `GitHub Actions`. Contrôler le workflow et la disponibilité de `https://vevedh.github.io/vite-plugin-feathersjs/`.

## Sécurité et limitation

- Le plugin npm `0.2.6`, les 20 fichiers R16 et la publication `0.1.0-rc.1` ne sont pas modifiés.
- Aucun secret ni donnée d'authentification n'est nécessaire pour le workflow Pages.
- Ne pas mélanger le code source complet de la candidate avec le dépôt GitHub actuel (historique `package.json` distinct).
- Aucune certification navigateur n'est revendiquée avant son exécution effective.
