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
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          zIndex: 10,
          cursor: 'pointer',
          backgroundColor: 'transparent',  // au lieu de 'rgba(255,0,0,0.1)'
        }}
        onClick={() => (isPlaying ? onPause() : onPlay())}
        title="Cliquez pour play/pause"
      />

      <Player
        ref={playerRef}
        url={`https://www.youtube.com/watch?v=${youtubeId}`}
        width="100%"
        height="100%"
        playing={isPlaying}
        controls={false}
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