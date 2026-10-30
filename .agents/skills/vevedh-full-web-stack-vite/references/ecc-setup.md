# ECC — installation sélective et non destructive

## Périmètre

Source officielle : https://ecc.tools/skills et https://github.com/affaan-m/ECC. ECC fournit des **skills, agents et commandes** pour plusieurs environnements. La présente intégration ne copie **aucun code ECC** et n'exécute aucun programme distant tant qu'un utilisateur n'a pas explicitement opté pour `Preview` ou `Install`.

Référence de version **épinglée** : `ecc-universal@2.2.3` (à revalider lors d'une mise à jour volontaire). Le site et le README officiel peuvent évoluer indépendamment ; ne pas utiliser `@latest` dans une procédure de certification. Choisir **une seule méthode d'installation ECC par environnement**, pour éviter hooks/skills dupliqués. Vérifier ce qui est déjà installé avant d'appliquer.

## Sélection pour vite-plugin-feathersjs

Le catalogue ECC contient des patterns génériques, qui ne remplacent pas l'architecture FeathersJS v5 / Vite 7 / Vue 3 / Quasar 2 :

| Skill ECC (catalogue) | Usage local | Limite impérative |
| --- | --- | --- |
| `coding-standards` | strict TypeScript, modules Node ESM | conserver API FeathersJS v5 |
| `verification-loop` | tests, gate de release, rapports | ne jamais transformer un test non lancé en PASS |
| `tdd-workflow` | correctifs de générateur / templates | pas de refactor de R16 figé |
| `api-design` | noms et contrats des services Feathers | service-first, pas de couche REST ad hoc |
| `security-review` | JWT/OIDC/Keycloak, secrets et RBAC | profils non opérationnels = refus de démarrage |
| `security-scan` | scanner configs/mots de passe locaux | aucun téléchargement/publication de secrets |
| `database-migrations` | Mongo/SQL multi-bases | transaction et migration par adaptateur, aucune fiction de provisionnement |
| `deployment-patterns` | GitHub Pages, npm rc et rollback | aucun push/publish automatique |
| `docker-patterns` | environnements d'intégration | pas de config de production modifiée |
| `skill-stocktake` | détecter doublons/conflits d'agents | ne jamais installer le catalogue complet par défaut |

Commandes et agents ECC (sur sélection explicite uniquement) : `verify`, `tdd`, `code-review`, `quality-gate`, `security-reviewer`, `build-error-resolver`, `e2e-runner`, `doc-updater`. Ces éléments sont **recommandés**, pas prétendus installés. L'installation native guidée par harness peut proposer son profil `core`; choisir les ressources à conserver après examen, sans supposer que le programme guidé accepte un filtre automatique par ID.

Éviter d'appliquer à ce projet les patterns React/Next.js ou Spring Boot en remplacement de Vue/Feathers. Les conseils ECC relatifs à l'authentification, aux bases ou aux migrations ne sont pas une implémentation : seuls les services/hook serveur réellement raccordés et testés peuvent être annoncés opérationnels.

## Windows PowerShell : mode par défaut sans effet

Depuis la racine du dépôt :

```powershell
# Afficher le plan, sans réseau et sans modification
.\scripts\ecc\setup-ecc.ps1 -Harness codex

# Exécuter l'aperçu officiel avec la version pinée (npx télécharge éventuellement le paquet)
.\scripts\ecc\setup-ecc.ps1 -Harness codex -Mode Preview

# Après vérification des chemins/collisions dans l'aperçu : installation guidée
.\scripts\ecc\setup-ecc.ps1 -Harness codex -Mode Install

# Un autre environnement : choisir UNE méthode par harness
.\scripts\ecc\setup-ecc.ps1 -Harness claude -Mode Preview
```

`Install` est interactif : choisir une portée locale/projet lorsque la plateforme le permet et **désactiver les hooks par défaut**. Ne pas passer `--yes` au guided installer, ne pas installer une seconde fois si le plugin ECC est déjà présent. Pour Cursor/OpenCode, suivre les instructions officielles spécifiques à leur adaptateur plutôt que d'inventer des options de CLI. Le script ci-dessus cible exclusivement Codex, Claude et Kimi documentés pour le mode guided.

## Règles de contrôle obligatoires

1. Avant : sauvegarder et inspecter la configuration des outils agents existants, vérifier la source officielle et la version épinglée, lire les permissions/hook profile.
2. Installation : aucune modification de `package.json` du plugin `0.2.6` et aucun paquet ECC en dépendance runtime du CLI `@vevedh/create-feathers-app`.
3. Après : vérifier les chemins réels installés (pas de doublon), et que les règles de FeathersJS v5 / R16 restent prioritairement applicables.
4. Git : `.agents/`, `.claude/`, `.codex/`, `.kimi-code/`, `.ecc/`, `docs-private/` et fichiers d'agent ne doivent pas être versionnés ; aucun secret ni empreinte en documentation.
5. Test avant diffusion : `node scripts/ecc/verify-ecc-contract.mjs`, `node scripts/check-r16-freeze.mjs`, tests R17 et E2E Windows Edge. Les configurations externes restent des options, jamais un prérequis pour `npm pack`.
6. Mise à jour ECC : nouvelle décision explicite, audit des changements upstream, revue sécurité et nouvelle certification ; pas d'auto-update.

## Liens

- Catalogue officiel : https://ecc.tools/skills
- Installation et platforms : https://ecc.tools/platforms
- Source OSS et notes de publication : https://github.com/affaan-m/ECC
