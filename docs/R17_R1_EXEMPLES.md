# R17-r1 — Exemples de rendu avec FeathersJS v5

Cette édition conserve `@vevedh/vite-plugin-feathersjs@0.2.6` et la baseline Quasar SSR R16. Les nouveaux exemples sont regroupés dans [`examples/r17`](../examples/r17/README.md).

## SPA : Quasar 2 ou daisyUI

Le générateur produit une application Vite/Vue 3, un store Pinia, les services Feathers `health` et `notes`, ainsi qu'un backend indépendant. Le projet généré utilise la version npm publiée du plugin. Le générateur refuse un chemin non conforme ou un dossier existant ; `--dry-run` ne crée aucun fichier.

```powershell
node scripts/generate-r17-project.mjs --name mon-portail --ui quasar2 --render spa --adapter koa --transport both --dry-run
node scripts/generate-r17-project.mjs --name mon-portail --ui quasar2 --render spa --adapter koa --transport both
```

## SSR : deux architectures différentes

Quasar 2 SSR utilise **Quasar CLI avec Vite**, avec un serveur compilé et une API Feathers séparée. Cet exemple est déjà certifié dans `examples/quasar-ssr`.

Vue 3 + daisyUI SSR utilise les points d'entrée Vue server/client. Le rendu SSR crée une instance Pinia par requête ; le service `notes` est interrogé **après hydratation** dans cette candidate. Ainsi, les données dynamiques de la démo ne sont pas sérialisées en HTML. Ce nouvel exemple est à certifier sur Windows.

## SSG : pages publiques seulement

L'exemple daisyUI pré-rend `/` et `/about` au build. Le serveur Feathers reste nécessaire pour les actions CRUD une fois la page affichée dans le navigateur. Aucune donnée d'utilisateur ne doit être prérendue.

Quasar SSG nécessite une validation spécifique de la branche Quasar CLI adéquate. La documentation SSG actuelle porte sur `@quasar/app-vite` v3 et signale une API bêta ; notre référence certifiée R16 reste en v2. Le dossier `quasar-ssg` contient donc un blueprint de migration et un garde bloquant, **pas un build SSG déjà certifié**.

## Validation

Le guide [`examples/r17/TESTING_WINDOWS.md`](../examples/r17/TESTING_WINDOWS.md) décrit les commandes de build, le smoke test API et les tests Playwright avec Edge GPU désactivé. La réussite des tests structurels et du gel R16 ne dispense pas de vérifier installations, compilation Vue et E2E des nouveaux exemples.

Les services de démonstration sont sans authentification, stockent les notes en mémoire et ne doivent pas être exposés publiquement.
