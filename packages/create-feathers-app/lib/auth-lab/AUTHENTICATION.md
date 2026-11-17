# Authentification Feathers et sessions durables — laboratoire

Ce profil utilise **Feathers AuthenticationService**, les stratégies **local + JWT**, un registre de sessions durable dans le provider universel et une authentification **obligatoire** sur le service `notes` (REST et Socket.IO).

## Démarrage

Créer les secrets de la base puis de l'authentification, une seule fois :

```powershell
node scripts/create-lab-secret.mjs
node scripts/create-auth-secrets.mjs
corepack pnpm install --lockfile-only
docker compose -f compose.prod.yaml up --build -d
```

Les secrets sont enregistrés sous `secrets/`, exclus de Git et des images Docker. Ne jamais afficher ni communiquer leurs valeurs.

Le compte de laboratoire interne est `lab-admin@example.invalid`. Son mot de passe initial se trouve dans le fichier privé `secrets/admin_password`. Ne pas l'utiliser en dehors de ce laboratoire ni conserver ce compte en production.

## Contrat HTTP

- `POST /api/authentication` avec `{ "strategy":"local", "email":"lab-admin@example.invalid", "password":"<valeur privée>" }` renvoie un JWT de 15 minutes.
- `Authorization: Bearer <JWT>` est obligatoire pour `/api/notes`.
- `POST /api/sessions` avec `{ "operation":"revoke" }` révoque le jeton courant ; `{ "operation":"rotate" }` le consomme et renvoie un nouveau jeton.
- `/api/users` ne propose aucune méthode publique : le service de résolution d'identité reste interne.

Les sessions sont stockées dans la même base que les notes, avec une expiration persistante et une transition atomique de révocation. Après redémarrage de l'API, un JWT non révoqué peut être réutilisé jusqu'à son expiration ; un JWT révoqué doit rester refusé. Le mot de passe hashé n'est jamais renvoyé par l'API.

## Limites

Laboratoire Docker **loopback uniquement**. RBAC multi-rôles, MFA, protections anti-bruteforce multi-instance, renouvellement de clés, HTTPS public, récupération de compte et gestion du cycle de vie des utilisateurs ne sont pas certifiés. Pas de stockage de JWT en localStorage dans la SPA.
