# Quasar 2 SSR + FeathersJS v5

Exemple autonome de rendu SSR Quasar 2, Vue 3, Pinia et FeathersJS v5, avec le paquet npm publié `@vevedh/vite-plugin-feathersjs@0.2.7`.

## Développement

Avec Node.js 22+ et pnpm 10 : installer les dépendances, lancer l'API (`pnpm run api`), Quasar (`pnpm run dev:ssr`) et le proxy (`pnpm run edge`) dans des terminaux distincts. Le laboratoire n'écoute que sur 127.0.0.1.

Pour tester Socket.IO, positionner `FEATHERS_SOCKETIO=1` avant le lancement de l'API, et `VITE_FEATHERS_REALTIME=1` **avant** le lancement ou la compilation Quasar. Les tests Microsoft Edge utilisent `R16_BROWSER_SOCKET=1` uniquement pour demander le scénario temps réel : cette variable n'active pas le frontend.

## Certification

Vérifier le préflight, `vue-tsc --noEmit`, les contrats Node, le build SSR, Express/Koa REST et Socket.IO puis les cinq tests Playwright Edge. Le build SSR de production requiert des dépendances installées dans `dist/ssr`. Les rapports et captures restent locaux, hors Git.

## Production SSR

Après compilation, le kit R12-R2B-R4 conserve une empreinte du manifeste et du lockfile de déploiement. Le script `scripts/verify-production-lock.mjs` effectue l'installation figée et hors scripts dans `dist/ssr` en mode `--install`, puis confirme les dépendances requises. Un nouveau build peut changer le manifeste : revérifier le lockfile avant chaque déploiement.
