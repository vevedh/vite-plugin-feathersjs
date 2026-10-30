# R17-r3-r4 — Correction du test Edge QInput du Quasar SSR généré

## Constat Windows du 29 octobre 2026

L'archive R17-r3-r3 a passé le typecheck strict, le build SSR, et la vérification HTTP du backend Feathers (services `health`, `notes`, `tickets`). Le scénario Edge SSR-prefetch, le responsive et les contrôles de routage ont réussi (3/4). Le seul scénario en échec cherchait à tort `[data-testid="note-title-input"] input`. Le SSR généré Express n'a pas été essayé, car le runner Windows s'arrête sur le premier échec Koa.

## Correction

- Le test `examples/quasar-ssr/e2e/r17-generated-ssr.pw.mjs` utilise le **nom accessible** de l'input Quasar : `page.getByRole('textbox', { name: 'Titre de la nouvelle note', exact: true })`.
- Vérifications supplémentaires : visibilité, activation, valeur du champ après `fill()`, apparition de la note, persistance après actualisation, diagnostics navigateur.
- Le test Node `tests/r17-quasar-ssr-generated.test.mjs` vérifie que le bon sélecteur est identique à la pratique R16 certifiée et interdit le descendant fautif.
- **Aucun changement** des fichiers gelés R16, du template Quasar, du package npm ou du setup ECC.

## Reprise rapide sous PowerShell (depuis le dépôt)

```powershell
Set-Location C:\devs\vite-plugin-feathersjs
node scripts/check-r16-freeze.mjs
node --test tests/r17-quasar-ssr-generated.test.mjs
node examples/r17/scripts/certify-quasar-ssr-generated.mjs --adapter koa
if ($LASTEXITCODE -ne 0) { throw 'Edge Quasar SSR Koa FAILED' }
node examples/r17/scripts/certify-quasar-ssr-generated.mjs --adapter express
if ($LASTEXITCODE -ne 0) { throw 'Edge Quasar SSR Express FAILED' }
```

Ce parcours relance HTTP et Microsoft Edge sur la candidate déjà construite, sans réinstaller ni recompiler. Il refuse de tester si un port attendu est occupé. Les suites générées attendent `http://127.0.0.1:8080` (reverse proxy local), Quasar SSR en `127.0.0.1:9100` et Feathers REST en `127.0.0.1:3030`.

## Certification complète après la reprise rapide

```powershell
.\scripts\r17\certify-quasar-ssr-generated-windows.ps1 -Adapter both
```

Ce script installe les dépendances, fait typecheck + build, exécute HTTP et Edge sur Koa puis Express et s'arrête à la première erreur. **Les résultats Windows Edge après correctif restent à confirmer.**

## GitHub Pages (chantier distinct, non déployé)

```powershell
.\scripts\r17\certify-and-stage-pages-windows.ps1
# Examiner la branche préparée et le diff, puis seulement :
.\scripts\r17\certify-and-stage-pages-windows.ps1 -Push
```

Ouvrir et fusionner une PR de documentation vers `main`, puis sélectionner GitHub Actions dans Settings > Pages. L'adresse prévue est `https://vevedh.github.io/vite-plugin-feathersjs/`.

La tentative de création de branche via l'intégration GitHub a renvoyé 403 ; aucun déploiement distant n'est établi.
