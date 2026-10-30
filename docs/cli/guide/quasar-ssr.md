# Quasar 2 SSR

Le modèle Quasar 2 SSR est issu du laboratoire R16, adapté pour utiliser le plugin npm public. Il repose sur `@quasar/app-vite` **2.6.2**, Vue 3, Pinia par requête et une API Feathers dédiée.

La version `0.1.0-rc.2` est encore candidate. Les commandes npm ci-dessous ne fonctionneront qu’après sa publication. Pour la certification, utilisez le CLI de l’archive R17-r3.

```powershell
npm exec --yes --package=@vevedh/create-feathers-app@0.1.0-rc.2 -- create-feathers-app mon-quasar --ui quasar2 --render ssr
cd mon-quasar
corepack pnpm install
corepack pnpm run dev:all
```

Ouvrir `http://127.0.0.1:8080` : le reverse proxy local oriente `/api` vers Feathers sur 3030, `/socket.io` vers 3031 et les pages SSR vers Quasar sur 9100. Les trois processus sont **locaux** et ne doivent pas être exposés sur Internet sans authentification, terminaison TLS et reverse proxy durci.

Le préchargement SSR reste limité aux notes de démonstration ; ne sérialisez jamais un jeton ou un secret dans le HTML. Le modèle généré doit être certifié sur Windows avant publication de la version stable.

## Certification HTTP et Microsoft Edge

Dans l'archive de développement R17, une certification dédiée vérifie le **Quasar SSR réellement généré**, sans modifier les fichiers figés R16. Elle démarre Feathers (3030), Quasar SSR (9100) et le proxy local (8080). Les ports doivent être libres pour éviter de tester un processus étranger.

```powershell
Set-Location C:\devs\vite-plugin-feathersjs
# Préparer les dépendances des tests Playwright, si nécessaire
Set-Location examples\quasar-ssr
corepack pnpm install
Set-Location C:\devs\vite-plugin-feathersjs
.\scripts\r17\certify-quasar-ssr-generated-windows.ps1 -Adapter both
```

Le test HTTP contrôle le type `application/json` de `/api/health`, les opérations CRUD sur `notes`, la validation du service `tickets`, et la présence de la note dans le HTML rendu **avant** l'exécution du navigateur. Playwright Edge vérifie ensuite l'hydratation, le formulaire Quasar, la persistance après rechargement et l'affichage à 390 px et 1280 px. Une console Vue présentant un avertissement d'hydratation est un **échec**. Les journaux techniques sont conservés localement et ne sont jamais publiés sur le site de documentation.

**Limite :** ces tests sont à exécuter sur Windows pour confirmer la compatibilité réelle avec Microsoft Edge ; un build TypeScript seul ne vaut pas certification navigateur.
