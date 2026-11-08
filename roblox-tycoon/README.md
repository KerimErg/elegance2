# 🍬 Bonbon Tycoon (jeu Roblox)

Un tycoon où chaque joueur a son usine à bonbons. Il achète des machines qui font tomber des bonbons, ceux-ci roulent sur un tapis jusqu'au collecteur, et l'argent permet d'acheter de meilleures machines.

## Contenu du jeu

- **4 usines** générées automatiquement autour du centre de la carte. Chaque joueur reçoit la sienne en arrivant.
- **13 achats** qui se débloquent dans l'ordre : 5 machines, 2 arches multiplicatrices (x2 et x3), 2 améliorations du tapis et des décors (murs, tour).
- **Boutons verts ou rouges** : vert si tu as assez d'argent, rouge sinon.
- **Plaque « Récolter »** : l'argent s'accumule dans l'usine, et tu marches sur la plaque pour le récupérer.
- **Renaissance** : tu repars de zéro, mais tes gains augmentent de 50 % à chaque fois. Une fenêtre de confirmation s'affiche avant.
- **Sauvegarde automatique** : argent, renaissances et achats sont enregistrés.
- **Interface** : compteur d'argent, multiplicateur et notifications.

## Installation dans Roblox Studio (environ 5 minutes)

1. Ouvre **Roblox Studio** et crée un nouveau jeu avec le modèle **Baseplate**.
2. Dans l'**Explorer**, fais un clic droit sur **ServerScriptService**, puis *Insert Object* → **ModuleScript**. Renomme-le exactement `TycoonConfig` et colle dedans le contenu de `src/server/TycoonConfig.luau`.
3. Toujours dans **ServerScriptService** : *Insert Object* → **Script**. Renomme-le `TycoonServer` et colle le contenu de `src/server/TycoonServer.server.luau`.
4. Dans **StarterPlayer** → **StarterPlayerScripts** : *Insert Object* → **LocalScript**. Renomme-le `TycoonClient` et colle le contenu de `src/client/TycoonClient.client.luau`.
5. Clique sur **Play** ▶️ pour tester. Tu apparais dans ton usine : marche sur le bouton « Petite machine (GRATUIT) ».

### Pour que la sauvegarde marche

- Publie d'abord le jeu (*File* → *Publish to Roblox*).
- Ensuite : *Home* → **Game Settings** → **Security** → active **Enable Studio Access to API Services**.
- Sans ça, le jeu fonctionne mais affiche « Sauvegarde indisponible ».

### Réglages conseillés

- **Game Settings** → **Places** (ou *Server fill*) : mets **4 joueurs maximum**, soit le nombre d'usines (`Config.NumPlots`).

## Modifier le jeu

Tout se règle dans **`TycoonConfig`** :

- **Changer un prix ou un gain** : modifie `price`, `value` ou `interval` dans `Config.Items`.
- **Ajouter une machine** : copie un bloc `dropper` à la fin de la liste, donne-lui un nouvel `id`, un `x` libre sur le tapis (entre -26 et 9) et un `requires`.
- **Changer le thème** : modifie `Config.GameName`, `Config.Colors` et les noms des machines.
- **Plus d'usines** : augmente `Config.NumPlots` (et `Config.PlotDistance` si elles se touchent).

⚠️ Ne change pas l'`id` d'un achat après la sortie du jeu : les joueurs perdraient cet achat dans leur sauvegarde.

## Pour les avancés : Rojo

Le fichier `default.project.json` permet de synchroniser le dossier avec Studio grâce à [Rojo](https://rojo.space) (`rojo serve`).
