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
  const seekingRef = useRef(false);
  const expectedTimeRef = useRef<number>(0);

  const { etatSync, emitReady } = useSync(roomId, syncSocket);

  // Detect user seeks while PAUSED (no onProgress fires, so we poll)
  useEffect(() => {
    if (isPlaying) return; // Only poll while paused
    const interval = setInterval(() => {
      if (!playerRef.current || seekingRef.current) return;
      const time = playerRef.current.getCurrentTime();
      if (time == null) return;
      const diff = Math.abs(time - expectedTimeRef.current);
      if (diff > 2 && expectedTimeRef.current > 0) {
        console.log("[PLAYER] Paused seek detected:", expectedTimeRef.current, "->", time);
        seekingRef.current = true;
        expectedTimeRef.current = time;
        onSeek(time);
        setTimeout(() => { seekingRef.current = false; }, 800);
      }
    }, 400);
    return () => clearInterval(interval);
  }, [isPlaying, onSeek]);

  // Force-seek the player when currentTime changes significantly (remote sync)
  useEffect(() => {
    if (!playerRef.current || duree <= 0) return;
    const playerTime = playerRef.current.getCurrentTime();
    const diff = Math.abs(playerTime - currentTime);
    if (diff > 1.5) {
      console.log("[PLAYER] Remote sync seeking to", currentTime, "(was at", playerTime, ")");
      seekingRef.current = true;
      expectedTimeRef.current = currentTime;
      playerRef.current.seekTo(currentTime, "seconds");
      setTimeout(() => { seekingRef.current = false; }, 800);
    }
  }, [currentTime, duree]);

  // Imperative play/pause fallback
  useEffect(() => {
    if (!playerRef.current) return;
    const internalPlayer = playerRef.current.getInternalPlayer();
    if (!internalPlayer || typeof internalPlayer.getPlayerState !== 'function') return;
    const timer = setTimeout(() => {
      const state = internalPlayer.getPlayerState();
      if (isPlaying && state === 2) {
        console.log("[PLAYER] Forcing playVideo");
        internalPlayer.playVideo();
      } else if (!isPlaying && state === 1) {
        console.log("[PLAYER] Forcing pauseVideo");
        internalPlayer.pauseVideo();
      }
    }, 300);
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
              if (!seekingRef.current) {
                expectedTimeRef.current = state.playedSeconds;
                onProgress(state.playedSeconds);
              }
            }}
            onPlay={() => {
              if (seekingRef.current) return;
              if (etatSync === "BUFFERING") emitReady();
              onPlay();
            }}
            onPause={() => {
              if (seekingRef.current) return;
              // Detect seeks while playing: YouTube pauses internally when
              // the user drags the seekbar. Check if position jumped.
              const actualTime = playerRef.current?.getCurrentTime() ?? 0;
              const diff = Math.abs(actualTime - expectedTimeRef.current);
              if (diff > 2) {
                // This is a seek, not a real pause
                console.log("[PLAYER] Playing seek detected via onPause:", expectedTimeRef.current, "->", actualTime);
                seekingRef.current = true;
                expectedTimeRef.current = actualTime;
                onSeek(actualTime);
                setTimeout(() => { seekingRef.current = false; }, 800);
              } else {
                onPause();
              }
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