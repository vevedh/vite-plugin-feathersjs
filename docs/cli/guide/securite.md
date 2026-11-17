# Sécurité et déploiement

Les modèles fournissent des exemples utiles au développement. Ils ne constituent pas une configuration de production prête à exposer sur Internet.

## Avant la mise en ligne

- Définissez une stratégie d'authentification adaptée aux utilisateurs et à l'infrastructure.
- Vérifiez les autorisations **côté FeathersJS** pour chaque méthode et chaque transport utilisé.
- Validez les données entrantes sur le serveur, y compris les filtres de recherche et les paramètres Socket.IO.
- Ne placez aucun mot de passe, jeton, clé ou secret dans des variables `VITE_` ou dans le dépôt Git.
- Utilisez HTTPS, des origines explicitement autorisées, des journaux sobres en données personnelles et une politique de conservation documentée.
- Vérifiez les dépendances, les images Docker et les sauvegardes avant exploitation.

Les options liées aux bases de données, au cache et au stockage objet peuvent générer des **configurations de départ** : leur présence ne signifie pas que les intégrations correspondantes sont déployées ou certifiées.
