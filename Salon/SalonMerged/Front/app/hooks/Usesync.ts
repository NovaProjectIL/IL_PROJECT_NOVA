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

  useEffect(() => {
    const hasExternalSocket = !!externalSocket;

    if (!hasExternalSocket) {
      const socketUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
      localSocketRef.current = io(socketUrl, { autoConnect: true });
      console.log("[SYNC] Socket local cree (fallback)", socketUrl);
    }

    const activeSocket = externalSocket ?? localSocketRef.current;
    if (!activeSocket) return;

    const onPlaybackUpdated = (data: any) => {
      const action = data?.action;
      const positionSec = Number(data?.playback?.positionSec ?? 0);
      console.log("[SYNC] playback-updated recu", { action, positionSec, data });

      if (action === "seek") {
        // Liaison avec Zineb: pas de force_seek explicite dans le gateway actuel,
        // on utilise playback-updated/seek comme signal serveur pour seek global.
        setDernierSeekForce(positionSec);
        setEtatSync("BUFFERING");

        // TODO ZINEB/NADJIB: remplacer ce timeout par un vrai cycle ready/all_ready
        // si ces evenements sont exposes dans le gateway principal.
        window.setTimeout(() => {
          const status = data?.playback?.status;
          setEtatSync(status === "PLAYING" ? "PLAYING" : "PAUSED");
        }, 500);
      } else if (action === "play") {
        setEtatSync("PLAYING");
      } else if (action === "pause") {
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

    console.log("[SYNC] emit seek", { roomCode, timecode });
    activeSocket.emit("seek", {
      codeRoom: roomCode,
      positionSec: timecode,
      wasPlaying: true,
    });

    setDernierSeekForce(timecode);
    setEtatSync("BUFFERING");
  };

  const emitReady = () => {
    const activeSocket = externalSocket ?? localSocketRef.current;
    if (!activeSocket) return;

    // TODO ZINEB: gateway principal n expose pas ready actuellement.
    // On conserve l emit pour compatibilite si le protocole ready/all_ready revient.
    console.log("[SYNC] emit ready (compat)", { roomCode });
    activeSocket.emit("ready", { roomCode });
  };

  return { etatSync, dernierSeekForce, emitSeek, emitReady };
};
