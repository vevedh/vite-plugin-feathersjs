# Choisir un mode de rendu

Le choix du rendu dépend du type d'application et de son hébergement.

| Interface | SPA | SSR | SSG |
| --- | :---: | :---: | :---: |
| daisyUI | Oui | Oui | Oui |
| Quasar 2 | Oui | Oui | Non |

**SPA** : l'interface est exécutée dans le navigateur. Les services Feathers sont accessibles selon la configuration du projet.

**SSR** : la page est d'abord rendue côté serveur. L'API et le contexte d'une requête ne doivent jamais être partagés avec d'autres sessions.

**SSG** : les pages statiques sont produites à la compilation. Les données privées ne doivent pas être intégrées dans les fichiers pré-rendus.

Le mode de rendu est sélectionné avec `--render spa`, `--render ssr` ou `--render ssg`. Le modèle Quasar 2 SSG n'est pas proposé. Les modes SSR et SSG utilisent un serveur API séparé dans les profils actuellement disponibles.
