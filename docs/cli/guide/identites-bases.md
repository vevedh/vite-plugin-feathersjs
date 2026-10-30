# Identités, schémas et bases de données

Le CLI accepte des **profils** sans inventer une connexion externe ou une session authentifiée :

```powershell
create-feathers-app mon-projet --ui daisyui --render ssr --schema zod --auth keycloak --db main:postgresql,audit:mongodb
```

Les fichiers `api/config/profile.json` et `api/config/capabilities.mjs` documentent les connexions nommées et bloquent le lancement tant que l'intégration n'a pas été configurée. **Aucune API non protégée n'est activée à la place d'un fournisseur indisponible.**

| Option | État R17-r3 |
|---|---|
| `--auth none` | Laboratoire en mémoire opérationnel |
| `--auth jwt` | Profil d'intégration, non activé automatiquement |
| `--auth oauth2` | Profil fournisseur OAuth2, flux externe à configurer |
| `--auth oidc`, `--auth keycloak` | Profils OIDC ; PKCE, JWKS, audience, issuer, mapping des rôles à certifier |
| `--db main:memory` | Service en mémoire opérationnel |
| `--db NOM:mongodb` | Profil MongoDB ; client et identifiants à configurer |
| `--db NOM:postgresql` (ou `mariadb`, `mysql`, `sqlite`) | Profil Knex ; pilote, migrations et connexions à configurer |
| `--schema typebox`, `--schema json` ou `--schema zod` | Modèle de validation générable pour les nouveaux services |

Dans les exemples, `NOM` désigne un nom de connexion que vous choisissez, par exemple `main`. Les options de schéma et de base se choisissent individuellement ; les profils externes ne créent aucune connexion opérationnelle.

Ne mettez jamais les secrets JWT, chaînes de connexion, clés privées ou secrets OAuth dans `.env.example`, VitePress ou Git. Utilisez un magasin de secrets externe et des politiques de rôles explicites. La protection des services ne se limite pas à la vérification d'identité.

Pour un déploiement public, validez séparément les sessions, la rotation des clés, les contrôles d'accès, CSRF/CORS, la journalisation et les droits sur chaque service.
