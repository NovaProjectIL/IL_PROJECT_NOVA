'use client';
import { useEffect, useRef, useState } from 'react';
import ReactPlayer from 'react-player';

const Player = ReactPlayer as any; // ← bypass broken typings entirely

interface OnProgressProps {
  played: number;
  playedSeconds: number;
  loaded: number;
  loadedSeconds: number;
}

interface VideoPlayerProps {
  youtubeId: string;
  isPlaying: boolean;
  currentTime: number;
  onProgress: (time: number) => void;
  onPlay: () => void;
  onPause: () => void;
  onSeek: (time: number) => void;
  onDuration: (duration: number) => void;
}

export default function VideoPlayer({
  youtubeId,
  isPlaying,
  currentTime,
  onProgress,
  onPlay,
  onPause,
  onSeek,
  onDuration,
}: VideoPlayerProps) {
  const playerRef = useRef<any>(null);
  const [isReady, setIsReady] = useState(false);
  const [isSeeking, setIsSeeking] = useState(false);

  useEffect(() => {
    if (isReady && !isSeeking && playerRef.current) {
      const currentPlayerTime: number = playerRef.current.getCurrentTime();
      if (Math.abs(currentPlayerTime - currentTime) > 0.5) {
        playerRef.current.seekTo(currentTime, 'seconds');
      }
    }
  }, [currentTime, isReady, isSeeking]);

  return (
    <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9' }}>
      {/* ✅ CORRECTION : Le div overlay a été SUPPRIMÉ.
          Il masquait la vidéo et bloquait les interactions natives YouTube.
          Le contrôle play/pause est désormais géré par les boutons dédiés
          dans la barre de contrôle (handlePlay / handlePause). */}

      <Player
        ref={playerRef}
        url={`https://www.youtube.com/watch?v=${youtubeId}`}
        width="100%"
        height="100%"
        playing={isPlaying}
        controls={true} // ✅ CORRECTION : était false, empêchait l'affichage de la vidéo
        progressInterval={1000}
        onReady={() => setIsReady(true)}
        onPlay={onPlay}
        onPause={onPause}
        onSeek={(seconds: number) => {
          setIsSeeking(false);
          onSeek(seconds);
        }}
        onProgress={(state: OnProgressProps) => {
          if (!isSeeking) {
            onProgress(state.playedSeconds);
          }
        }}
        onDuration={onDuration}
        config={{
          youtube: {
            playerVars: {
              modestbranding: 1,
              rel: 0,
              showinfo: 0,
            },
          },
        }}
      />
    </div>
  );
}