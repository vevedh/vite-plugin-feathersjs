# Installer et utiliser le CLI

Le package `@vevedh/create-feathers-app` permet de créer un projet Vue 3 et FeathersJS v5. La préversion `0.1.0-rc.10` est publiée sous le tag npm `next`.

## Vérifier la version

```powershell
npm view '@vevedh/create-feathers-app' dist-tags --json
npm exec --yes --package=@vevedh/create-feathers-app@next -- create-feathers-app --version
```

## Créer un projet

Depuis le dossier qui doit contenir votre nouvelle application :

```powershell
npm exec --yes --package=@vevedh/create-feathers-app@next -- create-feathers-app portail-demo --ui daisyui --render spa --adapter express
```

Le dossier de destination doit être libre. Pour examiner les fichiers prévus sans rien écrire :

```powershell
npm exec --yes --package=@vevedh/create-feathers-app@next -- create-feathers-app portail-demo --ui daisyui --render spa --dry-run --json
```

La commande courte `cfapp` est également fournie par le package après installation. Consultez le `README.md` généré pour les commandes d'installation et de démarrage adaptées au modèle choisi.

> Les projets générés sont des bases de développement. Avant une exposition Internet, configurez notamment l'authentification, les autorisations, la persistance et les politiques d'accès réseau.
