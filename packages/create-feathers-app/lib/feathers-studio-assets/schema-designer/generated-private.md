# R14-S5-R6 — Contrat d'intégration technique

## Baselines vérifiées et périmètre

Source de référence : `r14-s5-r6-handoff.zip`, issue des laboratoires Windows `r14-s2-r3-portal` et `r14-s5-r5-services-lab`. Les empreintes exactes des modules R5 sont épinglées dans `apply.mjs`.

Périmètre : Vue 3, Vite 7, Vue DevTools v8, Feathers v5 Express, `--devtools feathers` actif. Modifications ciblées du CLI `@vevedh/create-feathers-app@0.1.0-rc.10`, du laboratoire généré et de deux documents. **Aucune modification du service Feathers, des schémas ou de leurs `contract.json`.**

## Projection contrôlée du catalogue

Source unique : `GET /__feathers-studio/catalog`. Le middleware R5 relit les contrats canoniques du disque, vérifie les empreintes SHA-256 des modules sources et renvoie uniquement la vue publique `READ_ONLY`.

Le module `studio-bridge.ts` applique une seconde validation stricte (clés exactes, limites, valeurs `sourceVerified === true`, méthodes attendues, empreinte canonique, routes canoniques, absence de doublons). Il projette ensuite les services supportés vers le `DesignerCatalog` R14-S4, puis réutilise **sans modification** `model.ts` et `draft-import.ts` du Designer transmis.

- Les moteurs `zod`, `json` et `typebox` avec `docs: off|vitepress` sont admis.
- Le moteur `manual` est exclu du canvas et reste disponible en consultation dans DevTools.
- Les noms non supportés par le parseur R14-S4 déclenchent un refus explicite, jamais une normalisation silencieuse.
- Une empreinte SHA-256 atteste de la correspondance des octets des sources ; elle ne remplace ni l'audit de validation, ni la politique RBAC.

## Limites du brouillon

Le Designer exporte le format `feathers-schema-designer-draft`, version 2, `executable: false`, avec `sourceSha256` épinglé aux contrats vus au chargement. L'import vérifie les empreintes contre le catalogue actif et refuse toute dérive, toute clé inattendue ou tout fichier supérieur à 64 Kio. Les fonctions de diff sont `compareDraft()` et `exportDraft()` de R14-S4 ; **elles sont non exécutables**.

L'ancien mécanisme d'approbation R14-S4 n'est pas relié à ce nouveau projet. Le plan R14-S4 correspond à des chemins TypeScript et à un registre différent (`assets/categories/tickets`). La conformité fonctionnelle du pont n'implique donc aucune compatibilité d'application automatique. La future intégration d'application exigera un nouveau CLI local certifié.

## Sécurité HTTP et build

`/schema-designer.html` n'est servi par le plugin `feathersStudioCatalog()` que lorsque `npm run dev:studio` active le middleware `apply: serve`. La requête exige un hôte loopback, une origine cohérente, `GET|HEAD` et des en-têtes `no-store`, `nosniff`, `no-referrer`. CSP limitée à la page de développement, avec exception `style-src 'unsafe-inline'` nécessaire aux injections CSS/HMR de Vite (non utilisée en production).

Le fichier HTML de la page n'existe pas dans la racine Vite ; il est transformé en mémoire par `server.transformIndexHtml()` et n'est pas inclus dans les entrées de `vite build`. Le bundle de production ne doit contenir ni `schema-designer` ni les signatures de Feathers Studio. Vérifier séparément `vite preview` et le serveur de production réel.

Aucune route POST de migration, aucun service Feathers d'écriture nouveau, aucun secret, aucun endpoint distant. Les champs sont rendus avec les interpolations Vue et `textContent` exclusivement.

## Qualification Windows 11

1. `npm run verify` dans le kit. Inspecter les cas d'attaque, la syntaxe JavaScript, le parsing TypeScript et l'intégrité SHA-256.
2. Préflight `node apply.mjs --root ... --project ... --check` : confirmer exactement les fichiers annoncés.
3. Application, second préflight `pending: 0` et `npm pack --dry-run --json` du CLI : vérifier l'inclusion des nouveaux fichiers.
4. Arrêter Vite avant `npm ci`, pour éviter le verrou de `lightningcss-win32-x64-msvc.node`; relancer `npm run typecheck` et `npm run build` sur le laboratoire.
5. `npm run dev:studio` sur 127.0.0.1:5173, tester GET et HEAD `/schema-designer.html`, POST 405, origine externe 403. Tester le catalogue à deux services.
6. Sous Edge, sélectionner `tickets`, activer « Préparer un brouillon », ajouter un champ facultatif, comparer et exporter le JSON ; recharger la page et vérifier que `/api/tickets` n'a pas changé.
7. Vérifier que `notes` désactive le bouton, et qu'aucune option UI ne permet un apply.
8. Sous `vite preview --port 4173`, comparer les réponses des routes Studio au repli SPA ; rechercher les signatures Studio dans `dist`.
9. Conserver les reçus dans `.ai/patch-memory/R14-S5-R6`, exclus Git ; publication npm et déploiement restent BLOCKED jusqu'aux gates complets.

## Limites de la qualification locale du kit

Les tests locaux dans le kit valident des fixtures et le code source. Le typecheck `vue-tsc`, le build Vite contre les dépendances exactes, l'exécution réelle Vite et les scénarios Playwright Microsoft Edge doivent être exécutés sur le poste Windows. Aucune revendication de certification de production n'est faite.
