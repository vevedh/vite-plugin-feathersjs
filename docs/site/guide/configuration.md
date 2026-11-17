# Modifier les réglages courants

Vous pouvez choisir le moteur HTTP et décider d'activer ou non les notifications en direct. Ces options se règlent dans la configuration de Vite, et non dans la page du navigateur.

## Choisir le moteur HTTP

Le plugin prend en charge **Koa** et **Express**. Pour un premier essai, conservez Koa, proposé par défaut dans l'exemple Vitesse.

L'exemple Vitesse lit l'option `FEATHERS_ADAPTER`, dont la valeur peut être `koa` ou `express`. Le plus simple est de passer par le script de sélection des modes fourni dans le dossier `examples/basic`.

## Activer ou désactiver le direct

Socket.IO est facultatif. Lorsque vous le désactivez, l'application garde l'accès REST aux services ; elle ne reçoit simplement plus les notifications instantanées.

Pour comparer les modes sous Windows, ouvrez PowerShell dans `examples/basic` et utilisez le script prévu :

```powershell
.\scripts\DEV_MODE.ps1 -Adapter koa -RestOnly
```

Arrêtez le serveur en cours avec **Ctrl+C** avant de choisir un autre mode.

## Éviter les erreurs fréquentes

Le port du navigateur et celui de Socket.IO peuvent être différents en développement. Si vous modifiez une adresse ou un port, effectuez le changement dans la configuration correspondante et redémarrez le serveur.

[Besoin d'aide ? Voir les problèmes courants](/guide/depannage).
