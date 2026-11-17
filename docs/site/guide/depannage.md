# Résoudre les problèmes courants

Cette page donne des vérifications simples, sans modifier les fichiers du projet au hasard.

## La page ne s'ouvre pas

Vérifiez que la commande `pnpm run dev` est encore active, puis ouvrez l'adresse indiquée par Vite dans le terminal. Dans l'exemple Vitesse, le port attendu est `3333`.

## Le service de notes ne répond pas

Vérifiez la compilation du plugin, redémarrez Vite puis ouvrez `http://localhost:3333/api/health`. Si vous voyez `503` avec « Feathers service unavailable », patientez jusqu'au message `ready` dans le terminal puis actualisez la page. Si le message persiste, lisez les erreurs de chargement des services dans ce même terminal : aucune seconde commande de démarrage n'est nécessaire.

## Les notes ne se mettent pas à jour entre onglets

Le direct est optionnel. Vérifiez que Socket.IO est activé et que le port configuré est disponible. Un fonctionnement REST correct ne signifie pas automatiquement que Socket.IO est connecté.

## L'installation échoue sous Windows

Vérifiez la version de Node indiquée dans `examples/basic/package.json`. Réessayez l'installation à partir du dossier de l'exemple, sans supprimer le fichier de verrouillage des dépendances.

## Un écran fonctionne en développement mais pas après publication

Le plugin Vite n'intègre pas automatiquement le serveur Feathers au site compilé. Pour la production, l'API doit fonctionner dans un processus serveur distinct.

## Un message persiste

Notez la commande exécutée, le message d'erreur exact et l'exemple concerné. Ne transmettez jamais vos mots de passe, clés privées ou jetons pour obtenir de l'aide.

[Retour au démarrage](/guide/demarrage).
