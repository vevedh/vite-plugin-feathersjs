# Les services FeathersJS

Un projet généré contient deux services de démonstration : `health` pour vérifier la disponibilité et `notes` pour créer, lire et supprimer des notes.

![Du navigateur aux services FeathersJS](/diagrams/architecture.svg)

```powershell
Invoke-RestMethod http://127.0.0.1:3030/api/health
Invoke-RestMethod http://127.0.0.1:3030/api/notes
```

Les services sont enregistrés côté serveur avec FeathersJS v5. Vite ne remplace pas l'API en production. Le proxy de développement `/api` achemine simplement les requêtes vers le serveur Feathers local.

Le service `notes` est en mémoire et accessible sans authentification. Il sert uniquement aux tests de démarrage, d'intégration et de transport.
