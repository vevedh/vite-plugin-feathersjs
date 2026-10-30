# Exemples Vite, Quasar, daisyUI et FeathersJS v5

Six cas de rendu ont chacun leur entrée. Les exemples utilisent le service `notes` en mémoire et l'API `health`. Aucune donnée ni authentification de production n'est fournie.

| UI | Rendu | Répertoire | État |
|---|---|---|---|
| Quasar 2 | SPA | `generated/r17-quasar-spa` | REST Koa/Express certifié sous Windows ; Socket.IO à confirmer |
| Quasar 2 | SSR | `quasar-ssr` → `../../quasar-ssr` | R16 certifié en développement et production, Koa/Express, Edge |
| Quasar 2 | SSG | `quasar-ssg` | Blueprint v3, garde bloquante tant que migration/SSG non certifiés |
| Vue 3 + daisyUI | SPA | `generated/r17-daisyui-spa` | REST + Socket.IO Koa/Express certifié sous Windows |
| Vue 3 + daisyUI | SSR | `daisyui-ssr` | Dev Koa et production Express certifiés sur Edge |
| Vue 3 + daisyUI | SSG | `daisyui-ssg` | Pré-rendu public, Koa et Express certifiés sur Edge |

## Générer un nouveau projet SPA, SSR ou SSG

Depuis la racine du dépôt :

```powershell
node scripts/generate-r17-project.mjs --name mon-quasar --ui quasar2 --render spa --adapter koa --transport both --dry-run --json
node scripts/generate-r17-project.mjs --name mon-quasar --ui quasar2 --render spa --adapter koa --transport both
node scripts/generate-r17-project.mjs --name mon-daisy --ui daisyui --render spa --adapter express --transport rest
node scripts/generate-r17-project.mjs --name mon-ssr --ui daisyui --render ssr --adapter koa --transport rest
node scripts/generate-r17-project.mjs --name mon-ssg --ui daisyui --render ssg --adapter express --transport rest
node --test tests/r17-generator.test.mjs
```

Les projets sont écrits exclusivement dans `examples/r17/generated/`. Le générateur refuse les collisions, les liens symboliques, les arguments inconnus et les modes non couverts. `--transport both` reste limité aux SPA. Il n'effectue aucun appel réseau et n'installe rien. `--dry-run` n'écrit aucun fichier. Une demande non couverte est une erreur explicite.

## Lancer un exemple

Les SPA sont des applications Vite, Quasar étant intégré via `@quasar/vite-plugin` v1.x (pour Vite 7). Le SSR Quasar utilise, lui, **Quasar CLI**. Le SSR/SSG daisyUI utilise Vite + Vue SSR. Le serveur Feathers est un processus séparé ; en production, configurer explicitement le reverse proxy `/api` et éventuellement `/socket.io`.

Dans chaque nouveau projet généré, installer ses dépendances et lancer `corepack pnpm run dev:all` pour démarrer l’API puis le frontend. Les exemples historiques acceptent toujours `pnpm run dev:api` et `pnpm run dev` dans deux terminaux. Pour les SPA générées, copier `.env.example` vers `.env`. Pour le SSR de production daisyUI, définir `NODE_ENV=production` avant `pnpm run serve:production`.

Le service `notes` n'est pas authentifié : démonstration **locale uniquement**. Le mode SSG ne doit pas pré-rendre de données privées, personnelles ou propres aux utilisateurs.

## R17-r1-r2 : certification automatique sur Windows

Le scénario de test requiert deux serveurs **réellement démarrés** ; pour éviter les faux échecs, utilisez depuis la racine :

```powershell
node examples/r17/scripts/certify-r17.mjs --case quasar-spa --adapter koa
```

Installez d’abord les dépendances de l’exemple concerné et celles de Playwright dans `examples/quasar-ssr`. R17-r1-r2 résout le CLI Playwright via `@playwright/test/cli`, sans dépendre de sous-chemins privés de ses dépendances transitives. Un `--preflight` vérifie le CLI et les ports sans démarrer les serveurs. Le lanceur vérifie l’identité de l’application et lance l’API, Vite et Edge avec GPU désactivé. Voir [Certification Windows](TESTING_WINDOWS.md) pour les quatre cas exécutables. Quasar SSR reste certifié séparément avec R16 ; Quasar SSG reste bloqué.

## R17-r2 — CLI npm indépendant et documentation VitePress

Le générateur utilise maintenant un moteur partagé entre le dépôt et un package autonome, **`@vevedh/create-feathers-app`**. Le nom du package et sa version `0.1.0-rc.1` sont préparés pour une première publication, mais cette publication n’a pas encore été effectuée. Le plugin npm `@vevedh/vite-plugin-feathersjs@0.2.6` ne change pas.

```powershell
Set-Location C:\devs\vite-plugin-feathersjs
node scripts/check-r16-freeze.mjs
node scripts/stage-r17-cli.mjs
node --test tests/r17-generator.test.mjs tests/r17-runner.test.mjs tests/r17-cli-package.test.mjs
npm pack --dry-run .release/create-feathers-app
```

Le site VitePress est dans `docs/cli`. Installer ses dépendances séparément puis exécuter `corepack pnpm run dev` ou `corepack pnpm run build` depuis ce répertoire. Il décrit les quatre modèles réellement générables, les services FeathersJS, le démarrage Windows, les contraintes SSR/SSG et la publication npm.
