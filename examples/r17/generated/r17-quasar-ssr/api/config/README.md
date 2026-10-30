# Configuration des capacités

Profil sélectionné : schéma typebox, identité none, connexions main:memory.

Les services en mémoire et sans authentification sont destinés au laboratoire local. Les bases externes nécessitent une instance réelle, un client Feathers/Knex ou MongoDB, ses migrations et la vérification de son cycle de vie.

L'authentification JWT exige un service utilisateurs, un secret hors Git, une stratégie JWT active, des contrôles d'accès et des tests. OAuth2, OIDC et Keycloak exigent en plus un fournisseur HTTPS, la vérification de l'issuer, audience, JWKS, PKCE et le mapping des identités. Ne pas exposer l'API avant validation.

La commande `service add tickets --schema zod --db main` crée un service et l'enregistre dans l'API.
