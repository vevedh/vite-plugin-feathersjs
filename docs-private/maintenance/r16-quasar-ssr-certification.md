> **Archive de référence historique (candidate).** Le rapport de clôture et les résultats Windows se trouvent dans [`R16_CERTIFICATION_FINAL_2026-10-28.md`](R16_CERTIFICATION_FINAL_2026-10-28.md). Les états « à certifier » ci-dessous sont conservés comme historique.

# R16 — Quasar 2 / Vite SSR / FeathersJS v0.2.6 — candidate de certification

## Périmètre

Baseline `examples/basic` r15-r1 préservée. Nouvel exemple indépendant `examples/quasar-ssr` en Quasar CLI v2 + Vue 3 + Pinia, avec runtime FeathersJS v5 basé sur **l'export public `createFeathersRuntime`** du package, non sur le hook Vite `configureServer` réservé au développement. Reverse proxy localhost de laboratoire et Socket.IO dédié (attention : `app.listen(port)` de la version 0.2.6 peut écouter toutes les interfaces ; limiter par pare-feu en laboratoire).

Source d'inspiration : archive Quasar SSR/Firebase fournie par l'utilisateur. Aucun fichier `.env`, configuration Firebase ou secret n'a été repris. L'exemple Quasar est minimal pour isoler le comportement SSR.

## Portes de validation

| Porte | Vérification | État dans l'environnement de construction |
|---|---|---|
| P0 | Contrats Node, arborescence Quasar SSR, routes edge | PASS (Node `node --test`) |
| P1 | Routage HTTP réel via serveur edge et serveurs témoins | PASS (Node réseau loopback) |
| P2 | Installation Quasar CLI v2 et packages Feathers v5 | NON exécutée (dépendances absentes) |
| P3 | `quasar build -m ssr` et HTML SSR HTTP 200 | À certifier sur Windows |
| P4 | Services Feathers `/api/health`, CRUD `notes` | À certifier sur Windows |
| P5 | Quatre configurations Koa/Express x Socket off/on | À certifier sur Windows |
| P6 | Socket.IO 2 clients et HMR/SSR hydratation sans avertissements | À certifier sur Windows/Edge |
| P7 | Build SSR de production démarré et testé | À certifier sur Windows |
| P8 | Isolation de sessions, sécurité auth, performance | Hors périmètre : pas d'authentification de production |

La certification Quasar SSR en production **n'est pas revendiquée** à ce stade.

## Particularités

- Le plugin Vite `apply: 'serve'` ne peut pas assurer l'intégration en serveur SSR compilé ; le runtime de production est distinct.
- `@quasar/app-vite` v2 correspond au starter fourni ; la branche v3 actuelle s'appuie sur Vite 8, à traiter dans un chantier de compatibilité séparé.
- Sur production, utiliser un vrai reverse proxy gérant le websocket (Traefik, HAProxy ou Nginx). Le routeur local est une **maquette sur loopback**, pas une surface publique.
- Services r16 en `.mjs` pour un démarrage backend Node sans `tsx`; ils répliquent le contrat `notes`/`health` de `examples/basic`. Industrialisation CLI : déplacer les sources des services vers une bibliothèque partagée, générer à la fois la variante Vite dev et Node production et supprimer les copies.
- Pinia : instance par requête Quasar ; pas de token ni Socket.IO dans l'état hydraté ; `onServerPrefetch` utilise l'API interne loopback ; écoute realtime côté client seulement.
- Auth : cette démonstration est volontairement non authentifiée, à ne pas exposer.

## Commandes Windows

```powershell
# Répertoire racine
npm run build
Set-Location examples/quasar-ssr
corepack pnpm install
corepack pnpm run check:contracts
corepack pnpm run build:ssr
# Exécuter ensuite une configuration à la fois :
.\scripts\CERTIFY_R16_WINDOWS.ps1 -Stage Dev -Adapter koa
.\scripts\CERTIFY_R16_WINDOWS.ps1 -Stage Dev -Adapter express
.\scripts\CERTIFY_R16_WINDOWS.ps1 -Stage Dev -Adapter koa -Socket
.\scripts\CERTIFY_R16_WINDOWS.ps1 -Stage Dev -Adapter express -Socket
.\scripts\CERTIFY_R16_WINDOWS.ps1 -Stage Production -Adapter koa
```

Surveiller les journaux `examples/quasar-ssr/docs-private/r16/` pour les échecs de CLI Quasar ou de Node.

## Suites r16

1. Corriger les éventuelles incompatibilités du scaffold et certifier le build SSR avec Quasar CLI v2.
2. Ajouter les E2E navigateur Edge (hydratation, événements) et la matrice de transports.
3. Mutualiser les services via un contrat généré pour éviter toute divergence SPA/SSR.
4. Introduire la génération CLI conditionnelle UI/SSR/SSG, puis les schémas TypeBox/Zod/JSON Schema et bases nommées.
