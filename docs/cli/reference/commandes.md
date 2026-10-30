# Référence du CLI

Commande : `create-feathers-app <nom> [options]`.

| Option | Valeurs | Par défaut |
|---|---|---|
| `<nom>` ou `--name` | nom kebab-case, maximum 48 caractères | requis |
| `--dir` | nom d'un dossier sans séparateur | même nom que le projet |
| `--ui` | `quasar2`, `daisyui` | `daisyui` |
| `--render` | `spa`, `ssr`, `ssg` | `spa` |
| `--adapter` | `koa`, `express` | `koa` |
| `--transport` | `rest`, `both` | `rest` |
| `--dry-run` | aucune écriture | désactivé |
| `--json` | sortie JSON | désactivé |
| `--help`, `--version` | aide ou version | — |

Combinaisons autorisées : Quasar SPA (`rest`, `both`) ; daisyUI SPA (`rest`, `both`) ; daisyUI SSR/SSG (`rest` uniquement).

## Exemples

```powershell
create-feathers-app portail --ui quasar2 --adapter koa --transport both
create-feathers-app catalogue --ui daisyui --render ssg --adapter express
create-feathers-app portail-test --ui daisyui --render ssr --dry-run --json
```

Le planificateur de projet partagé est réutilisé pour la validation des options. Les options de bases de données, d'authentification, de schémas et de PWA restent en phase de conception : elles ne sont pas acceptées par le générateur actuel.


## Options R17-r3 (candidate)

| Option | Valeurs | Portée |
|---|---|---|
| `--ui` | `quasar2`, `daisyui` | Kit UI |
| `--render` | `spa`, `ssr`, `ssg` | Quasar SSG exclu |
| `--schema` | `typebox`, `json`, `zod` | Validation des futurs services |
| `--auth` | `none`, `jwt`, `oauth2`, `oidc`, `keycloak` | Identités externes bloquées sans intégration |
| `--db` | `main:memory,audit:mongodb` | Connexions nommées, externes non activées |
| `service add <name>` | `--schema`, `--db`, `--auth`, `--project`, `--dry-run` | Ajout de service API |

Les options d'authentification et de persistance ne constituent pas une garantie de fonctionnement : les connexions externes nécessitent un paramétrage et des tests dédiés.
