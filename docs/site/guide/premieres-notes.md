# Vos premières notes

L'exemple **Notes** sert à comprendre une application complète à l'aide d'une petite liste. Vous pouvez ajouter un élément, le modifier et le retrouver à l'écran.

## Une donnée passe par trois étapes

Quand vous validez une note, le navigateur envoie une demande au **service notes**. Ce service s'occupe de la donnée puis renvoie le résultat à la page.

![Schéma : le navigateur parle au service notes, qui renvoie une réponse](/illustrations/parcours.svg)

Dans `examples/basic`, rendez-vous sur `http://localhost:3333/feathers` puis essayez de créer, modifier et supprimer une note. Vous pouvez ouvrir deux onglets pour observer les événements en direct quand Socket.IO est activé.

## REST et temps réel, simplement

**REST** sert à demander ou modifier des données : afficher une liste ou enregistrer une note. **Socket.IO**, lorsqu'il est activé, sert à signaler qu'un changement a eu lieu, sans avoir à actualiser la page.

Ce sont deux façons complémentaires de communiquer avec un service. Vous n'avez pas besoin de maîtriser leur fonctionnement interne pour suivre le tutoriel.

::: warning Démonstration locale uniquement
Les notes de cet exemple ne disposent pas de comptes utilisateurs ni de permissions de production. Évitez d'y saisir des renseignements personnels ou confidentiels.
:::

## Et après ?

Découvrez [les exemples disponibles](/guide/exemples) et leurs usages, ou consultez le [lexique](/reference/lexique).
