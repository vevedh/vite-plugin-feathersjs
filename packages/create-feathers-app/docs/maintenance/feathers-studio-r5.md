# Feathers Studio · Qualification Windows de R14-S5-R7

La qualification R5 du 19 novembre 2026 valide le parcours du panneau Feathers Studio au Schema Designer dans Microsoft Edge et l’exécution du module de registre R4 sous Bun 1.4.4 dans Docker Desktop.

| Contrôle | Résultat observé |
| --- | --- |
| Baseline R4 | Le préflight retrouve les empreintes attendues des modules du CLI et du laboratoire, du reçu R4 et du verrou npm du laboratoire. |
| Microsoft Edge | Le panneau affiche `notes`, `tickets` et l’indicateur SSE « Connecté ». La préparation d’un brouillon est désactivée pour `notes`. Elle ouvre le Designer Zod de `tickets`. Le champ ajouté disparaît au rechargement. Le scénario compte zéro requête HTTP d’écriture vers le laboratoire. |
| Docker Bun | Le registre accepte une application appelable de test. L’événement observé contient le nom du service, son type et un numéro de séquence. Le conteneur fonctionne avec l’UID 65532, une racine en lecture seule, `NoNewPrivs` activé, zéro capacité Linux effective et la seule interface `lo`. |

R4 avait déjà validé sous Windows l’application Feathers Express réelle, `vue-tsc --noEmit`, le build Vite, le pack npm à blanc, HTTP/SSE et l’isolation des routes Studio sous Vite Preview. Le scénario Edge R5 entre par la route locale du panneau. Le contrôle Docker R5 porte sur le module de registre avec un service synthétique.
