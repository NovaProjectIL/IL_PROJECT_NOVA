// types.ts
// Types partagés pour la timeline et la synchronisation
// A placer dans : Front/app/types/types.ts

// ---------------------------------------------------------
// TYPE : Marqueur
// Représente un marqueur posé sur la timeline
// Ce type sera utilisé par Wafa (BDD) et Fatma (affichage)
// ---------------------------------------------------------
export type Marqueur = {
  id: string;
  // Timecode en secondes (ex: 125.5)
  timecode: number;
  // Texte de l annotation
  label: string;
  // Categorie du marqueur
  // TODO WAFA : ajuster les categories selon ce que tu definis en BDD
  categorie: "erreur" | "commentaire" | "point_fort" | "a_revoir";
  // Identifiant de la room a laquelle appartient ce marqueur
  roomId: string;
  // Identifiant de l utilisateur qui a pose ce marqueur
  auteurId: string;
  // Nom affiche de l auteur
  auteurNom: string;
};

// ---------------------------------------------------------
// TYPE : EtatSync
// Les trois etats possibles de synchronisation
// Ces etats sont pilotes par les evenements Socket.io de Nadjib
// ---------------------------------------------------------
export type EtatSync = "IDLE" | "PLAYING" | "PAUSED" | "BUFFERING";

// ---------------------------------------------------------
// TYPE : EvenementSeek
// Payload de l evenement request_seek emis vers le serveur
// TODO ZINEB : verifier que ce payload correspond a ce que ton gateway NestJS attend
// ---------------------------------------------------------
export type EvenementSeek = {
  timecode: number;
  roomId: string;
};

// ---------------------------------------------------------
// TYPE : EvenementForceSeek
// Payload de l evenement force_seek recu du serveur
// TODO ZINEB : verifier que ce payload correspond a ce que ton gateway NestJS envoie
// ---------------------------------------------------------
export type EvenementForceSeek = {
  timecode: number;
};

// ---------------------------------------------------------
// TYPE : EvenementReady
// Payload de l evenement ready emis vers le serveur
// quand le player a fini de bufferiser apres un seek
// TODO ZINEB : verifier que ce payload correspond a ce que ton gateway NestJS attend
// ---------------------------------------------------------
export type EvenementReady = {
  roomId: string;
};