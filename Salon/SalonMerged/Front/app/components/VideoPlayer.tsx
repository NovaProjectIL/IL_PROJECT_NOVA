"use client";

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
  const isProgrammaticSeek = useRef(false);
  const lastKnownTime = useRef<number>(0);

  const { etatSync, emitReady } = useSync(roomId, syncSocket);

  // Detect user seeks by polling getCurrentTime (YouTube has no native onSeek event)
  useEffect(() => {
    const interval = setInterval(() => {
      if (!playerRef.current || isProgrammaticSeek.current) return;
      const time = playerRef.current.getCurrentTime();
      if (time == null) return;

      const diff = Math.abs(time - lastKnownTime.current);
      if (diff > 2 && lastKnownTime.current > 0) {
        console.log("[PLAYER] Seek detected via polling:", lastKnownTime.current, "->", time);
        onSeek(time);
      }
      lastKnownTime.current = time;
    }, 500);

    return () => clearInterval(interval);
  }, [onSeek]);

  // Sync position if it drifts too much from the master time
  useEffect(() => {
    if (playerRef.current && duree > 0) {
      const playerTime = playerRef.current.getCurrentTime();
      const diff = Math.abs(playerTime - currentTime);
      if (diff > 1) {
        console.log("[PLAYER] Drift detected, seeking to", currentTime);
        isProgrammaticSeek.current = true;
        lastKnownTime.current = currentTime;
        playerRef.current.seekTo(currentTime, "seconds");
        setTimeout(() => { isProgrammaticSeek.current = false; }, 500);
      }
    }
  }, [currentTime, duree]);

  // Imperative play/pause fallback: ensures the YouTube player
  // actually obeys the isPlaying prop even when native controls are active
  useEffect(() => {
    if (!playerRef.current) return;
    const internalPlayer = playerRef.current.getInternalPlayer();
    if (!internalPlayer || typeof internalPlayer.getPlayerState !== 'function') return;

    // Small delay to let ReactPlayer's own prop handling run first
    const timer = setTimeout(() => {
      const state = internalPlayer.getPlayerState();
      // YouTube states: 1=playing, 2=paused
      if (isPlaying && state === 2) {
        console.log("[PLAYER] Forcing playVideo (prop sync fallback)");
        internalPlayer.playVideo();
      } else if (!isPlaying && state === 1) {
        console.log("[PLAYER] Forcing pauseVideo (prop sync fallback)");
        internalPlayer.pauseVideo();
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [isPlaying]);

  const handleClicMarqueur = (marqueur: Marqueur) => {
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
            controls={true} // Enable controls so users can interact directly
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
              if (etatSync === "BUFFERING") emitReady();
              onPlay();
            }}
            onPause={() => {
              onPause();
            }}
            onError={(e: any) => console.error("Erreur player:", e)}
          />
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