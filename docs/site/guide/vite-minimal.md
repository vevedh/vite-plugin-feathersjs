# Comprendre l'exemple Vite minimal

Cet exemple réduit la configuration à l'essentiel. Vite lance le développement de l'interface et le plugin ajoute les services Feathers au même environnement de développement.

## Une seule configuration de départ

Dans `examples/runtime-vite/vite.config.ts`, le plugin figure dans la liste des extensions de Vite :

```ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import feathers from '@vevedh/vite-plugin-feathersjs'

export default defineConfig({
  plugins: [
    vue(),
    feathers({
      serviceFiles: 'server/services/*/*.service.ts',
      adapter: 'koa',
      prefix: '/api',
      socketio: false,
    }),
  ],
})
```

L'extrait simplifie certains réglages de l'exemple réel ; le fichier livré contient notamment une configuration explicite de l'adresse locale et des options contrôlées pour le temps réel.

## Tester l'exemple

Dans PowerShell, ouvrez son dossier, puis lancez-le :

```powershell
Set-Location "examples/runtime-vite"
corepack pnpm install
corepack pnpm run dev
```

L'interface s'ouvre normalement à `http://127.0.0.1:5173`. Le point d'essai `http://127.0.0.1:5173/api/health` permet de vérifier le service lorsque le serveur est lancé.

## Ce qu'il faut retenir

Un **plugin Vite** prépare les services pendant le développement. Pour une application publiée en production, l'API Feathers doit être démarrée dans un processus serveur dédié.

[Retour à la liste des exemples](/guide/exemples)

## Le plugin et le CLI : quelle différence ?

- **`@vevedh/vite-plugin-feathersjs`** : à ajouter à une application Vite existante pour lancer Feathers pendant le développement. L'intégration se fait dans `vite.config.ts`.
- **`@vevedh/create-feathers-app`** : génère un nouveau projet et son API. La distribution npm du CLI est soumise à certification distincte.

Le plugin ne remplace pas, à lui seul, la stratégie d'hébergement de l'API en production.
