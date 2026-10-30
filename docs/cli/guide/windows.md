# Développer et certifier sous Windows

Référence : Windows 11, Node.js 22.23.4, pnpm 10.30.2, Vite 7.3.7. Le plugin npm 0.2.6 est gelé.

Dans le projet généré :

```powershell
corepack pnpm install
corepack pnpm run dev:all
```

Dans un autre terminal :

```powershell
Invoke-RestMethod http://127.0.0.1:3030/api/health
```

Pour les tests du dépôt source R17, le lanceur démarre et arrête lui-même Feathers, Vite et Playwright :

```powershell
Set-Location C:\devs\vite-plugin-feathersjs
node examples/r17/scripts/certify-r17.mjs --case daisyui-spa --adapter koa
```

Microsoft Edge est lancé avec `--disable-gpu`, un worker et sans vidéo obligatoire. La vérification HTTP et la validation du marqueur d'exemple précèdent les tests de l'interface.

Les journaux de certification restent conservés localement et ne font pas partie des pages publiques.

## Reprendre une certification après une première exécution

Le script `scripts/r17/certify-published-npm-windows.ps1` crée désormais un nom de projet
unique pour chaque exécution et adaptateur. Vous pouvez lancer Koa puis Express sans
supprimer les projets précédents. Les dossiers de test sont conservés pour le diagnostic.

Pour Quasar SSR avec `@quasar/app-vite` v2.6.2, les types Express doivent rester en
version majeure 4, comme le serveur Express 4 réellement installé. Après mise à jour
du générateur, réinstallez les dépendances du projet et exécutez `pnpm run typecheck`
avant `pnpm run build`. Un build Vite réussi n'atteste pas à lui seul de la validité
TypeScript.
