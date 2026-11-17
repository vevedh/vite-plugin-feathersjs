# Démarrer en quelques étapes

Ce tutoriel vous accompagne depuis le dossier téléchargé jusqu'à votre première page qui communique avec FeathersJS. Vous n'avez pas besoin de connaître les serveurs ou les réseaux.

## Avant de commencer

Préparez un ordinateur Windows, un terminal PowerShell, **Node.js compatible avec le projet** et pnpm via Corepack. Le dossier `examples/basic` utilise une version de Node répondant à `^22.22.2 || ^24.15.0 || >=26.0.0` : vérifiez votre version avant de continuer.

Ouvrez PowerShell, puis contrôlez Node et Corepack :

```powershell
node --version
corepack --version
```

Si votre version de Node ne correspond pas aux exigences de l'exemple, mettez-la à jour avant d'installer les dépendances.

## 1. Ouvrir le projet

Décompressez l'archive dans `C:\devs`. Le dossier de travail doit ensuite s'appeler `vite-plugin-feathersjs-vitesse-docs-r2`.

```powershell
Set-Location "."
```

## 2. Préparer le plugin

Le plugin et le site de démonstration partagent ce dépôt. Compilez d'abord le plugin une seule fois :

```powershell
npm install
npm run build
```

## 3. Démarrer l'exemple Vitesse

Entrez dans le dossier `examples/basic`, installez ses dépendances et lancez le serveur de développement :

```powershell
Set-Location "examples/basic"
corepack pnpm install --frozen-lockfile
corepack pnpm run dev
```

::: info Installation sur Windows
Le projet propose aussi `scripts/INSTALL_FAST.ps1` dans `examples/basic` pour préparer l'environnement de démonstration. Si l'installation standard échoue, consultez la page [Résoudre les problèmes courants](/guide/depannage).
:::

## 4. Ouvrir la démonstration

Dans votre navigateur, rendez-vous sur **[localhost:3333/feathers](http://localhost:3333/feathers)**. La page doit afficher l'état du service et les notes de démonstration. Une deuxième fenêtre permet de constater les mises à jour en direct quand Socket.IO est actif.

Vite ouvre d'abord le site, puis le plugin prépare Feathers automatiquement. Si vous ouvrez la page immédiatement, l'API peut répondre brièvement `503` : cela veut simplement dire « le service démarre ». Lorsque le terminal affiche `vite-plugin-feathersjs ... ready`, actualisez la page. Vous n'avez pas besoin d'ouvrir une seconde commande pour Feathers.

<figure>
  <img src="/illustrations/parcours.svg" alt="Schéma des étapes : ordinateur, Vitesse, service Feathers et navigateur" />
  <figcaption>Le navigateur affiche des informations fournies par un service exécuté sur votre ordinateur.</figcaption>
</figure>

## 5. Vérifier que tout fonctionne

Dans un second terminal, contrôlez l'exemple sans fermer le serveur :

```powershell
Set-Location "examples/basic"
corepack pnpm run test:feathers:contract
corepack pnpm run test:feathers:realtime-contract
```

Ces commandes vérifient la configuration prévue. Le dernier contrôle reste le fonctionnement réel dans votre navigateur.

## Prochaine étape

Poursuivez avec [Vos premières notes](/guide/premieres-notes) pour comprendre ce qui relie l'écran aux données.
