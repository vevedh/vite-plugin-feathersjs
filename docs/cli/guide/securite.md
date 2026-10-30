# Sécurité et déploiement

Les applications créées sont des **laboratoires locaux**, pas des services prêts pour Internet. Ne publiez pas les ports 3030 et 3031 directement.

Avant une mise en production, mettez en place une authentification Feathers côté serveur, des autorisations par service/méthode, un stockage persistant, le chiffrement HTTPS et un proxy avec contrôles d'origine. Ne vous reposez pas uniquement sur le masquage de l'interface.

Pour le SSG, publiez seulement des pages publiques. Ne sauvegardez jamais de jetons, de données personnelles ni de configuration `.env` dans les artefacts HTML.

Les builds frontaux n'ont pas besoin d'accéder aux secrets de l'API. Les connexions SQL, LDAP ou à d'autres services doivent être gérées dans le processus Feathers, pas dans Vite.

Le CLI refuse de modifier un dossier existant et rejette les liens symboliques présents dans la destination. Utilisez les contrôles de version et examinez les fichiers créés avant une mise en service.
