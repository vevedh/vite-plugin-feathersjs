# Construire et publier le CLI

Le plugin Vite et le générateur sont deux packages séparés, avec des versions indépendantes. Le dépôt racine et le dossier source du CLI restent `private`. Le staging contrôlé produit un paquet public candidat.

```powershell
Set-Location C:\devs\vite-plugin-feathersjs
node scripts/check-r16-freeze.mjs
node --test tests/r17-cli-package.test.mjs
node scripts/stage-r17-cli.mjs
npm pack --dry-run --json .release/create-feathers-app
```

Le staging ne copie que les fichiers sources explicitement autorisés. `node_modules`, `dist`, les caches Vite, les fichiers `.env` privés et les lockfiles des exemples sont exclus, y compris sous Windows. La commande s'arrête si le paquet dépasse 120 fichiers ou 1 Mo de sources. **Ne publiez pas un tarball qui contient `node_modules`, des `.env` privés ou des builds d'exemples.**

Un dossier `.release/create-feathers-app` est généré. Contrôlez le manifeste, les templates, le binaire `create-feathers-app` et l'absence de secrets :

```powershell
Set-Location .\.release\create-feathers-app
npm pack --dry-run
npm view @vevedh/create-feathers-app versions --json
```

La version `0.1.0-rc.1` est déjà publiée. La nouvelle candidate `0.1.0-rc.2` doit être publiée uniquement après certification Windows, sous le tag `next` :

```powershell
npm whoami
npm publish --access public --tag next
```

La publication demande une validation explicite et l'authentification npm. Un `npm publish` réussi ne remplace pas le test d'installation dans un répertoire vierge.

```powershell
npm exec --package=@vevedh/create-feathers-app@next -- create-feathers-app --help
```

## Documentation VitePress

```powershell
Set-Location C:\devs\vite-plugin-feathersjs\docs\cli
corepack pnpm install
corepack pnpm run dev
corepack pnpm run build
```

Le site VitePress est publié séparément du paquet npm. Pour une publication sous un sous-chemin (par exemple Pages), définir `VITEPRESS_BASE` avant le build. Le README npm pointe vers la documentation ; aucune archive ni capture de certification privée ne doit être publiée sur le site.
