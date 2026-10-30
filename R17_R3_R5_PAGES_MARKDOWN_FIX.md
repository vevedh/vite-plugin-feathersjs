# R17-r3-r5 — Correction VitePress GitHub Pages

## Résultat Windows reçu (29 octobre 2026)

La certification du projet **Quasar 2 SSR généré** est désormais réussie sur les deux adaptateurs :
- Koa : `/api/health` JSON, CRUD `notes`, validation `tickets`, préchargement SSR, puis **4/4 tests Playwright Edge PASS**.
- Express : mêmes contrôles HTTP/SSR et **4/4 tests Playwright Edge PASS**.
- Total : **8/8 scénarios Edge PASS**. Les contrôles stricts TypeScript et le build Quasar SSR avaient déjà été validés.

Le blocage est exclusivement documentaire : `certify-and-stage-pages-windows.ps1` a échoué pendant `vitepress build` avec `Element is missing end tag`, dans `docs/cli/guide/identites-bases.md`. Le contrôle de source seul avait indiqué PASS, donc la validation statique ne couvrait pas le problème.

## Cause et correction

Le tableau Markdown comportait des **barres verticales non échappées dans des cellules de code** :

- `--db <alias>:postgresql|mariadb|mysql|sqlite`
- `--schema typebox|json|zod`

Le parseur Markdown peut traiter ces `|` comme des délimiteurs de colonnes, ce qui perturbe le balisage et permet à un placeholder HTML tel que `<alias>` de devenir une balise Vue non terminée.

Corrections :
1. `docs/cli/guide/identites-bases.md` : exemples distincts et nom de connexion `NOM`, légende explicative, syntaxe de tableau sans ambiguïté.
2. `docs/cli/guide/depannage.md` : explication simple du problème et procédure de diagnostic.
3. `scripts/r17/vitepress-markdown-lint.mjs` : détection des barres verticales non échappées dans un segment de code au sein d'une ligne de tableau.
4. `scripts/check-r17-docs.mjs` : contrôle désormais bloquant si ce motif apparaît.
5. `tests/r17-r3-r5-vitepress-markdown.test.mjs` : trois tests de régression, dont reproduction du défaut initial.

**Pas de changement** du moteur CLI, des templates npm, du gel R16 ou du setup ECC.

## Validations exécutées localement

- `node scripts/check-r16-freeze.mjs` : PASS, 20 fichiers R16 intacts.
- `node scripts/ecc/verify-ecc-contract.mjs` : PASS.
- `node scripts/check-r17-docs.mjs` : PASS, 16 pages.
- `node scripts/r17/check-pages-publication.mjs` : PASS, 21 sources VitePress publiques, workflow limité à `main` et bon sous-chemin GitHub Pages.
- Huit suites de tests R17 incluant la nouvelle suite Markdown : **34/34 tests PASS**.
- `node scripts/stage-r17-cli.mjs` : PASS, `0.1.0-rc.2`, 95 fichiers.
- `npm pack --dry-run --json` : PASS, 95 fichiers, 35 096 octets compressés, aucun dossier interdit.

### Limite de validation

Le **build VitePress réel ne peut pas être reproduit dans l'environnement de préparation** : aucun `vitepress` local et accès au registre npm indisponible (`EAI_AGAIN`). Le correctif source et les tests de régression passent, mais la certification Windows Pages reste ouverte jusqu'à votre prochain `vitepress build` réussi. Aucune publication GitHub n'a été effectuée : la tentative antérieure de créer une branche via l'intégration GitHub a rencontré un HTTP 403.

## Validation Windows (PowerShell)

```powershell
Set-Location C:\devs
Expand-Archive -LiteralPath 'C:\perso\vite-plugin-feathersjs-r17-r3-r5-vitepress-markdown-overlay.zip' -DestinationPath C:\devs -Force
Set-Location C:\devs\vite-plugin-feathersjs
node scripts/check-r16-freeze.mjs
if ($LASTEXITCODE -ne 0) { throw 'R16 freeze FAILED' }
node --test tests/r17-r3-r5-vitepress-markdown.test.mjs
if ($LASTEXITCODE -ne 0) { throw 'Markdown tests FAILED' }
node scripts/check-r17-docs.mjs
if ($LASTEXITCODE -ne 0) { throw 'Docs source FAILED' }
.\scripts\r17\certify-and-stage-pages-windows.ps1
```

Lorsque le build VitePress et la préparation isolée des sources Git sont validés :

```powershell
# Après revue et uniquement avec les droits GitHub appropriés :
.\scripts\r17\certify-and-stage-pages-windows.ps1 -Push
```

Créer ensuite une PR de documentation vers `main`, fusionner seulement les sources `docs/cli/**` et `.github/workflows/cli-vitepress-pages.yml`, choisir GitHub Actions sous Settings → Pages, puis valider le workflow et l'adresse `https://vevedh.github.io/vite-plugin-feathersjs/`. Cette URL est une **cible de déploiement, pas une confirmation de site en ligne**.

Le package `@vevedh/create-feathers-app@0.1.0-rc.2` demeure une **candidate non publiée**.
