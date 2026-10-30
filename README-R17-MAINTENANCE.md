# Kit R17 — maintenance `examples/` et référence `vite.config.ts`

Archive overlay non destructive. Décompresser à la racine du dossier parent de `vite-plugin-feathersjs`.

Contenu :
- `scripts/maintenance/clean-examples.mjs` : inventaire par défaut, quarantaine explicitement activable.
- `tests/clean-examples.test.mjs` : tests Node intégrés.
- `examples/runtime-vite/` : exemple autonome de montage Feathers REST dans Vite 7.
- `docs-private/maintenance/2026-10-30-examples-runtime-vite.md` : décisions, limites et actions futures.
- `.gitignore.r17-additions.txt` : règles proposées à reporter dans le `.gitignore` existant après revue.

Aucune source existante n'est écrasée dans l'archive. Ne pas confondre avec une archive cumulative R17.
