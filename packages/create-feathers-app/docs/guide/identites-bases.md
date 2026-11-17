# Identités et bases de données : état du CLI RC10

Les capacités ne sont pas toutes au même niveau. Le générateur peut créer un **plan**, une **démonstration locale** ou un **laboratoire persistant**, mais aucune de ces sorties n'est une homologation de production.

| Profil | État de la source | Exposition publique |
| --- | --- | --- |
| `--auth none --db main:memory` | Démonstration locale sans authentification | Non |
| `--auth jwt` sans persistance lab | Contrat d'authentification et garde-fou `assertCapabilities()` | Refusé par défaut |
| `--auth jwt --persistence lab --compose prod` | Sessions durables, Feathers JWT/RBAC et migrations générées | Tests réseau et Docker obligatoires |
| `--tenant-mode isolated-lab` | ACL serveur `tenant_id`/`owner_id`, contrôle des rôles et requêtes conditionnelles | Multi-tenant E2E non certifié |
| `--database-mode universal --db main:universal` | Sélection contrôlée parmi PostgreSQL/MariaDB/MongoDB au démarrage | Laboratoire uniquement |
| `--database-mode multi` | Plan de connexions, sans routage universel opérationnel | Non |
| `--auth oauth2`, `oidc`, `keycloak` | Déclaration de profil ; pont OIDC/Keycloak non implémenté | Non |

## Pourquoi certains projets refusent de démarrer

Le fichier généré `api/config/capabilities.mjs` applique `assertCapabilities()`. Les profils sans intégration certifiée sont bloqués par défaut. Il ne faut ni supprimer ce contrôle, ni ouvrir les ports HTTP ou DB pour contourner une erreur de configuration.

## Persistance et Docker Compose

La candidate RC10 génère `compose.dev.yaml` et/ou `compose.prod.yaml` lorsqu'on choisit `--compose`. Avec `--persistence lab`, le profil de laboratoire peut démarrer PostgreSQL, MariaDB ou MongoDB, sous des contraintes strictes. Les ports DB ne sont pas publiés automatiquement sur l'hôte, les secrets restent hors Git et les images doivent être vérifiées.

En mode multi-tenant, `tenant_id` et `owner_id` sont attribués et vérifiés côté serveur. Les filtres clients, identifiants falsifiés et modifications inter-organisations doivent être refusés. Les tests unitaires ne remplacent pas un parcours réel à plusieurs organisations et rôles sur les trois bases.

## Checklist avant exposition réseau

Contrôler la signature et la durée de vie des JWT, la révocation après rotation, le refus par défaut des permissions, l'autorisation dans chaque service, le cloisonnement des données, les canaux Socket.IO, les limites d'entrées, les migrations, les sauvegardes et le retour arrière. Prévoir une vérification RGPD adaptée à la finalité et aux durées de conservation.

Le futur mode distant et Keycloak relève de P6 ; il n'est pas opérationnel dans cette candidate.
