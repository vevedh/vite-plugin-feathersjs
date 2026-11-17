# Référence des commandes

Les commandes principales sont `create-feathers-app` et son alias `cfapp`.

```powershell
npm exec --yes --package=@vevedh/create-feathers-app@next -- create-feathers-app --help
```

| Option | Fonction |
| --- | --- |
| `--ui quasar2` / `--ui daisyui` | Choix de l'interface |
| `--render spa|ssr|ssg` | Mode de rendu selon le modèle |
| `--adapter koa` / `--adapter express` | Adaptateur FeathersJS |
| `--transport rest` / `--transport both` | Transport REST ou REST et Socket.IO selon le profil |
| `--schema typebox|json|zod` | Modèle de schéma de service |
| `--pwa on` / `--pwa off` | Coque PWA en mode SPA |
| `--compose off|dev|prod|both` | Préparation Docker Compose selon le profil |
| `--dry-run --json` | Prévisualisation structurée sans écriture |
| `--version` | Affiche la version du CLI |

Pour découvrir les autres profils :

```powershell
npm exec --yes --package=@vevedh/create-feathers-app@next -- create-feathers-app --help
```

Le générateur dispose également d'une commande de création de service : `create-feathers-app service add <nom>`. Examinez le schéma et les politiques d'autorisation générés avant d'y exposer des données.
