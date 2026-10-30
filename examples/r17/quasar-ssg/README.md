# Quasar 2 SSG — Exemple de contrat et migration (bloqué)

Ce cas représente le rendu SSG pour Quasar 2. **La baseline `@quasar/app-vite` v2.6.2 de R16 ne dispose pas d'une certification SSG.** Les guides officiels SSG récents ciblent `@quasar/app-vite` v3 et indiquent un mode encore bêta. Ce dossier inclut un exemple de renderer *pour la v3*, mais **ne constitue ni un projet Quasar CLI v2 autonome, ni un build certifié**.

`node scripts/check-compat.mjs` refuse de lancer une génération si la version de Quasar CLI n'est pas une v3 explicitement testée. Aucune mise à niveau automatique.

Lorsque la compatibilité v3 aura été validée sur une branche séparée :

1. Créer une application Quasar CLI v3 sans remplacer `examples/quasar-ssr`.
2. Exécuter `quasar mode add ssg --filename-based-routing` ou conserver un routeur manuel ; inspecter les fichiers générés.
3. Adapter `src-ssg/ssg-renderer.ts` à la signature officielle exacte de la version sélectionnée.
4. Rendre seulement les pages publiques sans chargement des notes ou des sessions à la compilation.
5. Tester `quasar build -m ssg`, HTML pré-rendu, hydratation Edge et appel à l'API Feathers distincte.

Docs : https://quasar.dev/quasar-cli-vite/developing-ssg/introduction/
