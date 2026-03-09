"use client";

// VideoPlayer.tsx
// Composant principal du player video synchronise
// A placer dans : Front/app/components/VideoPlayer.tsx

import { useEffect, useRef, useState } from "react";
import ReactPlayer from "react-player";
import { useSync } from "../hooks/Usesync";
import { Socket } from "socket.io-client";
import { Marqueur } from "../types/types";
import VideoTimeline from "./VideoTimeline";

type VideoPlayerProps = {
  youtubeId: string;
  isPlaying: boolean;
  currentTime: number;
  roomId: string;
  syncSocket?: Socket | null;
  marqueurs: Marqueur[];
  // Index du marqueur actuel calcule dans RoomPage depuis position socket
  // Identique pour tous les users => marqueur en gras synchronise
  indexActuel: number;
  onProgress: (time: number) => void;
  onPlay: () => void;
  onPause: () => void;
  onSeek: (time: number) => void;
  onDuration: (duration: number) => void;
  onNouveauMarqueur?: (timecode: number) => void;
};

export default function VideoPlayer({
  youtubeId,
  isPlaying,
  currentTime,
  roomId,
  syncSocket,
  marqueurs,
  indexActuel,
  onProgress,
  onPlay,
  onPause,
  onSeek,
  onDuration,
  onNouveauMarqueur,
}: VideoPlayerProps) {

  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const playerRef = useRef<any>(null);
  const [duree, setDuree] = useState<number>(0);

  // indexActuel vient de RoomPage - plus d etat local ici
  // Cela garantit que tous les users voient le meme marqueur en gras

  const { etatSync, dernierSeekForce, emitSeek, emitReady } = useSync(roomId, syncSocket);

  useEffect(() => {
    if (etatSync === "BUFFERING" && dernierSeekForce !== null && playerRef.current) {
      console.log("[PLAYER] apply sync seek", { dernierSeekForce, etatSync });
      playerRef.current.seekTo(dernierSeekForce, "seconds");
    }
  }, [etatSync, dernierSeekForce]);

  useEffect(() => {
    if (playerRef.current && duree > 0) {
      const diff = Math.abs(playerRef.current.getCurrentTime() - currentTime);
      if (diff > 2) {
        playerRef.current.seekTo(currentTime, "seconds");
      }
    }
  }, [currentTime, duree]);

  // Clic sur un marqueur dans la timeline
  // indexActuel vient de RoomPage donc pas besoin de setter ici
  const handleClicMarqueur = (marqueur: Marqueur, index: number) => {
    emitSeek(marqueur.timecode);
    onSeek(marqueur.timecode);
  };

  const handlePoserMarqueur = () => {
    if (playerRef.current && onNouveauMarqueur) {
      const timecode = playerRef.current.getCurrentTime() ?? 0;
      onNouveauMarqueur(timecode);
    }
  };

  const url = `https://www.youtube.com/watch?v=${youtubeId}`;

  return (
    <div>
      {mounted && (
        <div style={{ position: "relative" }}>
          <ReactPlayer
            ref={playerRef}
            url={url}
            controls={false}
            width="100%"
            height="400px"
            playing={isPlaying}
            onReady={() => {
              const d = playerRef.current?.getDuration() ?? 0;
              setDuree(d);
              onDuration(d);
            }}
            onProgress={(state: any) => {
              onProgress(state.playedSeconds);
            }}
            onPlay={() => {
              if (etatSync === "BUFFERING") {
                emitReady();
              }
              onPlay();
            }}
            // Pas de onPause ici pour eviter le double emit avec le bouton RoomPage
            onPause={() => {}}
            onError={(e: any) => console.error("Erreur player:", e)}
          />

          {etatSync === "BUFFERING" && (
            <div style={{
              position: "absolute",
              top: 0, left: 0, right: 0, bottom: 0,
              background: "rgba(0,0,0,0.5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              fontSize: "18px",
            }}>
              En attente des autres utilisateurs...
            </div>
          )}
        </div>
      )}

      <VideoTimeline
        duree={duree}
        marqueurs={marqueurs}
        indexActuel={indexActuel}
        onClicMarqueur={handleClicMarqueur}
        onPoserMarqueur={handlePoserMarqueur}
      />
    </div>
  );
}