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
  onModifierMarqueur?: (marqueur: Marqueur, data: { label?: string; timecode?: number; categorie?: Marqueur['categorie'] }) => Promise<void>;
  onSupprimerMarqueur?: (marqueur: Marqueur) => Promise<void>;
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
  onModifierMarqueur,
  onSupprimerMarqueur,
}: VideoPlayerProps) {

  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const playerRef = useRef<any>(null);
  const [duree, setDuree] = useState<number>(0);
  const seekingRef = useRef(false);
  const expectedTimeRef = useRef<number>(0);

  // Tab visibility: true when user recently switched tabs (grace period prevents
  // YouTube's spurious onPlay/onPause from propagating as real user actions)
  const tabSwitchingRef = useRef(false);
  const tabSwitchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const onVisChange = () => {
      tabSwitchingRef.current = true;
      if (tabSwitchTimerRef.current) clearTimeout(tabSwitchTimerRef.current);
      // 1.5s grace period: any onPlay/onPause within this window is from the browser, not user
      tabSwitchTimerRef.current = setTimeout(() => { tabSwitchingRef.current = false; }, 1500);
    };
    document.addEventListener('visibilitychange', onVisChange);
    return () => {
      document.removeEventListener('visibilitychange', onVisChange);
      if (tabSwitchTimerRef.current) clearTimeout(tabSwitchTimerRef.current);
    };
  }, []);

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
    // When we ENTER BUFFERING (force-pause received) and our player is NOT actually
    // buffering, we are immediately ready. Emit client-ready after a short delay.
    if (prevEtatSyncRef.current !== "BUFFERING" && etatSync === "BUFFERING") {
      if (!isBufferingRef.current) {
        console.log("[PLAYER] force-pause received but not buffering -> emitting client-ready");
        setTimeout(() => {
          // Re-check: still in BUFFERING and still not buffering
          if (etatSyncRef.current === "BUFFERING" && !isBufferingRef.current) {
            emitReadyRef.current();
          }
        }, 500);
      }
    }
    prevEtatSyncRef.current = etatSync;
  }, [etatSync]);

  // Also listen directly to all-ready on the socket — the buffering client's etatSync
  // may never transition through BUFFERING, so the above useEffect wouldn't fire for it.
  useEffect(() => {
    if (!syncSocket) return;
    const onAllReady = () => {
      lastAllReadyTimeRef.current = Date.now();
    };
    syncSocket.on('all-ready', onAllReady);
    return () => { syncSocket.off('all-ready', onAllReady); };
  }, [syncSocket]);

  // Buffering detection refs
  const bufferingEmittedRef = useRef(false);
  const lastAllReadyTimeRef = useRef(0);
  const isBufferingRef = useRef(false);

  // Poll YouTube's internal player state every 300ms to detect buffering (state=3).
  // ReactPlayer's onBuffer/onBufferEnd events are unreliable and often don't fire.
  useEffect(() => {
    let lastEmitTime = 0;

    const interval = setInterval(() => {
      if (!playerRef.current) return;
      const ip = playerRef.current.getInternalPlayer();
      if (!ip || typeof ip.getPlayerState !== 'function') return;

      const ytState = ip.getPlayerState();
      const isYTBuffering = ytState === 3;
      const wasBuf = isBufferingRef.current;
      isBufferingRef.current = isYTBuffering;

      // Currently buffering — try to report to server.
      // Re-emit every 2s in case the server rejected due to cooldown.
      if (isYTBuffering && etatSyncRef.current !== 'BUFFERING') {
        const now = Date.now();
        if (now - lastEmitTime > 2000) {
          lastEmitTime = now;
          const pos = playerRef.current?.getCurrentTime() ?? 0;
          console.log('[PLAYER] Poll: YouTube buffering (state=3) at', pos, '-> client-buffering');
          syncSocket?.emit('client-buffering', { codeRoom: roomId, positionSec: pos });
        }
      }

      // Transition OUT of buffering (state 3 -> something else)
      if (!isYTBuffering && wasBuf) {
        lastEmitTime = 0;
        if (etatSyncRef.current === 'BUFFERING') {
          console.log('[PLAYER] Poll: buffer ended (ytState:', ytState, ') -> client-ready');
          emitReadyRef.current();
        }
      }
    }, 300);

    return () => clearInterval(interval);
  }, [syncSocket, roomId]);

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
            onBuffer={() => { isBufferingRef.current = true; }}
            onBufferEnd={() => {
              isBufferingRef.current = false;
              const hadEmitted = bufferingEmittedRef.current;
              bufferingEmittedRef.current = false;
              if (etatSyncRef.current === "BUFFERING" || hadEmitted) {
                console.log("[PLAYER] onBufferEnd -> client-ready");
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
              // Ignore play events fired during tab switches (browser throttling).
              // YouTube auto-resumes when the tab regains focus — force it back to paused.
              if (tabSwitchingRef.current) {
                console.log("[PLAYER] onPlay ignored (tab switch) -> forcing pause back");
                const ip = playerRef.current?.getInternalPlayer();
                if (ip && typeof ip.pauseVideo === 'function') ip.pauseVideo();
                return;
              }
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
              // Ignore pause events fired during tab switches (browser throttling)
              if (tabSwitchingRef.current) {
                console.log("[PLAYER] onPause ignored (tab switch grace period)");
                return;
              }
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
        onModifierMarqueur={onModifierMarqueur}
        onSupprimerMarqueur={onSupprimerMarqueur}
      />
    </div>
  );
}
