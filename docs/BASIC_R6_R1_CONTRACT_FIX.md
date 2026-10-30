# Basic r6-r1 — Correction du contrat Socket.IO dynamique

## Symptôme
`test:feathers:contract` échouait sur `/port: 3031/`, car r6 utilise désormais `port: socketPort`.

## Correction
Le contrat vérifie la valeur par défaut de `FEATHERS_SOCKET_PORT` (3031), son usage dans la configuration, le basculement REST-only et le réglage d’origine pour les tests E2E.

## Tests exécutés ici
- `node scripts/check-feathers-integration.mjs` PASS
- `node scripts/check-feathers-realtime.mjs` PASS
- `node scripts/check-feathers-modes.mjs` PASS
- `node --check scripts/check-basic-e2e.mjs` PASS

## Certification Windows à exécuter
`corepack pnpm run check:basic:release` depuis `examples/basic`.

Les tests réseau n’ont pas été exécutés dans cet environnement et restent à certifier.
