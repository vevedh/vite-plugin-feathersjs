# create-feathers-app

Générez des applications FeathersJS v5 avec Vue 3, Pinia, Vite, Quasar 2 ou Tailwind CSS + daisyUI.

Le CLI est indépendant du runtime [`@vevedh/vite-plugin-feathersjs`](https://www.npmjs.com/package/@vevedh/vite-plugin-feathersjs) (version 0.2.7). La version `0.1.0-rc.5` est la candidate présente dans les sources locales. Ne pas présumer de sa publication npm ; vérifier les versions du registre avant installation. La PWA reste optionnelle pour une SPA.

## Usage

```powershell
# Préversion disponible sur npm : 0.1.0-rc.1
npm exec --yes --package=@vevedh/create-feathers-app@0.1.0-rc.1 -- create-feathers-app portail --ui daisyui --render spa

# Candidate RC5, depuis les sources mises en stage :
node .release/create-feathers-app/bin/create-feathers-app.mjs portail-ssr --ui quasar2 --render ssr
```

| Interface | SPA | SSR | SSG |
| --- | --- | --- | --- |
| Quasar 2 | Générable | Générable, validation Windows complète à vérifier | Bloqué |
| daisyUI 5 | Générable | Générable | Générable |

## PWA optionnelle (SPA uniquement)

Le paramètre `--pwa on` ajoute `vite-plugin-pwa` v2 en dépendance de développement, une icône SVG locale de démonstration et un manifeste Web App. Le service worker, désactivé en développement, est généré au build et conserve uniquement des ressources statiques, jamais les réponses `/api` ou les échanges Socket.IO. Par défaut, `--pwa off` ne change pas les templates existants.

```powershell
node .release/create-feathers-app/bin/create-feathers-app.mjs portail-spa --ui quasar2 --render spa --pwa on --dry-run
```

SSR/SSG avec PWA est refusé tant que leur cycle de vie n'est pas certifié. Pour une installation sur les navigateurs ciblés, remplacer l'icône SVG de démonstration par des icônes PNG 192 et 512 pixels, puis contrôler HTTPS, les mises à jour et le mode hors-ligne.

## Ajouter un service Feathers

```powershell
cd portail
node ../chemin/vers/create-feathers-app/bin/create-feathers-app.mjs service add tickets --schema zod --db main
```

Le générateur ajoute le module `api/services/tickets` et son inscription dans le registre Feathers. Les schémas disponibles sont `typebox`, `json` et `zod`. Le service mémoire est destiné au laboratoire local, avec CRUD REST et validation des données.

## Profils d'identité et de bases

La création de projet accepte `--auth none|jwt|oauth2|oidc|keycloak`, `--schema typebox|json|zod` et `--db main:memory,audit:mongodb` avec alias nommés. **Les profils JWT disposent de modules Feathers/CASL et les providers nommés de modules serveur ; le bootstrap HTTP sécurisé et les tests DB restent à certifier. Les autres fournisseurs externes sont des profils de configuration, pas des intégrations opérationnelles.** L'API échoue volontairement au démarrage jusqu'au raccordement et à la certification du fournisseur ou du SGBD.

Les projets sans authentification sont exclusivement des démonstrations locales. Ils ne doivent jamais être exposés tels quels sur Internet. Aucun secret, mot de passe ou jeton n'est inclus dans les templates.

## Windows

```powershell
corepack pnpm install
corepack pnpm run typecheck
corepack pnpm run build
corepack pnpm run dev:all
```

SPA et daisyUI SSR/SSG utilisent `http://127.0.0.1:5173`. Quasar SSR utilise `http://127.0.0.1:8080` via un proxy local ; le SSR brut écoute sur 9100.

La documentation publique VitePress figure dans `docs/cli` du dépôt et sera déployée sur GitHub Pages après activation du workflow de publication.

## API Feathers intégrée à Vite en développement (RC5)

Pour les applications SPA, `--dev-api vite` est désormais la valeur par défaut.
Le plugin public `@vevedh/vite-plugin-feathersjs@0.2.7` est chargé depuis
`vite.config.ts` et monte les services sur `/api` pendant `vite dev`.
Il n'y a pas de second serveur REST ni de proxy REST à démarrer.

L'option `--dev-api separate` conserve l'ancien comportement à deux processus.
Pour SSR/SSG, le mode séparé reste obligatoire. Avec `--transport both`,
Socket.IO reste sur le port privé `127.0.0.1:3031`, accessible depuis la SPA
via le proxy WebSocket Vite. La configuration de Feathers échoue au chargement
si les profils d'identité ou bases externes ne sont pas opérationnels.

```powershell
node .release/create-feathers-app/bin/create-feathers-app.mjs mon-spa --ui quasar2 --render spa --dev-api vite --transport both
```

**Production** : le plugin Vite s'exécute uniquement en développement.
Le serveur `api/server.mjs` autonome reste disponible et obligatoire pour
le déploiement ; `vite preview` n'héberge pas l'API.
La version `0.2.7` du plugin doit être certifiée et publiée avant une installation depuis npm.
