# Découvrir Quasar 2 SSR

Quasar 2 permet de construire une interface Vue avec des composants prêts à l'emploi. L'exemple SSR montre comment préparer un rendu initial côté serveur, puis rendre la page interactive dans le navigateur.

## À quoi sert SSR ?

Le serveur peut préparer le contenu de la première page avant de l'envoyer au navigateur. Le navigateur prend ensuite la main pour les interactions.

L'exemple du dépôt se trouve dans **`examples/quasar-ssr`**. Il contient une application Quasar et un serveur Feathers pour son API. Les deux parties restent distinctes lors du déploiement.

## Les commandes principales

Avant de commencer, compilez le plugin à la racine. Ensuite, ouvrez le dossier Quasar :

```powershell
Set-Location "."
npm run build
Set-Location "examples/quasar-ssr"
corepack pnpm install
corepack pnpm run dev:ssr
```

Le fichier `examples/quasar-ssr/README.md` décrit les préparatifs propres à son environnement et les commandes de validation complémentaires.

::: info À retenir
Ce parcours est plus avancé que le tutoriel Vitesse. Commencez par [Vitesse](/guide/demarrage) si vous découvrez les services Feathers.
:::
