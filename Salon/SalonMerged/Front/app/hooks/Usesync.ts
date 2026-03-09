// useSync.ts
// Hook Socket.io pour la synchronisation video (partie Fatma)

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { EtatSync } from "../types/types";

type UseSync = {
  etatSync: EtatSync;
  dernierSeekForce: number | null;
  emitSeek: (timecode: number) => void;
  emitReady: () => void;
};

// Hook adapte au backend actuel:
// - rooms.gateway ecoute "seek" / "play" / "pause" sur namespace principal
// - il emet "playback-updated" avec action = seek|play|pause
export const useSync = (
  roomCode: string,
  externalSocket?: Socket | null,
): UseSync => {
  const [etatSync, setEtatSync] = useState<EtatSync>("IDLE");
  const [dernierSeekForce, setDernierSeekForce] = useState<number | null>(null);
  const localSocketRef = useRef<Socket | null>(null);
  const lastPlaybackStateRef = useRef<"PLAYING" | "PAUSED">("PAUSED");

  useEffect(() => {
    const hasExternalSocket = !!externalSocket;

    if (!hasExternalSocket) {
      const socketUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
      localSocketRef.current = io(socketUrl, { autoConnect: true });
      console.log("[SYNC] Socket local cree (fallback)", socketUrl);

      localSocketRef.current.on("connect", () => {
        // Important fallback: rejoindre la room pour recevoir server.to(roomCode)
        localSocketRef.current?.emit("join-room", { codeRoom: roomCode, memberId: 0 });
        console.log("[SYNC] join-room emis (fallback)", { codeRoom: roomCode, memberId: 0 });
      });
    }

    const activeSocket = externalSocket ?? localSocketRef.current;
    if (!activeSocket) return;

    const onPlaybackUpdated = (data: any) => {
      const action = data?.action;
      const positionSec = Number(data?.playback?.positionSec ?? 0);
      console.log("[SYNC] playback-updated recu", { action, positionSec, data });

      if (action === "seek") {
        // Signal serveur de seek global
        setDernierSeekForce(positionSec);
        setEtatSync("BUFFERING");

        // Le backend actuel n'envoie pas toujours status sur seek.
        // On restaure l'etat precedent connu pour eviter de forcer PAUSED a tort.
        window.setTimeout(() => {
          setEtatSync(lastPlaybackStateRef.current);
        }, 500);
      } else if (action === "play") {
        lastPlaybackStateRef.current = "PLAYING";
        setEtatSync("PLAYING");
      } else if (action === "pause") {
        lastPlaybackStateRef.current = "PAUSED";
        setEtatSync("PAUSED");
      }
    };

    // Compatibilite future si Zineb expose force_seek/all_ready plus tard
    const onForceSeek = (data: any) => {
      console.log("[SYNC] force_seek recu (compat)", data);
      setDernierSeekForce(Number(data?.timecode ?? 0));
      setEtatSync("BUFFERING");
    };

    const onAllReady = () => {
      console.log("[SYNC] all_ready recu (compat)");
      lastPlaybackStateRef.current = "PLAYING";
      setEtatSync("PLAYING");
    };

    activeSocket.on("playback-updated", onPlaybackUpdated);
    activeSocket.on("force_seek", onForceSeek);
    activeSocket.on("all_ready", onAllReady);

    return () => {
      activeSocket.off("playback-updated", onPlaybackUpdated);
      activeSocket.off("force_seek", onForceSeek);
      activeSocket.off("all_ready", onAllReady);
      if (!hasExternalSocket && localSocketRef.current) {
        localSocketRef.current.disconnect();
      }
    };
  }, [externalSocket, roomCode]);

  const emitSeek = (timecode: number) => {
    const activeSocket = externalSocket ?? localSocketRef.current;
    if (!activeSocket) {
      console.error("[SYNC] emitSeek ignore: socket indisponible");
      return;
    }

    // Evite le doublon d'emission:
    // - avec socket externe, RoomPage.onSeek emet deja "seek"
    // - ici on ne fait que piloter l'UI sync
    if (!externalSocket) {
      console.log("[SYNC] emit seek (fallback local)", { roomCode, timecode });
      activeSocket.emit("seek", {
        codeRoom: roomCode,
        positionSec: timecode,
        wasPlaying: lastPlaybackStateRef.current === "PLAYING",
      });
    } else {
      console.log("[SYNC] emit seek skipped (external socket handles emit)", { roomCode, timecode });
    }

    setDernierSeekForce(timecode);
    setEtatSync("BUFFERING");
  };

  const emitReady = () => {
    const activeSocket = externalSocket ?? localSocketRef.current;
    if (!activeSocket) return;

    // TODO ZINEB: gateway principal n expose pas ready actuellement.
    console.log("[SYNC] emit ready (compat)", { roomCode });
    activeSocket.emit("ready", { roomCode });
  };

  return { etatSync, dernierSeekForce, emitSeek, emitReady };
};
