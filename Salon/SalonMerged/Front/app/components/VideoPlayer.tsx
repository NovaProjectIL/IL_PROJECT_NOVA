'use client';
import { useEffect, useRef, useState } from 'react';
import ReactPlayer from 'react-player';

const Player = ReactPlayer as any;

interface VideoPlayerProps {
  youtubeId: string;
  isPlaying: boolean;
  currentTime: number;
  onProgress: (time: number) => void;
  onPlay: () => void;
  onPause: () => void;
  onSeek: (time: number) => void;
  onDuration: (duration: number) => void;
  onReadyToPlay?: () => void;
  onBuffering?: () => void;
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
  onReadyToPlay,
  onBuffering,
}: VideoPlayerProps) {
  const playerRef = useRef<any>(null);
  const lastSeekRef = useRef<number>(0);
  const [isReady, setIsReady] = useState(false);
  const [isSeeking, setIsSeeking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fallback origin logic
  const getOrigin = () => {
    if (typeof window !== 'undefined') return window.location.origin;
    return '';
  };

  // Seeker logic
  useEffect(() => {
    if (isReady && !isSeeking && playerRef.current) {
      const currentPlayerTime = playerRef.current.getCurrentTime();
      if (Math.abs(currentPlayerTime - currentTime) > 2.5) {
        if (Date.now() - lastSeekRef.current < 1500) return;
        lastSeekRef.current = Date.now();
        console.log('[DEBUG] VideoPlayer: External sync seek to', currentTime);
        playerRef.current.seekTo(currentTime, 'seconds');
      }
    }
  }, [currentTime, isReady, isSeeking]);

  const handleReady = () => {
    if (isReady) return;
    console.log('[DEBUG] VideoPlayer: onReady fired');
    setIsReady(true);
    setIsLoading(false);
    onReadyToPlay?.();
  };

  const handlePlay = () => {
    console.log('[DEBUG] VideoPlayer: onPlay fired');
    setIsLoading(false);
    // FALLBACK: si onPlay arrive avant onReady, on force le ready
    if (!isReady) {
      console.log('[DEBUG] VideoPlayer: Forcing isReady via onPlay fallback');
      setIsReady(true);
      onReadyToPlay?.();
    }
    onPlay();
  };

  const handleError = (e: any) => {
    console.error('[DEBUG] VideoPlayer: onError fired', e);
    setError('Vidéo indisponible ou erreur de lecture.');
    setIsLoading(false);
  };

  if (!youtubeId) return <div style={{width:'100%',height:'100%',background:'#000'}} />;

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', backgroundColor: '#000' }}>
      {error && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', zIndex: 20, background: '#1a1a1a', textAlign: 'center', padding: '20px' }}>
          <div>⚠️ {error}<br/><small>ID: {youtubeId}</small></div>
        </div>
      )}
      
      {isLoading && !error && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000', zIndex: 10 }}>
          <div className="spinner" />
        </div>
      )}

      <Player
        key={youtubeId}
        ref={playerRef}
        url={`https://www.youtube.com/watch?v=${youtubeId}`}
        width="100%"
        height="100%"
        playing={isPlaying}
        controls={true}
        onReady={handleReady}
        onPlay={handlePlay}
        onPause={onPause}
        onError={handleError}
        onBuffer={() => {
          console.log('[DEBUG] VideoPlayer: onBuffer fired');
          onBuffering?.();
        }}
        onBufferEnd={() => {
          console.log('[DEBUG] VideoPlayer: onBufferEnd fired');
          handleReady();
        }}
        onProgress={(state: any) => {
          if (!isSeeking) onProgress(state.playedSeconds);
        }}
        onDuration={onDuration}
        config={{
          youtube: {
            playerVars: {
              autoplay: 1,
              modestbranding: 1,
              rel: 0,
              origin: getOrigin(),
            }
          }
        }}
      />
      <style jsx>{`
        .spinner {
          width: 40px;
          height: 40px;
          border: 3px solid rgba(255,255,255,0.3);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

