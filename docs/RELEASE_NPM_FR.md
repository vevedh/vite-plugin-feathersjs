# Publication npm — vite-plugin-feathersjs

Le nom non préfixé `vite-plugin-feathersjs` est déjà utilisé par un autre auteur. La publication de ce dépôt doit passer par un paquet distinct : **`@vevedh/vite-plugin-feathersjs`**. Le nom historique reste dans le dépôt pour ne pas casser les dépendances locales et les tests validés. Le manifeste racine est `private: true` : il ne peut pas être publié accidentellement.

Le README publié est en anglais pour les utilisateurs npm. Il fournit des exemples minimaux conformes à l'API réelle : REST Koa/Express, module de service, Socket.IO sur port séparé, HMR et serveur de production autonome. Les outils, MCP, templates et exemples ne font pas partie du paquet diffusé.

## Avant de publier

1. Vérifier sur votre machine la disponibilité et les droits du nom : `npm view @vevedh/vite-plugin-feathersjs version` et `npm whoami`. Une réponse 404 du registre peut indiquer un nom non publié ; elle ne garantit pas que vous avez les droits sur le scope.
2. Contrôler que le registre utilisé est bien `https://registry.npmjs.org/` et que l'authentification est valide. Ne jamais partager les tokens npm, OTP ou `.npmrc`.
3. Exécuter le contrôle complet Windows avec `npm run check:release`. Cette commande crée le dossier `.release/npm` puis vérifie le contenu du paquet au moyen de `npm pack --dry-run`.
4. Vérifier les vulnérabilités runtime avec `npm run audit:runtime`, et examiner aussi l'audit complet (`npm run audit:all`). La réussite du build ne constitue pas un audit de sécurité des dépendances.
5. Si le nom scoped existe déjà, vérifier le propriétaire et choisir une version **nouvelle**. Une version npm publiée ne peut être remplacée. Le stage actuel porte la version 0.2.6, à ajuster de manière cohérente avec le contrat de release avant publication si nécessaire.

## Commandes de publication

```powershell
Set-Location C:\devs\vite-plugin-feathersjs
npm run check:release
if ($LASTEXITCODE -ne 0) { throw 'Release FAILED' }
npm run audit:runtime
if ($LASTEXITCODE -ne 0) { throw 'Audit runtime FAILED' }
npm whoami
npm view @vevedh/vite-plugin-feathersjs versions --json

# Publier uniquement depuis le paquet préparé et vérifié
Set-Location .\.release\npm
npm publish --access public
```

La dernière commande nécessite une session npm autorisée et éventuellement la validation 2FA. Elle ne doit être exécutée que lorsque la propriété du namespace et la version ont été confirmées.

## Suite

Après publication, vérifier :

```powershell
npm view @vevedh/vite-plugin-feathersjs version
npm view @vevedh/vite-plugin-feathersjs dist-tags --json
```

Pour les consommateurs, remplacer l'import local historique par `@vevedh/vite-plugin-feathersjs`. La configuration et les services restent identiques. Un changement automatique de nom à l'intérieur des deux exemples certifiés nécessite une certification séparée.
