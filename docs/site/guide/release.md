# Vérifier le plugin avant une mise à jour

Le plugin s’utilise avec FeathersJS v5 et Vite. La version 0.3.0 ajoute les contrats publics de transport et de contrôle des événements Keycloak. L’authentification reste configurée côté serveur : utilisez un issuer HTTPS, une audience dédiée à l’API et une source fiable pour les rôles. Le filtre d’événements ne couvre pas les émissions Socket.IO brutes.

Pour développer ou vérifier le plugin, utilisez Node.js 22 et npm. Dans un nouveau dossier de travail :

```sh
npm ci --ignore-scripts
npm run check:release
npm run check:security
```

Le contrôle lance les tests TypeScript, les contrats Node, la compilation et une simulation de packaging. Les tests OIDC utilisent des clés de test et un serveur JWKS local ; ils ne remplacent pas une validation avec un serveur Keycloak réel.

Le dossier source est privé au sens npm : il ne peut pas être publié directement. Le dossier de distribution `.release/npm` est créé une seule fois. Pour refaire une qualification, utilisez un nouveau dossier de travail. La publication du paquet reste une opération indépendante.
