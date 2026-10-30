# Basic r8-r4 — Synchronisation pnpm idempotente (Windows)

## Incident

Après correction de la résolution ESM, `prepare:feathers:local` échouait sur `ERR_FS_CP_EINVAL` : Node refusait de copier `dist/app.d.ts` sur le même fichier. Selon le mode d'installation `file:` de pnpm, le paquet local peut partager des fichiers liés avec les sources compilées.

## Correctif

- `examples/basic/scripts/sync-local-dist.mjs` : synchronisation fichier par fichier, comparaison `realpath` pour les répertoires et comparaison `stat.dev`/`stat.ino` pour les fichiers déjà identiques.
- Les fichiers distincts sont toujours copiés et les modules manquants, notamment `performance.js`, sont ajoutés.
- Aucun changement de version, d'exports ESM, de protocole Express/Koa/Socket.IO ou de dépendances.
- `test-local-dist-sync.mjs` vérifie les hardlinks, copies indépendantes et liens symboliques de répertoires.
- `check:basic:release` inclut le nouveau test avant la synchronisation.

## Certification Windows

```powershell
Set-Location C:\devs\vite-plugin-feathersjs\examples\basic
corepack pnpm run test:feathers:local-dist-sync
if ($LASTEXITCODE -ne 0) { throw 'Dist sync test failed' }
corepack pnpm run prepare:feathers:local
if ($LASTEXITCODE -ne 0) { throw 'Prepare failed' }
corepack pnpm run check:basic:release
if ($LASTEXITCODE -ne 0) { throw 'Basic release failed' }
.\scripts\PROFILE_R8.ps1 -Runs 3
if ($LASTEXITCODE -ne 0) { throw 'Benchmark failed' }
```

Ne pas relancer `pnpm install` pour ce correctif si le projet est déjà installé. L'ensemble des E2E réseau doit être exécuté sous Windows avant certification.
