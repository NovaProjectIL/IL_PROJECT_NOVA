// useSync.ts
// Hook Socket.io pour la synchronisation video
// A placer dans : Front/app/hooks/useSync.ts
// Ce hook gere la connexion Socket.io et les evenements de synchronisation

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { EtatSync, EvenementForceSeek, EvenementReady, EvenementSeek } from "../types/types";

// TODO NADJIB : verifier que ces noms d evenements correspondent
// exactement a ce que ton gateway NestJS ecoute et emet
// FLOW FATMA (simple): click marqueur -> request_seek -> force_seek -> ready -> all_ready
const EVENTS = {
  REQUEST_SEEK: "request_seek",
  READY: "ready",
  FORCE_SEEK: "force_seek",
  ALL_READY: "all_ready",
  PLAY: "play",
  PAUSE: "pause",
};

// TODO NADJIB : verifier que ce namespace correspond a celui
// que tu as configure dans ton gateway NestJS pour la synchro video
const NAMESPACE_SYNC = "/sync";

type UseSync = {
  etatSync: EtatSync;
  dernierSeekForce: number | null;
  emitSeek: (timecode: number) => void;
  emitReady: () => void;
};

export const useSync = (roomId: string): UseSync => {
  const [etatSync, setEtatSync] = useState<EtatSync>("IDLE");
  const [dernierSeekForce, setDernierSeekForce] = useState<number | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socketUrl = process.env.NEXT_PUBLIC_WS_URL || "http://localhost:3001";

    socketRef.current = io(`${socketUrl}${NAMESPACE_SYNC}`, { autoConnect: true });
    const socket = socketRef.current;

    socket.on("connect", () => {
      // TODO NADJIB : verifier/adapter join_room si votre gateway utilise un autre nom
      socket.emit("join_room", { roomId });
    });

    socket.on(EVENTS.FORCE_SEEK, (data: EvenementForceSeek) => {
      // ZINEB: ce timecode doit venir du serveur pour toute la room
      setDernierSeekForce(data.timecode);
      setEtatSync("BUFFERING");
    });

    socket.on(EVENTS.ALL_READY, () => {
      setEtatSync("PLAYING");
    });

    // Liaison a brancher avec la machine a etats de Zineb
    socket.on(EVENTS.PAUSE, () => setEtatSync("PAUSED"));
    socket.on(EVENTS.PLAY, () => setEtatSync("PLAYING"));

    return () => {
      socket.disconnect();
    };
  }, [roomId]);

  const emitSeek = (timecode: number) => {
    // FATMA: appel depuis clic timeline / liste marqueurs
    if (!socketRef.current) return;
    const payload: EvenementSeek = { timecode, roomId };
    socketRef.current.emit(EVENTS.REQUEST_SEEK, payload);
    setDernierSeekForce(timecode);
    setEtatSync("BUFFERING");
  };

  const emitReady = () => {
    if (!socketRef.current) return;
    const payload: EvenementReady = { roomId };
    socketRef.current.emit(EVENTS.READY, payload);
  };

  return { etatSync, dernierSeekForce, emitSeek, emitReady };
};
