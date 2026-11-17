# Créer un projet, étape par étape

Ce parcours utilise le CLI local `0.1.0-rc.10`, après reconstruction depuis les sources. Il distingue une application de démonstration en mémoire et un projet avec bases persistantes dont le démarrage public reste à finaliser.

## 1. Préparer le CLI local

Dans le dépôt, reconstruisez le CLI puis consultez son aide. Cette opération ne publie aucun paquet npm.

```powershell
node scripts/stage-r17-cli.mjs
if ($LASTEXITCODE -ne 0) { throw "Reconstruction du CLI échouée" }
cfapp --help
```

Les commandes suivantes sont compatibles PowerShell 5.1. Chaque commande tient sur une ligne ; aucun caractère de continuation n'est nécessaire.

## 2. Générer une démonstration locale

Commencez par une SPA daisyUI avec stockage en mémoire. Une SPA est une application dont l'interface s'exécute dans le navigateur.

```powershell
cfapp --name portail-demo --dir portail-demo --ui daisyui --render spa --transport rest --schema zod --auth none --db main:memory
if ($LASTEXITCODE -ne 0) { throw "Génération échouée" }
Set-Location portail-demo
corepack pnpm install
if ($LASTEXITCODE -ne 0) { throw "Installation échouée" }
corepack pnpm run dev
```

Le dossier doit être inexistant. Les données en mémoire sont temporaires. Ce profil sans authentification sert uniquement au développement local.

::: tip Trois choix à repérer
**① `--ui daisyui`** choisit les composants visuels. **② `--schema zod`** choisit la validation. **③ `--db main:memory`** donne le nom `main` à une base temporaire.
:::

## 3. Générer le projet avec trois bases

Arrêtez le serveur de démonstration avec Ctrl+C, puis revenez à la racine du dépôt. Utilisez un nouveau dossier.

```powershell
Set-Location "."
cfapp --name portail-persistant --dir portail-persistant --ui daisyui --render spa --transport rest --schema zod --auth jwt --db main:postgresql,events:mariadb,analytics:mongodb
if ($LASTEXITCODE -ne 0) { throw "Génération échouée" }
```

| Repère | Option | Résultat |
| --- | --- | --- |
| ① | `--auth jwt` | Modules de connexion, JWT et autorisation CASL |
| ② | `main:postgresql` | Provider PostgreSQL nommé `main` |
| ③ | `events:mariadb,analytics:mongodb` | Deux providers supplémentaires |

::: warning Généré ne signifie pas démarré
Les modules persistants sont produits, mais leur bootstrap HTTP sécurisé reste à finaliser. `assertCapabilities()` bloque encore le démarrage public de ce profil. Ne supprimez pas ce contrôle pour lancer l'application.
:::

## 4. Retrouver les fichiers utiles

| Fichier généré | À quoi sert-il ? |
| --- | --- |
| `api/config/profile.json` | Choix d'identité, schéma et bases |
| `api/config/database-connections.generated.mjs` | Alias et noms des variables DB |
| `api/runtime/database-providers.generated.mjs` | Ouverture et fermeture des connexions |
| `api/runtime/storage.mjs` | Préparation des tables ou collections |
| `api/security/register.mjs` | Enregistrement des services JWT/CASL |
| `api/security/policy.mjs` | Droits du compte et validation des demandes |
| `api/security/connect.mjs` | Raccordement des providers à Feathers |
| `scripts/prepare-storage.mjs` | Commande administrative de préparation |
| `database.env.example` | Modèle sans secrets pour les paramètres DB |

::: tip Repères dans le projet
**① Configuration** : commencez par les alias et variables. **② Runtime** : les connexions restent côté serveur. **③ Sécurité** : le navigateur ne décide jamais des droits d'accès.
:::

## 5. Préparer une base de développement dédiée

Depuis le projet persistant généré, installez les dépendances et copiez le modèle vers `.env.db` seulement si ce fichier n'existe pas.

```powershell
Set-Location portail-persistant
corepack pnpm install
if ($LASTEXITCODE -ne 0) { throw "Installation échouée" }
if (Test-Path -LiteralPath ".env.db") { throw ".env.db existe déjà : conservez ses valeurs" }
Copy-Item -LiteralPath "database.env.example" -Destination ".env.db"
notepad .env.db
```

Renseignez les paramètres de chaque provider : `HOST`, `PORT`, `USER`, `PASSWORD`, `NAME`, avec le préfixe de son alias, par exemple `P5_DB_MAIN_`. Le mot de passe reste dans `.env.db`, jamais dans Git, une capture ou une commande partagée.

Les trois serveurs DB doivent être accessibles. Le générateur de ce jalon ne crée pas encore leur environnement Docker Compose : utilisez vos instances de développement dédiées.

```powershell
node --env-file=.env.db scripts/prepare-storage.mjs --apply --alias main
if ($LASTEXITCODE -ne 0) { throw "Préparation du stockage échouée" }
```

Cette commande ouvre les providers déclarés et prépare `app_users` et `app_documents` sur **l'alias choisi**. Elle ne crée aucun compte. Utilisez des bases de développement dédiées et vides : la compatibilité complète d'un schéma préexistant n'est pas encore qualifiée. N'exécutez pas plusieurs préparations simultanément.

## Captures annotées du guide

Ces images montrent les pages du guide rendues dans un navigateur Chromium sous Linux. Les repères expliquent les options et fichiers ; ce ne sont ni des captures de PowerShell Windows ni une preuve de connexion aux bases.

![Capture annotée : choix JWT et trois providers, avec avertissement sur le démarrage public.](/screenshots/cli-generation-annotee.png)

![Capture annotée : fichiers générés, regroupés par configuration, runtime et sécurité.](/screenshots/cli-fichiers-annotes.png)

## En cas de blocage

- **Dossier déjà présent** : choisissez un nouveau nom ; le CLI refuse d'écraser un projet.
- **Variables DB invalides** : vérifiez chaque préfixe et chaque valeur dans `.env.db` sans les partager.
- **Stockage non préparé** : préparez explicitement l'alias retenu avant le futur bootstrap.
- **API bloquée par les capacités** : comportement attendu pour le profil persistant actuel.

Bonne pratique : conservez la première démonstration en mémoire pour découvrir le CLI, puis travaillez sur la persistance dans un projet séparé.
