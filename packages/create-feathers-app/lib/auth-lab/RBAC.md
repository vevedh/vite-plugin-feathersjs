# Contrôle des accès RBAC — laboratoire

Le service `notes` est protégé par `authenticate('jwt')` puis par une politique côté serveur.
La politique relit le rôle depuis la base active et vérifie la session durable.
Un rôle fourni dans le JWT, les paramètres Socket.IO ou la requête est ignoré.

| Rôle | Lecture `find/get` | Création `create` | Modification `patch` | Remplacement / suppression |
| --- | --- | --- | --- | --- |
| viewer | Oui | Non | Non | Non |
| editor | Oui | Oui | Oui | Non |
| admin | Oui | Oui | Oui | Oui |

Le service `health` demeure public. Les services `users` sont internes et `sessions` applique déjà une vérification JWT durable.
La connexion via Socket.IO n'est **pas encore certifiée en E2E** : les tests couvrent la politique et le générateur, pas le réseau réel.

Limites : laboratoire local ; aucune isolation multitenant ni ACL par enregistrement. La politique n'autorise pas l'exposition Internet sans audit et tests supplémentaires.
