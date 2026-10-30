# R16 — Design des exemples Vite et Quasar SSR

Cette évolution met à jour la présentation des exemples en conservant les contrats de services, le routage et les scénarios de certification existants.

## Exemples

- `examples/basic` : accueil avec parcours de prise en main, schéma de circulation des données et accès direct au service Notes ; interface d'administration pour afficher le statut réel de l'API, les événements et les enregistrements.
- `examples/quasar-ssr` : console responsive avec navigation latérale, indicateurs issus du service, création de notes, explication de l'architecture SSR et page 404 dédiée.

Les données affichées proviennent des stores et des services. Les indicateurs de santé sont actualisés par une requête à `/api/health` et ne sont pas simulés.

## Accessibilité et performances

- Hiérarchie des titres, libellés explicites, messages d'erreur et d'absence de données.
- Styles adaptatifs aux écrans mobiles et navigation clavier avec focus visible.
- Préférence `prefers-reduced-motion` respectée.
- Typographie système, aucun ajout de bibliothèque CSS/JS et aucune ressource distante indispensable au rendu.
- Le rendu Quasar SSR précharge les notes dans l'instance Pinia de la requête ; Socket.IO démarre uniquement dans le navigateur.

## Validation

Pour Vitesse :

```powershell
Set-Location examples/basic
corepack pnpm run test:feathers:r16-design
corepack pnpm run typecheck
corepack pnpm run check:basic:release
```

Pour Quasar SSR :

```powershell
Set-Location examples/quasar-ssr
corepack pnpm run check:contracts
corepack pnpm exec quasar prepare
corepack pnpm run build:ssr
```

Les tests statiques ne prouvent pas la réussite du rendu navigateur. Vérifier également les tailles 390 px et 1280 px, la console Edge, l'hydratation et le fonctionnement des deux clients Socket.IO selon la procédure r16.

Les interfaces utilisent une composition visuelle originale : aucun code ni asset provenant de modèles commerciaux n'est inclus.
