# create-feathers-app

Générez des applications FeathersJS v5 avec Vue 3, Pinia, Vite, Quasar 2 ou Tailwind CSS + daisyUI.

Le CLI est indépendant du runtime [`@vevedh/vite-plugin-feathersjs`](https://www.npmjs.com/package/@vevedh/vite-plugin-feathersjs) (version 0.2.6). La version candidate `0.1.0-rc.2` **n'est pas encore publiée**.

## Usage

```powershell
# Préversion disponible sur npm : 0.1.0-rc.1
npm exec --yes --package=@vevedh/create-feathers-app@0.1.0-rc.1 -- create-feathers-app portail --ui daisyui --render spa

# R17-r3 candidat, depuis les sources mises en stage :
node .release/create-feathers-app/bin/create-feathers-app.mjs portail-ssr --ui quasar2 --render ssr
```

| Interface | SPA | SSR | SSG |
| --- | --- | --- | --- |
| Quasar 2 | Générable | Générable, validation Windows en cours | Bloqué |
| daisyUI 5 | Générable | Générable | Générable |

## Ajouter un service Feathers

```powershell
cd portail
node ../chemin/vers/create-feathers-app/bin/create-feathers-app.mjs service add tickets --schema zod --db main
```

Le générateur ajoute le module `api/services/tickets` et son inscription dans le registre Feathers. Les schémas disponibles sont `typebox`, `json` et `zod`. Le service mémoire est destiné au laboratoire local, avec CRUD REST et validation des données.

## Profils d'identité et de bases

La création de projet accepte `--auth none|jwt|oauth2|oidc|keycloak`, `--schema typebox|json|zod` et `--db main:memory,audit:mongodb` avec alias nommés. **Les authentifications externes et les connexions persistantes sont des profils de configuration, pas des intégrations opérationnelles.** L'API échoue volontairement au démarrage jusqu'au raccordement et à la certification du fournisseur ou du SGBD.

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
