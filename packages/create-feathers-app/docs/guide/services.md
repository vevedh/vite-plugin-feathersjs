# Créer un service FeathersJS

Cette commande utilise le canal `next` seulement lorsqu’il existe dans le registre npm. Vérifiez les dist-tags avant de l’exécuter.

Après la génération d'un projet, ouvrez son dossier et ajoutez un service (commande disponible après publication npm) :

```powershell
npx --yes --package=@vevedh/create-feathers-app@next cfapp service add tickets --schema typebox --db main
```

Le nouveau service est ajouté à l'API : `GET /api/tickets`, `POST /api/tickets` et les méthodes classiques `get`, `patch`, `remove`.

`--schema typebox` produit un modèle TypeBox/Ajv ; `json` utilise JSON Schema/Ajv ; `zod` utilise une validation Zod indépendante. Les trois modèles appliquent une validation des données d'entrée. Le service fonctionne en **mémoire, pour laboratoire uniquement**.

Pour cibler un autre dossier : `service add tickets --project ./mon-projet --schema zod --dry-run`.

Un service ne peut pas être écrasé. Le nom doit être en kebab-case, et la cible ne doit contenir aucun lien symbolique. La création ne modifie pas les services `health` et `notes` existants.
