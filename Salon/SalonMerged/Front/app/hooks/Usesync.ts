// useSync.ts
// Hook Socket.io pour la synchronisation video
// A placer dans : Front/app/hooks/useSync.ts
// Ce hook gere la connexion Socket.io et les evenements de synchronisation

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { EtatSync, EvenementForceSeek, EvenementReady, EvenementSeek } from "../types/types";

// TODO NADJIB : verifier que ces noms d evenements correspondent
// exactement a ce que ton gateway NestJS ecoute et emet
const EVENTS = {
  // Evenements emis par le client vers le serveur
  REQUEST_SEEK: "request_seek",
  READY: "ready",
  // Evenements recus du serveur par le client
  FORCE_SEEK: "force_seek",
  ALL_READY: "all_ready",
};

// TODO NADJIB : verifier que ce namespace correspond a celui
// que tu as configure dans ton gateway NestJS pour la synchro video
// Exemple : @WebSocketGateway({ namespace: '/sync' })
const NAMESPACE_SYNC = "/sync";

type UseSync = {
  // Etat actuel de synchronisation
  etatSync: EtatSync;
  // Fonction pour emettre un seek vers le serveur
  emitSeek: (timecode: number) => void;
  // Fonction pour signaler au serveur que ce client est pret apres buffering
  emitReady: () => void;
};

export const useSync = (roomId: string): UseSync => {

  // Etat de synchronisation actuel
  const [etatSync, setEtatSync] = useState<EtatSync>("IDLE");

  // Reference vers le socket pour eviter les re-renders
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // TODO NADJIB : verifier que l URL correspond a ton serveur NestJS
    // Elle est definie dans les variables d environnement du projet
    const socketUrl = process.env.NEXT_PUBLIC_WS_URL || "http://localhost:3001";

    // Connexion au namespace de synchronisation
    socketRef.current = io(`${socketUrl}${NAMESPACE_SYNC}`, {
      // On n envoie la room qu apres connexion via un evenement join
      autoConnect: true,
    });

    const socket = socketRef.current;

    // Quand la connexion est etablie on rejoint la room
    socket.on("connect", () => {
      // TODO NADJIB : verifier que l evenement "join_room" correspond
      // a celui que ton gateway NestJS ecoute pour ajouter un client a une room
      socket.emit("join_room", { roomId });
    });

    // Ecoute l evenement force_seek envoye par le serveur de Zineb
    // Quand cet evenement arrive, on passe en BUFFERING
    socket.on(EVENTS.FORCE_SEEK, (data: EvenementForceSeek) => {
      setEtatSync("BUFFERING");
      // TODO FATMA : cet evenement declenche le seek dans VideoPlayer.tsx
      // Le composant VideoPlayer ecoute cet evenement via ce hook
    });

    // Ecoute l evenement all_ready envoye par le serveur de Zineb
    // Quand tous les clients sont prets, on passe en PLAYING
    socket.on(EVENTS.ALL_READY, () => {
      setEtatSync("PLAYING");
    });

    // Nettoyage : deconnexion quand le composant est demonte
    return () => {
      socket.disconnect();
    };
  }, [roomId]);

  // Emet un evenement request_seek vers le serveur
  // Appele quand l utilisateur clique sur une epingle de la timeline
  const emitSeek = (timecode: number) => {
    if (socketRef.current) {
      const payload: EvenementSeek = { timecode, roomId };
      socketRef.current.emit(EVENTS.REQUEST_SEEK, payload);
      // On passe immediatement en BUFFERING en attendant le force_seek du serveur
      setEtatSync("BUFFERING");
    }
  };

  // Emet un evenement ready vers le serveur
  // Appele quand le player YouTube a fini de bufferiser apres un seek
  const emitReady = () => {
    if (socketRef.current) {
      const payload: EvenementReady = { roomId };
      socketRef.current.emit(EVENTS.READY, payload);
    }
  };

  return { etatSync, emitSeek, emitReady };
};