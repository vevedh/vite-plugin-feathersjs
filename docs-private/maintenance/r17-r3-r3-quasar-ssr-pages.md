# R17-r3-r3 — Quasar SSR HTTP / Edge + GitHub Pages

## Périmètre

- Génération Quasar 2 SSR depuis CLI rc.2, sans toucher au gel R16 (20 fichiers).
- Vérification des trois processus : Feathers loopback 3030, Quasar SSR 9100, edge 8080.
- Test HTTP de la séparation API JSON/SSR HTML, CRUD notes et tickets, validations d'entrées.
- Test Edge: rendu serveur avant hydratation, formulaire client, rechargement, responsive 390/1280, console Vue sans erreur.
- Pas d'assertion PASS pour Edge avant exécution du script Windows.
- GitHub Pages : ajouter uniquement docs/cli/** et .github/workflows/cli-vitepress-pages.yml au dépôt public ; ne jamais écraser les anciens fichiers du plugin.

## Exécution Windows

```powershell
cd C:\devs\vite-plugin-feathersjs\examples\quasar-ssr
corepack pnpm install
cd C:\devs\vite-plugin-feathersjs
.\scripts\r17\certify-quasar-ssr-generated-windows.ps1 -Adapter both
```

## GitHub Pages

Le dépôt GitHub distant actuellement visible utilise un manifeste de plugin ancien et différent de la baseline R16/R17. Déployer seulement docs/cli/** et le workflow Pages. Activer GitHub Actions sous Settings > Pages ; vérifier workflow et URL HTTP réelle. Ne pas annoncer un déploiement sans la preuve d'une exécution réussie.
