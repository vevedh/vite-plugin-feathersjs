# portail-quasar

Exemple quasar2 SPA + FeathersJS v5. Données de démonstration en mémoire, sans authentification. Ne pas exposer publiquement.

Depuis ce dossier :

```powershell
corepack pnpm install
Copy-Item .env.example .env
$env:FEATHERS_ADAPTER='koa'
$env:FEATHERS_SOCKETIO='1'
# Terminal 1 :
corepack pnpm run dev:api
# Terminal 2 :
corepack pnpm run dev
```

Ouvrir http://127.0.0.1:5173. La production doit exécuter l'API Feathers dans un service indépendant.
