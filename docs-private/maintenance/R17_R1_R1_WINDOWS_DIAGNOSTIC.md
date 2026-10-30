# R17-r1-r1 — Analyse du journal Windows et correctif de certification

## Symptômes observés

- R16 freeze **PASS** ; tests générateur R17-r1 **5/5 PASS** ; génération Quasar SPA **18 fichiers**.
- `node examples/r17/scripts/check-feathers-http.mjs` : `ECONNREFUSED 127.0.0.1:3030` car aucun processus Feathers n'est montré en cours d'exécution à ce moment.
- Playwright pointe vers `http://127.0.0.1:5173` sans lancement préalable du serveur du projet ciblé. Le champ `Titre de la nouvelle note` n'est pas trouvé, et une ressource 404 est détectée. À ce stade, ces messages ne prouvent pas une régression Quasar/Feathers. La ressource exacte responsable du 404 n'a pas été fournie.

## Correctifs

- `examples/r17/scripts/certify-r17.mjs` lance les processus API et frontend dans le répertoire exact de l'exemple ; refuse les ports 3030/5173 déjà occupés ; contrôle `/api/health` et l'identité HTML, puis exécute les tests HTTP et Edge et nettoie les processus créés.
- Contrat `r17-example` dans chaque HTML et dans le générateur SPA ; Playwright exige `R17_CASE`, `R17_MODE`, `R17_BASE_URL` cohérents et vérifie le marqueur et `/api/health` avant ses assertions.
- Diagnostics console HTTP 4xx/5xx incluant les URLs ; favicon data inline pour éviter le faux 404 implicite ; aucun filtrage d'erreurs ni d'avertissements d'hydratation.
- Scénario Socket.IO SPA opt-in à deux navigateurs et deux adaptateurs, non déclaré certifié tant que Windows ne l'a pas confirmé.
- `TEST_R17_WINDOWS.ps1` exécute réellement les portes au lieu d'afficher seulement des consignes.

## Périmètre

- **Aucune modification** aux sources publiées sur npm ni aux 20 fichiers gelés de R16.
- Quasar SSR : baseline R16 et son runner historique inchangés.
- Quasar SSG : garde de compatibilité inchangé (non certifié).
- daisyUI SSR/SSG : nouveaux exemples à certifier sous Windows ; Socket.IO sur ces rendus demeure non pris en charge dans le lanceur R17-r1-r1.
- Validation d'archive : tests Node du générateur et des contrats ; les compilations et E2E sur Windows restent à exécuter par le mainteneur.
