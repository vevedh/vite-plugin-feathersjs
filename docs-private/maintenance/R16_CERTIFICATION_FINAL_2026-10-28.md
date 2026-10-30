# R16 — Bilan de certification définitif (Windows, 28 octobre 2026)

**Statut : CERTIFIÉ — périmètre de démonstration Quasar 2 SSR + FeathersJS v5, local uniquement.**

Ce rapport s'appuie sur les sorties PowerShell transmises par le mainteneur le 28 octobre 2026. Il ne constitue pas une exécution indépendante des E2E dans l'environnement de préparation de l'archive.

## Baseline publiée et environnement

- npm : `@vevedh/vite-plugin-feathersjs@0.2.6` (version immuable, téléchargée depuis le registre dans un répertoire temporaire indépendant). `npm view ... version` retourne `0.2.6` ; intégrité SHA-512 documentée dans `r16-freeze-manifest.json` ; `npm audit signatures` : **225 signatures de registre** et **28 attestations** vérifiées par npm.
- Racine plugin : `npm run typecheck`, **22/22 tests unitaires**, **10/10 tests d'intégration**, `npm run build`, préparation du paquet scoped et `npm pack --dry-run` : **PASS**. `npm run audit:runtime` : **0 vulnérabilité signalée au moment du test**.
- Environnement : Windows 11, Node.js **22.23.4**, pnpm **10.30.2**, Vue 3.5.44, Quasar UI **2.35.2**, `@quasar/app-vite` **2.6.2**, Vite **7.3.7**, Playwright **1.64.1**, Microsoft Edge stable avec `--disable-gpu` et Native Window Occlusion désactivée. Vidéos E2E désactivées par défaut ; traces et captures conservées.
- Archive code : `vite-plugin-feathersjs-0.2.6-r16-r6-r3-quasar-ssr-hydration-qinput.zip`. L'exemple utilise toujours `0.16.6-r2-candidate` comme version *interne* dans `package.json` et dans la console des tests, distincte du nom de l'archive R16-r6-r3 et du package npm. Cette différence de libellé n'est pas une différence fonctionnelle.

## Matrice de qualification réelle

| Porte | Contrôle | Koa | Express |
|---|---|---|---|
| R16 — Contrats | `check:browser:contracts` (8/8) et `check:contracts` (35/35), communs | PASS | PASS |
| G2 Dev REST | HTML SSR préchargé, API CRUD sans secret dans le HTML | PASS | PASS |
| G3 Dev navigateur REST | Edge `-Stage Dev -Browser` : 4 PASS, 1 SKIP Socket car désactivé | PASS | PASS |
| G3 Dev navigateur realtime | Edge `-Stage Dev -Socket -Browser` : **5/5 PASS** | PASS | PASS |
| G4 Build SSR | `VITE_FEATHERS_REALTIME=1`, `quasar build -m ssr`, sortie compilée | PASS | PASS |
| G4 Dépendances | `PREPARE_R16_PRODUCTION.ps1` et `check:production-deps`, **17 dépendances** | PASS | PASS |
| G4b Production HTTP | HTML SSR préchargé, CRUD API, absence de credentials HTML | PASS | PASS |
| G4b Production realtime | Socket.IO deux clients directs via proxy loopback | PASS | PASS |
| G4b Production navigateur | Edge `-Stage Production -Socket -Browser` : **5/5 PASS** | PASS | PASS |

Les 5 scénarios E2E couvrent : SSR + hydratation Pinia sans avertissement, CRUD UI + navigation, deux contextes Edge indépendants, événement Socket.IO transmis à un second navigateur sans rechargement, et responsive 390/1280 px sans débordement ni erreur console détectée. Soit **10/10 Playwright en production** et **10/10 en développement avec Socket.IO**, sans confondre les tests REST où le scénario temps réel était intentionnellement ignoré.

## Corrections constitutives de la baseline

- Liaison des méthodes Feathers `NotesService` à l'instance qui porte les champs privés natifs.
- Socket.IO dédié lié au loopback (`127.0.0.1`), configuration typée stricte (`exactOptionalPropertyTypes`).
- Lifecycle SSR Quasar CLI v2, paquet compilé et préparation de dépendances de production.
- Sélecteur Playwright QInput fondé sur rôle et nom accessible, et non sur le détail de son DOM interne.
- Frontière `QNoSsr` limitée à `QInput` pour éliminer le mismatch `caret-color`; les notes restent rendues et préchargées sur le serveur. Les assertions Vue/hydratation ne sont pas neutralisées.
- Playwright Edge GPU disabled ; vidéo facultative, préflight FFmpeg si activée.

## Limites de la certification — importantes

- **Pas d'authentification, de gestion des droits ni d'isolation de données utilisateurs** : les deux contextes ont des stockages indépendants mais accèdent à la même API de démonstration.
- Le canal Socket.IO de notes (`local-demo`) est volontairement sans ACL : ne pas exposer cette maquette sur un réseau public.
- Pas de base de données persistante ni de test transactionnel ; service de notes en mémoire.
- Le reverse proxy de laboratoire est lié au loopback. Une exposition publique imposerait un reverse proxy TLS, une authentification, un contrôle d'origine et un WAF selon l'architecture.
- La certification concerne le **moteur SSR de Quasar CLI v2**, pas les modes SPA, SSG, PWA ni une compatibilité avec Quasar CLI v3.
- Le bundle SSR compilé contient la fonction realtime car `VITE_FEATHERS_REALTIME=1` était défini lors du build ; la simple modification de la variable après build n'active pas Socket.IO dans le client.
- Les mesures de performance, l'absence de fuite inter-utilisateurs, le stockage persistant, les sauvegardes et la sécurité de production ne sont **pas certifiés**.

## Décision de release

**R16 clôturée sur la baseline d'exemple certifiée.** Aucun changement du contenu du package npm 0.2.6. Le prochain changement fonctionnel publié doit utiliser une nouvelle version ; préserver la chaîne de certification R16 et les sources figées via le contrôle SHA-256 de `r16-freeze-manifest.json`.

Commandes finales de référence (déjà exécutées et validées sur Windows) :

```powershell
Set-Location C:\devsite-plugin-feathersjs\examples\quasar-ssr
$env:VITE_FEATHERS_REALTIME = '1'
corepack pnpm run build:ssr
.\scripts\PREPARE_R16_PRODUCTION.ps1
corepack pnpm run check:production-deps
.\scripts\CERTIFY_R16_WINDOWS.ps1 -Stage Production -Adapter koa -Socket -Browser
.\scripts\CERTIFY_R16_WINDOWS.ps1 -Stage Production -Adapter express -Socket -Browser
Remove-Item Env:VITE_FEATHERS_REALTIME -ErrorAction SilentlyContinue
```
