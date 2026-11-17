# Référence CLI — sources `0.1.0-rc.10`

Commande : `create-feathers-app <nom> [options]` (alias `cfapp` dans le prochain paquet). Cette page décrit **la source candidate locale**, pas nécessairement la version npm déjà publiée.

| Option | Valeurs acceptées | Par défaut |
| --- | --- | --- |
| `<nom>` ou `--name` | Nom du projet en kebab-case | obligatoire |
| `--dir` | Dossier de destination simple, sans traversée | nom du projet |
| `--ui` | `quasar2`, `daisyui` | `daisyui` |
| `--render` | `spa`, `ssr`, `ssg` | `spa` |
| `--adapter` | `koa`, `express` | `koa` |
| `--transport` | `rest`, `both` | `rest` |
| `--dev-api` | `vite`, `separate` | `vite` pour SPA, `separate` pour SSR/SSG |
| `--pwa` | `on`, `off` | `off` |
| `--schema` | `typebox`, `json`, `zod` | `typebox` |
| `--auth` | `none`, `jwt`, `oauth2`, `oidc`, `keycloak` | `none` |
| `--db` | `alias:adapter[,alias:adapter]` | `main:memory` |
| `--database-mode` | `single`, `multi`, `universal` | `single` |
| `--compose` | `off`, `dev`, `prod`, `both`, `dev-prod` | `off` |
| `--persistence` | `off`, `lab` | `off` |
| `--tenant-mode` | `off`, `isolated-lab` | `off` |
| `--cache` | `none` ou option de blueprint configurée | `none` |
| `--storage` | `none` ou option de blueprint configurée | `none` |
| `--dry-run` | Simulation sans création de projet | désactivé |
| `--json` | Résultat au format JSON | désactivé |
| `--help`, `--version` | Aide et version du binaire | — |

Les adaptateurs déclarables incluent `memory`, `mongodb`, `postgresql`, `mariadb`, `mysql`, `sqlite` et `universal`. **Déclarable ne signifie pas opérationnel** : la persistance lab n'accepte qu'un provider pris en charge et le mode multi-DB est encore un plan de raccordement. Les options ne sont pas toutes combinables : le CLI refuse explicitement les profils non reconnus ou non certifiés.

## Exécution npm (après publication)

```powershell
npx --yes --package=@vevedh/create-feathers-app@latest create-feathers-app --help
npx --yes --package=@vevedh/create-feathers-app@latest cfapp --version
```

Les deux exécutables sont inclus dans le même package. Ne pas utiliser `npx cfapp` sans `--package` : cela ne sélectionne pas nécessairement notre CLI.

## Démonstration locale sans authentification

```powershell
cfapp --name portail --ui quasar2 --render spa --transport both --schema zod --auth none --db main:memory --dry-run --json
```

## Génération Docker Compose

```powershell
cfapp --name portail-compose --ui daisyui --render spa --dev-api vite --auth none --db main:memory --compose both --dry-run --json
```

Le profil Dev/Prod décrit un laboratoire en loopback ; il ne garantit pas l'authentification, les sauvegardes, les secrets ni la sécurité d'un déploiement public.

## Persistance avec JWT et contrôle des organisations

```powershell
cfapp --name portail-tenant --ui quasar2 --render spa --dev-api vite --auth jwt --database-mode universal --db main:universal --compose prod --persistence lab --tenant-mode isolated-lab --dry-run --json
```

Ce profil est **expérimental** : il faut encore certifier les migrations, la révocation, les ACL objet, les transports REST/Socket.IO et les trois moteurs en E2E Docker avant une utilisation réseau. Pour un plan multi-DB distinct : `--database-mode multi --db main:postgresql,events:mariadb`, sans prétendre qu'il y a du routage opérationnel.

## Ajouter un service

Commande : `create-feathers-app service add <nom>`. Options : `--project`, `--schema`, `--db`, `--auth`, `--lang`, `--dry-run`. `--auth` sur un service accepte `none` ou `jwt` selon le profil.

```powershell
cfapp service add tickets --project portail --schema zod --db main --auth none --lang ts --dry-run
```

`--engine` et `--ui daisyui-kit` sont étudiés dans le planificateur, mais indisponibles dans la commande de génération.
