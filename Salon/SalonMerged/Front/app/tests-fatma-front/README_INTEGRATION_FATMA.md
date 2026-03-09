# Integration Fatma - explication simple

Ce fichier explique exactement ce qui a ete fait dans le front pour ta partie timeline/sync.

## 1) Ce qui est fait cote Fatma

### A. Navigation timeline -> seek global
- Quand on clique un marqueur dans `VideoTimeline`, on appelle `onClicMarqueur`.
- Dans `VideoPlayer`, `handleClicMarqueur` envoie `emitSeek(timecode)`.
- `emitSeek` envoie l evenement Socket `request_seek` avec `{ roomId, timecode }`.

### B. Etat BUFFERING pendant seek collectif
- Des qu un seek est demande, le client passe en `BUFFERING`.
- Overlay affiche: "En attente des autres utilisateurs...".

### C. Application du seek force
- Quand le serveur envoie `force_seek`, le hook `useSync` stocke `dernierSeekForce`.
- `VideoPlayer` applique `playerRef.seekTo(dernierSeekForce)`.

### D. Reprise collective
- Quand le serveur envoie `all_ready`, etat -> `PLAYING`.
- Quand le player est pret en mode BUFFERING, le client emet `ready`.

## 2) Ce qu il reste a lier avec les autres

### Avec Zineb (backend sync)
Verifier que ces noms existent exactement dans le gateway:
- namespace: `/sync`
- client -> serveur: `join_room`, `request_seek`, `ready`
- serveur -> client: `force_seek`, `all_ready`, `play`, `pause`

Si les noms payloads different, changer uniquement `app/hooks/Usesync.ts`.

### Avec Nadjib (socket client global)
- verifier qu on ne cree pas un doublon de connexion socket si une socket centrale existe deja.
- si besoin: faire passer la socket partagee au hook au lieu de `io(...)` local.

### Avec Wafa (markers API)
- `onNouveauMarqueur` dans `VideoPlayer` appelle deja le handler de `RoomPage`.
- valider le body exact de creation marqueur (`categorie`, `auteurId`, etc.) selon son controller final.

## 3) Pourquoi tu as vu "code sans icons"
- Les icones de `RoomPage` ont ete retirees pour respecter ta demande.
- Les boutons restent presents, mais en texte simple.

## 4) Resume ultra court
- Timeline cliquee -> `request_seek` envoye.
- Tout le monde BUFFERING.
- Serveur renvoie `force_seek` -> seek applique.
- Clients envoient `ready`.
- Serveur envoie `all_ready` -> reprise PLAYING.
