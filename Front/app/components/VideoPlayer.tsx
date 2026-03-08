'use client';
import { useEffect, useRef, useState, useMemo } from 'react';
import dynamic from 'next/dynamic';

// Use dynamic import to ensure ReactPlayer only runs on the client
const ReactPlayer = dynamic(() => import('react-player'), { 
  ssr: false,
  loading: () => <div style={{ width: '100%', height: '100%', backgroundColor: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>Chargement du lecteur...</div>
});

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
  const [internalIsLoading, setInternalIsLoading] = useState(true);

  // Sync position from parent
  useEffect(() => {
    if (isReady && !isSeeking && playerRef.current) {
      // ✅ FIX: Verify method existence before calling
      if (typeof playerRef.current.getCurrentTime !== 'function') {
        console.warn('[DEBUG] VideoPlayer: getCurrentTime is not yet a function');
        return;
      }

      const currentPlayerTime = playerRef.current.getCurrentTime();
      if (Math.abs(currentPlayerTime - currentTime) > 3) {
        if (Date.now() - lastSeekRef.current < 2000) return;
        lastSeekRef.current = Date.now();
        console.log('[DEBUG] VideoPlayer: Force seeking to', currentTime);
        playerRef.current.seekTo(currentTime, 'seconds');
      }
    }
  }, [currentTime, isReady, isSeeking]);

  const handleReady = () => {
    console.log('[DEBUG] VideoPlayer: onReady fired');
    setIsReady(true);
    setInternalIsLoading(false);
    onReadyToPlay?.();
  };

  const handlePlay = () => {
    console.log('[DEBUG] VideoPlayer: onPlay fired');
    setInternalIsLoading(false);
    // Fallback handshake
    if (!isReady) {
      setIsReady(true);
      onReadyToPlay?.();
    }
    onPlay();
  };

  const handleError = (e: any) => {
    console.error('[DEBUG] VideoPlayer: onError fired', e);
    setError('Erreur de lecture ou vidéo bloquée.');
    setInternalIsLoading(false);
  };

  const videoUrl = useMemo(() => {
    return youtubeId ? `https://www.youtube.com/watch?v=${youtubeId}` : '';
  }, [youtubeId]);

  if (!youtubeId) return <div style={{width:'100%', height:'100%', background:'#111'}} />;

  return (
    <div style={{ position: 'absolute', inset: 0, backgroundColor: '#000' }}>
      {error && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', zIndex: 30, background: '#1a1a1a', textAlign: 'center', padding: '20px' }}>
          <div>⚠️ {error}<br/><small>ID: {youtubeId}</small></div>
        </div>
      )}
      
      {internalIsLoading && !error && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000', zIndex: 20 }}>
          <div className="video-spinner" />
        </div>
      )}

      <ReactPlayer
        key={youtubeId}
        ref={playerRef}
        url={videoUrl}
        width="100%"
        height="100%"
        playing={isPlaying}
        controls={true}
        onReady={handleReady}
        onPlay={handlePlay}
        onPause={onPause}
        onError={handleError}
        onBuffer={() => {
          console.log('[DEBUG] VideoPlayer: onBuffer');
          onBuffering?.();
        }}
        onBufferEnd={() => {
          console.log('[DEBUG] VideoPlayer: onBufferEnd');
          setIsReady(true);
          onReadyToPlay?.();
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
              origin: typeof window !== 'undefined' ? window.location.origin : '',
            }
          }
        }}
      />
      <style jsx>{`
        .video-spinner {
          width: 40px;
          height: 40px;
          border: 3px solid rgba(255,255,255,0.2);
          border-top-color: #fff;
          border-radius: 50%;
          animation: vspin 1s linear infinite;
        }
        @keyframes vspin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
