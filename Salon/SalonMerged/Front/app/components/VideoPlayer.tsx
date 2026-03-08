'use client';

import { useEffect, useRef, useState } from 'react';
import ReactPlayer from 'react-player';

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
  onDuration
}: VideoPlayerProps) {
  const playerRef = useRef<ReactPlayer>(null);
  const [isReady, setIsReady] = useState(false);
  const [isSeeking, setIsSeeking] = useState(false);

  // Quand la prop currentTime change (seek externe)
  useEffect(() => {
    if (isReady && !isSeeking && playerRef.current) {
      const player = playerRef.current;
      const currentPlayerTime = player.getCurrentTime();
      
      if (Math.abs(currentPlayerTime - currentTime) > 0.5) {
        player.seekTo(currentTime, 'seconds');
      }
    }
  }, [currentTime, isReady, isSeeking]);

  return (
    <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9' }}>
      {/* Safe Zone - Zone cliquable transparente au-dessus de la vidéo */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          zIndex: 10,
          cursor: 'pointer',
          // Rendre visible pour le développement (à enlever plus tard)
          backgroundColor: 'rgba(255,0,0,0.1)'
        }}
        onClick={() => {
          if (isPlaying) {
            onPause();
          } else {
            onPlay();
          }
        }}
        title="Cliquez pour play/pause"
      />
      
      {/* ReactPlayer sans contrôles natifs */}
      <ReactPlayer
        ref={playerRef}
        url={`https://www.youtube.com/watch?v=${youtubeId}`}
        width="100%"
        height="100%"
        playing={isPlaying}
        controls={false}  // ← Désactive les contrôles natifs
        progressInterval={1000}
        onReady={() => setIsReady(true)}
        onPlay={onPlay}
        onPause={onPause}
        onSeek={(seconds) => {
          setIsSeeking(false);
          onSeek(seconds);
        }}
        onProgress={({ playedSeconds }) => {
          if (!isSeeking) {
            onProgress(playedSeconds);
          }
        }}
        onDuration={onDuration}
        config={{
          youtube: {
            playerVars: {
              modestbranding: 1,
              rel: 0,
              showinfo: 0
            }
          }
        }}
      />
    </div>
  );
}