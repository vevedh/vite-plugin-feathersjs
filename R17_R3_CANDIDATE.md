# create-feathers-app — R17-r3 / 0.1.0-rc.2

## État

- Le plugin Vite npm `@vevedh/vite-plugin-feathersjs@0.2.6` et les 20 fichiers R16 certifiés sont inchangés.
- Le CLI npm `0.1.0-rc.1` est publié. `0.1.0-rc.2` est une nouvelle **candidate non publiée**.
- Quasar 2 SSR est désormais générable depuis le CLI. Le code suit la référence R16, mais le projet généré et ses dépendances doivent encore passer la certification Windows (typecheck, build et Edge).
- `service add` crée et inscrit un service Feathers en mémoire, avec validation de `title` dans les schémas TypeBox, JSON Schema/Ajv ou Zod.
- `--auth jwt|oauth2|oidc|keycloak` et `--db <alias>:<adapter>` créent des profils de configuration. Authentifications externes et SGBD persistants ne sont **pas** des runtimes opérationnels : le serveur refuse de démarrer tant que ces modes n'ont pas été réellement implémentés et certifiés.
- GitHub Pages : workflow et script de publication de la branche de documentation inclus, mais site **non encore déployé**. Le dépôt public main n'héberge pas encore les sources docs/cli.

## Contrôles locaux terminés

- `node scripts/check-r16-freeze.mjs`: PASS, 20/20.
- `node --test tests/r17-cli-package.test.mjs tests/r17-generator.test.mjs tests/r17-runner.test.mjs tests/r17-r3-features.test.mjs`: 21/21 PASS.
- `node scripts/check-r17-docs.mjs`: PASS, 16 pages.
- `node scripts/stage-r17-cli.mjs`: 95 fichiers contrôlés.
- `npm pack` : 95 fichiers, 35 Ko compressés environ ; aucune dépendance compilée ni dossier privé.
- Installation du `.tgz` en dossier indépendant et génération Quasar SSR, ajout de service Zod, génération de profil Keycloak/PostgreSQL/MongoDB avec refus de démarrage : PASS.

## Portes Windows restantes

1. Compiler la documentation VitePress (`docs/cli`, `corepack pnpm run build`).
2. Générer Quasar SSR via le nouveau CLI, installer les dépendances, typecheck, build, tests Edge/HTTP.
3. Tester les services créés contre un véritable runtime Koa puis Express ; vérifier le rejet des entrées invalides et les méthodes CRUD.
4. Certifier les projets générés depuis le CLI **publié** `0.1.0-rc.1` avec `scripts/r17/certify-published-npm-windows.ps1`.
5. Pousser la documentation sur GitHub, activer GitHub Actions comme source Pages et vérifier le site public.
6. Publier `0.1.0-rc.2` sous `next` seulement après les portes de certification ; ne jamais republi​er `0.1.0-rc.1`.

## Correctif R17-r3-r1 (après tests Windows)

- La génération Quasar SSR fixe les types Express 4 (`@types/express@4.17.25`, `@types/express-serve-static-core@4.19.9`) avec un override pnpm. Cette modification concerne **uniquement les projets générés** ; elle ne touche pas les sources R16 certifiées. Le build SSR fonctionne, mais le nouveau typecheck doit être validé sur Windows.
- `certify-published-npm-windows.ps1` crée des dossiers indépendants pour chaque exécution et adaptateur avec un identifiant aléatoire de 12 caractères. L'ancienne erreur de collision du second passage Express est supprimée, tout en refusant tout écrasement.
- Aucun changement des fonctionnalités d'authentification et de base : profils externes toujours bloqués sans configuration certifiée.
- Candidate npm reste `0.1.0-rc.2`, non publiée tant que toutes les portes Windows n'ont pas passé.
