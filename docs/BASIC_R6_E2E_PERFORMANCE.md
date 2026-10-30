# Basic r6 — quatre modes E2E et performance

## Baseline
Basic r5 : 27/27 tests sous Windows ; deux modes REST et deux modes REST + Socket.IO validés manuellement. Aucun résultat r6 n’est présumé.

## Certification
Dans `examples/basic`, exécuter `corepack pnpm run check:basic:release`. Ce script valide les contrats, `vue-tsc` et quatre démarrages isolés de Vite avec ports 34330 à 34337. Modifier `FEATHERS_E2E_PORT` si nécessaire. Chaque instance lance les vrais services via Vite, teste health et CRUD, et vérifie dans les modes Socket.IO que deux clients communiquent et qu’un événement `created` est reçu une fois.

Le rapport JSON de durée est écrit dans `docs-private/basic-r6-results.json` et ignoré par Git. Le processus enfant est arrêté même en cas d’échec. Sur Windows, `taskkill /T /F` cible uniquement l’arbre du PID créé par ce script. Aucune fermeture de processus externe ni suppression de fichiers utilisateurs.

## Performance
Le test mesure le temps jusqu’à la disponibilité HTTP du service ; cela inclut le démarrage Vite et Feathers mais ne remplace pas un profilage des plugins Vite. Mesurer plusieurs runs à chaud et à froid avant toute conclusion. Il utilise le CLI Vite directement afin de réduire le coût des wrappers pnpm.

## Limites
Le test ne certifie pas encore la mise à jour HMR d’un module existant ni la continuité d’une session pendant un rechargement. La suppression des données reste volontairement volatile. Le plugin principal reste en 0.2.6. À exécuter avec les dépendances Windows déjà installées. Si une ouverture de port échoue, examiner le rapport et l’occupation réelle des ports avant de relancer.
