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

  // Stable refs for callbacks — prevent useEffect restarts on re-render
  const onSeekRef = useRef(onSeek);
  onSeekRef.current = onSeek;
  const onPlayRef = useRef(onPlay);
  onPlayRef.current = onPlay;
  const onPauseRef = useRef(onPause);
  onPauseRef.current = onPause;

  const { etatSync, emitReady } = useSync(roomId, syncSocket);

  // Closure-safe refs — always current in async YouTube callbacks
  const etatSyncRef = useRef(etatSync);
  etatSyncRef.current = etatSync;
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;
  const emitReadyRef = useRef(emitReady);
  emitReadyRef.current = emitReady;

  // Track when we exit BUFFERING state (all-ready received) to prevent cascade
  const prevEtatSyncRef = useRef(etatSync);
  useEffect(() => {
    if (prevEtatSyncRef.current === "BUFFERING" && etatSync !== "BUFFERING") {
      lastAllReadyTimeRef.current = Date.now();
    }
    prevEtatSyncRef.current = etatSync;
  }, [etatSync]);

  // When the YouTube player starts buffering mid-playback, notify the server
  // so it can pause other clients and wait for everyone to be ready.
  const bufferingEmittedRef = useRef(false);
  const lastAllReadyTimeRef = useRef(0);
  const handleBuffer = () => {
    if (!isPlayingRef.current) return; // Don't report buffering when player is paused
    if (seekingRef.current) return; // Don't signal during an active seek (handled by seek flow)
    if (bufferingEmittedRef.current) return; // Already signaled for this buffering episode
    if (etatSyncRef.current === "BUFFERING") return; // Already in LOADING flow
    // Anti-cascade: don't emit client-buffering within 3s of receiving all-ready
    if (Date.now() - lastAllReadyTimeRef.current < 3000) return;
    bufferingEmittedRef.current = true;
    const currentPos = playerRef.current?.getCurrentTime() ?? 0;
    console.log("[PLAYER] Buffering detected at", currentPos, "-> emitting client-buffering");
    syncSocket?.emit('client-buffering', { codeRoom: roomId, positionSec: currentPos });
  };

  // Detect user seeks while PAUSED (no onProgress fires, so we poll)
  useEffect(() => {
    if (isPlaying) return; // Only poll while paused
    const interval = setInterval(() => {
      if (!playerRef.current || seekingRef.current) return;
      const time = playerRef.current.getCurrentTime();
      if (time == null) return;
      const diff = Math.abs(time - expectedTimeRef.current);
      if (diff > 2) {
        console.log("[PLAYER] Paused seek detected:", expectedTimeRef.current, "->", time);
        seekingRef.current = true;
        expectedTimeRef.current = time;
        onSeekRef.current(time);
        setTimeout(() => { seekingRef.current = false; }, 800);
      }
    }, 400);
    return () => clearInterval(interval);
  }, [isPlaying]);

  // Force-seek the player when currentTime changes significantly (remote sync)
  // Also re-checks when isPlaying changes (e.g., all-ready) to catch position drift
  useEffect(() => {
    if (!playerRef.current || duree <= 0) return;
    const playerTime = playerRef.current.getCurrentTime();
    const diff = Math.abs(playerTime - currentTime);
    if (diff > 1.5) {
      console.log("[PLAYER] Remote sync seeking to", currentTime, "(was at", playerTime, ")");
      seekingRef.current = true;
      playerRef.current.seekTo(currentTime, "seconds");
      // After seeking completes, signal ready to server
      setTimeout(() => {
        seekingRef.current = false;
        if (etatSyncRef.current === "BUFFERING") {
          console.log("[PLAYER] Seek complete, emitting client-ready");
          emitReadyRef.current();
        }
      }, 800);
    }
    // Always keep expectedTimeRef aligned with React state
    expectedTimeRef.current = currentTime;
  }, [currentTime, duree, isPlaying]);

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
              // Signal ready when player initially loads
              emitReadyRef.current();
            }}
            onBuffer={handleBuffer}
            onBufferEnd={() => {
              const hadEmittedBuffering = bufferingEmittedRef.current;
              bufferingEmittedRef.current = false;
              // Buffer finished -> this client is ready
              // Emit client-ready if: (a) server told us we're in LOADING (etatSync=BUFFERING)
              // OR (b) WE were the one who triggered the LOADING (we emitted client-buffering)
              if (etatSyncRef.current === "BUFFERING" || hadEmittedBuffering) {
                console.log("[PLAYER] Buffer ended -> emitting client-ready (etatSync:", etatSyncRef.current, "hadEmitted:", hadEmittedBuffering, ")");
                emitReadyRef.current();
              }
            }}
            onProgress={(state: any) => {
              if (!seekingRef.current) {
                expectedTimeRef.current = state.playedSeconds;
                onProgress(state.playedSeconds);
              }
            }}
            onPlay={() => {
              // If React already told YouTube to play, this is an echo, not a user action
              if (isPlayingRef.current) return;
              if (seekingRef.current) return;
              if (etatSyncRef.current === "BUFFERING") {
                // During wait-for-ready, don't propagate play - just signal ready
                console.log("[PLAYER] onPlay during BUFFERING - emitting ready");
                emitReadyRef.current();
                return;
              }
              onPlayRef.current();
            }}
            onPause={() => {
              // If React already told YouTube to pause, this is an echo, not a user action
              if (!isPlayingRef.current) return;
              if (seekingRef.current) return;
              // During LOADING/BUFFERING, ignore all pause events — they come from
              // force-seek or force-pause, not from user interaction
              if (etatSyncRef.current === "BUFFERING") return;
              // Detect seeks while playing: YouTube pauses internally when
              // the user drags the seekbar. Check if position jumped.
              const actualTime = playerRef.current?.getCurrentTime() ?? 0;
              const diff = Math.abs(actualTime - expectedTimeRef.current);
              if (diff > 2) {
                // This is a seek, not a real pause
                console.log("[PLAYER] Playing seek detected via onPause:", expectedTimeRef.current, "->", actualTime);
                seekingRef.current = true;
                expectedTimeRef.current = actualTime;
                onSeekRef.current(actualTime);
                setTimeout(() => { seekingRef.current = false; }, 800);
              } else {
                onPauseRef.current();
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