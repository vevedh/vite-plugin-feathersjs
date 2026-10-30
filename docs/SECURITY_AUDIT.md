# Audit de sécurité — 0.2.4-r1 (17 octobre 2026)

## Baseline certifiée

Les résultats Windows 0.2.3-r1 transmis montrent 15/15 tests unitaires, 4/4 scénarios REST/Socket.IO, typecheck, build et npm pack PASS.

## Résultats npm audit 0.2.3

- Runtime: 5 alertes élevées via `globby -> fast-glob -> micromatch -> braces` et `picomatch`.
- Global: 11 alertes: 1 modérée, 8 élevées, 2 critiques. Les chemins supplémentaires incluent `vitest/@vitest/mocker/tinypool`, `nanoid`, `postcss`, `source-map-js`.
- La version 0.2.4 remplace `globby` par `tinyglobby ^0.2.17` pour supprimer ce chemin direct, et met `vitest` à `^5.0.5` pour lever la contrainte de version ancienne. Cela ne garantit **pas** un audit à zéro: les dépendances transitives et le lockfile doivent être contrôlés après installation.

## Contrôles Windows

```powershell
npm install
if ($LASTEXITCODE -ne 0) { throw 'install FAILED' }
npm run check:fast
if ($LASTEXITCODE -ne 0) { throw 'fast FAILED' }
npm run check:release
if ($LASTEXITCODE -ne 0) { throw 'release FAILED' }
npm run audit:runtime
if ($LASTEXITCODE -ne 0) { Write-Warning 'Runtime advisories require analysis' }
npm run audit:all
if ($LASTEXITCODE -ne 0) { Write-Warning 'Global advisories require analysis' }
```

Ne pas exécuter `npm audit fix --force`. Vérifier les dépendances transitives, les versions réellement résolues et les changements d'API liés à Vitest 5.

## Windows findings, 0.2.4-r1

- `npm audit --omit=dev`: **0 vulnerabilities**.
- `npm audit`: **3 high** (`nanoid`, `postcss`, `source-map-js`), all reported fixable by ordinary `npm audit fix`.
- `scripts/SECURITY_FIX.ps1` creates a backup of `package.json` and `package-lock.json`, applies a **non-forced** fix, re-runs both audits, then runs `check:release` once. All failures stop the process.
- This fix only becomes certified after the actual Windows `package-lock.json` resolution is verified. Do not use `--force`.
