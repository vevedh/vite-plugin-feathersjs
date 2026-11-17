# Versions et distribution npm

**Create Feathers App** est distribué sous le nom `@vevedh/create-feathers-app`. Le package peut proposer deux commandes : `create-feathers-app` et `cfapp`.

## Installer depuis npm

Vérifiez la présence et la version du canal `next` avant toute installation :

```powershell
npm view @vevedh/create-feathers-app dist-tags --json
```

Si le canal `next` existe :

```powershell
npx --yes --package=@vevedh/create-feathers-app@next create-feathers-app --help
npx --yes --package=@vevedh/create-feathers-app@next cfapp --help
```

`npx cfapp` sans `--package` ne garantit pas de sélectionner ce CLI. Pour automatiser une installation, remplacez `@next` par une version précise.

## Vérifier une version

```powershell
npm view @vevedh/create-feathers-app version
npm view @vevedh/create-feathers-app bin --json
```

L’existence de ces commandes dans la documentation ne signifie pas que cette version est déjà disponible sur le registre. Consultez le résultat de `npm view` avant de l'utiliser.

## Contenu du paquet

Le paquet distribuable comprend le binaire, les outils nécessaires à la génération et les modèles. Son ensemble de modèles est plafonné par le contrat de distribution à **200 fichiers et 2 MiB** ; les dépendances locales ne doivent pas être incluses. Cette limite concerne le paquet de génération, pas le projet créé.

Pour une installation locale, consultez le [guide de démarrage](/guide/installation). Pour la documentation du plugin, consultez son site officiel dès sa mise en ligne.
