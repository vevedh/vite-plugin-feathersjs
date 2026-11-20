# Préparer un schéma depuis Feathers Studio

Feathers Studio dispose maintenant d'une passerelle vers un canvas de préparation des schémas. Le panneau Vue DevTools présente les contrats des services Feathers, puis permet d'ouvrir **Préparer un brouillon** pour les schémas Zod, JSON Schema et TypeBox.

Le canvas s'ouvre sur `http://127.0.0.1:5173/schema-designer.html` uniquement lorsque le profil de développement `npm run dev:studio` est actif. Le service sélectionné dans DevTools est préselectionné, sans transmettre de données métier.

Dans le Designer, vous pouvez ajouter ou supprimer un champ dans le brouillon, changer son type, définir certaines contraintes, déplacer les cartes, comparer les changements avec le contrat vérifié, importer un brouillon JSON v2 et exporter un brouillon. Aucune action n'écrit dans les services Feathers ou dans la base de données.

Les services `manual`, tels que la démonstration `notes`, restent consultables dans Vue DevTools, mais ne sont pas proposés à l'édition de schéma. Ils ne disposent pas d'un schéma Zod, JSON Schema ou TypeBox canonique compatible avec l'ancien Designer.

Le fichier exporté est **non exécutable** (`executable: false`). L'ancien CLI de migration R14-S4 ne doit pas être utilisé directement avec les contrats R14-S5-R5 sans adaptation, préflight et nouvelle certification. Le navigateur ne peut pas déclencher de migration.

La fonctionnalité ne fait pas partie du build Vite de production : le document HTML du Designer est fourni par un middleware de développement, et non par un fichier HTML présent dans la racine du projet.
