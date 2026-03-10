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

      if (action === "seek") {
        // Seek is now handled by force-seek; keep this for backward compat
        // but don't override if we're already in BUFFERING from force-seek
        if (etatSync !== "BUFFERING") {
          setDernierSeekForce(positionSec);
          setEtatSync("BUFFERING");
        }
      } else if (action === "play") {
        lastPlaybackStateRef.current = "PLAYING";
        setEtatSync("PLAYING");
      } else if (action === "pause") {
        lastPlaybackStateRef.current = "PAUSED";
        setEtatSync("PAUSED");
      }
    };

    // Wait-for-Ready: server sends force-seek when someone seeks
    // Client must seek player then emit "client-ready" when buffered
    const onForceSeek = (data: any) => {
      const timecode = Number(data?.timecode ?? 0);
      console.log("[SYNC] force-seek recu", { timecode, data });
      setDernierSeekForce(timecode);
      setEtatSync("BUFFERING");
      // Remember what state we should return to after all-ready
      if (data?.status === "PLAYING") {
        lastPlaybackStateRef.current = "PLAYING";
      }
    };

    // Wait-for-Ready: all clients buffered, resume playback
    const onAllReady = (data: any) => {
      const positionSec = Number(data?.positionSec ?? 0);
      console.log("[SYNC] all-ready recu - resuming at", positionSec);
      lastPlaybackStateRef.current = "PLAYING";
      setEtatSync("PLAYING");
    };

    activeSocket.on("playback-updated", onPlaybackUpdated);
    activeSocket.on("force-seek", onForceSeek);
    activeSocket.on("all-ready", onAllReady);

    return () => {
      activeSocket.off("playback-updated", onPlaybackUpdated);
      activeSocket.off("force-seek", onForceSeek);
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
  };

  const emitReady = () => {
    const activeSocket = externalSocket ?? localSocketRef.current;
    if (!activeSocket) return;

    console.log("[SYNC] emit client-ready", { roomCode });
    activeSocket.emit("client-ready", { codeRoom: roomCode });
  };

  return { etatSync, dernierSeekForce, emitSeek, emitReady };
};
