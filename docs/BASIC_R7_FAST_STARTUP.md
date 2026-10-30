# Basic r7 — Profilage Vite et disponibilité REST

## Baseline

Basic r6-r1 : 4/4 E2E PASS sous Windows Node 22.23.2. Readiness : Koa REST 31383 ms, Express REST 29046 ms, Koa + Socket.IO 34777 ms, Express + Socket.IO 28454 ms. Le rapport original figure dans `docs-private/basic-r6-reference.json`.

## Modifications

- Le profil **complet par défaut** conserve tous les plugins Vitesse et son fonctionnement initial.
- `FEATHERS_TRANSPORT_PROFILE=1` retire **uniquement dans le profil de benchmark transport** PWA et Vue DevTools : il ne doit pas être utilisé comme certification des fonctionnalités PWA/DevTools.
- `FEATHERS_E2E_RUNS` exécute de 1 à 5 répétitions des quatre modes, avec médiane et échantillons dans deux rapports JSON séparés.
- `PROFILE_R7.ps1` fonctionne en Windows PowerShell 5.1 et PowerShell 7. Il restaure ses variables de processus après chaque exécution.
- Les tests E2E HTTP CRUD et Socket.IO deux clients restent exécutés dans **chaque** profil.

## Certification conseillée

```powershell
corepack pnpm run check:basic:release
.\scripts\PROFILE_R7.ps1 -Profile Full -Runs 3
.\scripts\PROFILE_R7.ps1 -Profile Transport -Runs 3
```

Les rapports sont `docs-private/basic-r7-full-profile.json` et `docs-private/basic-r7-transport-profile.json`. Les comparaisons ne sont fiables qu'à machine, antivirus, cache et charge système comparables. Le premier run est généralement un démarrage plus froid. Ne pas annoncer un objectif de 15 s atteint sans mesure.

## Travail restant

Profilage individuel par plugin et HMR réseau avec changement de fichier ne sont pas encore implémentés. Cette itération **mesure** un profil complet versus un profil transport sans supposer quel plugin est lent. La variante légère ne doit jamais remplacer la vérification complète.
