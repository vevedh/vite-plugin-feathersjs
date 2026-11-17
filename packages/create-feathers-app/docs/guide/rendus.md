# Choisir le bon mode

| Interface | SPA | SSR | SSG |
|---|---|---|---|
| Quasar 2 | Générée et testée REST | Exemple R16 certifié, génération à venir | Non compatible avec la baseline CLI retenue |
| daisyUI | Générée et testée | Générée, exemple R17 certifié | Générée, exemple R17 certifié |

**SPA** : point de départ simple pour un outil interne. L'application charge la structure et les données dans le navigateur.

**SSR** : le serveur construit le HTML initial, puis Vue prend le relais. Nécessite un processus Node en exploitation.

**SSG** : les pages publiques sont produites au build. Les informations métier dynamiques continuent à provenir de l'API FeathersJS.

![SPA, SSR et SSG utilisent la même API FeathersJS](/diagrams/rendus.svg)

Pour toute donnée personnelle, prévoyez authentification, autorisation et cache adapté avant d'exposer les services.
