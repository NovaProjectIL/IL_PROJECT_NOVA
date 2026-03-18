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
// - Wait-for-Ready: gateway emet "force-seek" puis attend "client-ready" de tous
//   avant emitting "all-ready" to resume
export const useSync = (
  roomCode: string,
  externalSocket?: Socket | null,
): UseSync => {
  const [etatSync, setEtatSync] = useState<EtatSync>("IDLE");
  const [dernierSeekForce, setDernierSeekForce] = useState<number | null>(null);
  const localSocketRef = useRef<Socket | null>(null);
  const lastPlaybackStateRef = useRef<"PLAYING" | "PAUSED">("PAUSED");

  const etatSyncRef = useRef<EtatSync>("IDLE");

  useEffect(() => {
    const hasExternalSocket = !!externalSocket;

    if (!hasExternalSocket) {
      const socketUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
      localSocketRef.current = io(socketUrl, { autoConnect: true });
      console.log("[SYNC] Socket local cree (fallback)", socketUrl);

      localSocketRef.current.on("connect", () => {
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

      if (action === "play") {
        // Don't override BUFFERING — the LOADING flow (force-seek/force-pause) takes priority
        if (etatSyncRef.current === "BUFFERING") {
          console.log("[SYNC] play ignored (currently BUFFERING)");
          return;
        }
        lastPlaybackStateRef.current = "PLAYING";
        setEtatSync("PLAYING");
        etatSyncRef.current = "PLAYING";
      } else if (action === "pause") {
        // Don't override BUFFERING — the LOADING flow takes priority
        if (etatSyncRef.current === "BUFFERING") {
          console.log("[SYNC] pause ignored (currently BUFFERING)");
          return;
        }
        lastPlaybackStateRef.current = "PAUSED";
        setEtatSync("PAUSED");
        etatSyncRef.current = "PAUSED";
      }
      // Note: seek is NOT handled here anymore — force-seek + all-ready handle the full seek flow
    };

    // Wait-for-Ready: server sends force-seek when someone seeks
    // Client must seek player then emit "client-ready" when buffered
    const onForceSeek = (data: any) => {
      const timecode = Number(data?.timecode ?? 0);
      console.log("[SYNC] force-seek recu", { timecode, data });
      setDernierSeekForce(timecode);
      setEtatSync("BUFFERING");
      etatSyncRef.current = "BUFFERING";
      // Remember what state we should return to after all-ready
      if (data?.wasPlaying) {
        lastPlaybackStateRef.current = "PLAYING";
      } else {
        lastPlaybackStateRef.current = "PAUSED";
      }
    };

    // Wait-for-Ready: all clients buffered, resume playback
    const onAllReady = (data: any) => {
      const positionSec = Number(data?.positionSec ?? 0);
      const shouldPlay = data?.shouldPlay !== false;
      console.log("[SYNC] all-ready recu", { positionSec, shouldPlay });
      lastPlaybackStateRef.current = shouldPlay ? "PLAYING" : "PAUSED";
      const newState = shouldPlay ? "PLAYING" : "PAUSED";
      setEtatSync(newState);
      etatSyncRef.current = newState;
    };

    // A remote client started buffering: server tells us to pause and wait
    const onForcePause = (data: any) => {
      console.log("[SYNC] force-pause recu (client buffering)", data);
      setEtatSync("BUFFERING");
      etatSyncRef.current = "BUFFERING";
    };

    activeSocket.on("playback-updated", onPlaybackUpdated);
    activeSocket.on("force-seek", onForceSeek);
    activeSocket.on("force-pause", onForcePause);
    activeSocket.on("all-ready", onAllReady);

    return () => {
      activeSocket.off("playback-updated", onPlaybackUpdated);
      activeSocket.off("force-seek", onForceSeek);
      activeSocket.off("force-pause", onForcePause);
      activeSocket.off("all-ready", onAllReady);
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
    etatSyncRef.current = "BUFFERING";
  };

  const emitReady = () => {
    const activeSocket = externalSocket ?? localSocketRef.current;
    if (!activeSocket) return;

    console.log("[SYNC] emit client-ready", { roomCode });
    activeSocket.emit("client-ready", { codeRoom: roomCode });
  };

  return { etatSync, dernierSeekForce, emitSeek, emitReady };
};
