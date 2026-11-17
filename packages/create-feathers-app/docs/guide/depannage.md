# Diagnostiquer les erreurs courantes

## `ECONNREFUSED 127.0.0.1:3030`

Ce diagnostic concerne `--dev-api separate`, SSR et SSG : un serveur API autonome devrait répondre sur `3030`. En SPA avec `--dev-api vite`, utilisez `http://127.0.0.1:5173/api/health`, et non le port `3030`. Vérifiez que `corepack pnpm run dev:all` a démarré dans le dossier du projet généré.

## Port 5173 déjà utilisé

Fermez l'autre serveur Vite. Les tests de certification refusent de continuer si les ports attendus par le profil sont occupés afin de ne pas tester une mauvaise application.

## Playwright absent

Installez les dépendances de l'exemple Quasar SSR dans le dépôt :

```powershell
Set-Location examples/quasar-ssr
corepack pnpm install
corepack pnpm exec playwright --version
```

## Quasar SSG indisponible

Ce mode n'est pas implémenté pour la baseline Quasar CLI 2 retenue dans le dépôt de référence. Le générateur refuse explicitement `--ui quasar2 --render ssg`.

## Un nom de dossier existe déjà

Le CLI ne remplace aucun projet existant, même vide. Choisissez un autre nom, ou déplacez manuellement votre ancien projet après sauvegarde.

## VitePress : « Element is missing end tag »

Si le build de la documentation signale cette erreur dans une page Markdown, vérifiez d’abord les tableaux. Le caractère `|` sépare les colonnes, y compris lorsqu’il se trouve dans un exemple entre accents graves. Préférez un exemple par valeur, comme `--schema typebox`, `--schema json` ou `--schema zod`, au lieu de les réunir dans la même cellule avec des barres verticales.

Relancez le contrôle documentaire puis la compilation avant de publier :

```powershell
node scripts/check-r17-docs.mjs
Set-Location docs/cli
corepack pnpm run build
```

N'envoyez pas la branche GitHub Pages si le build échoue.
