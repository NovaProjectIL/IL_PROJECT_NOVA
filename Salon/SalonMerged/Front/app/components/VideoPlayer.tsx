'use client';
import { useEffect, useRef, useState } from 'react';
import ReactPlayer from 'react-player';

const Player = ReactPlayer as any;

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
  onReadyToPlay?: () => void;
  onBuffering?: () => void;
}

// Fallback origin URL for production/ngrok
const FALLBACK_ORIGIN = 'https://vulgarly-unforcible-loura.ngrok-free.dev';

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

  // Get the current origin safely
  const getOrigin = () => {
    if (typeof window !== 'undefined' && window.location.origin) {
      return window.location.origin;
    }
    return FALLBACK_ORIGIN;
  };

  const getWidgetReferrer = () => {
    if (typeof window !== 'undefined' && window.location.href) {
      return window.location.href;
    }
    return FALLBACK_ORIGIN;
  };

  useEffect(() => {
    if (isReady && !isSeeking && playerRef.current) {
      try {
        const currentPlayerTime: number = playerRef.current.getCurrentTime();
        // Seuil à 1.5 seconde pour moins de seeks inutiles et éviter les boucles
        if (Math.abs(currentPlayerTime - currentTime) > 1.5) {
          // Guard: vérifier que les seeks ne sont pas trop rapprochés (800ms)
          if (Date.now() - lastSeekRef.current < 800) {
            return;
          }
          lastSeekRef.current = Date.now();
          playerRef.current.seekTo(currentTime, 'seconds');
        }
      } catch (e) {
        console.error('Error seeking:', e);
      }
    }
  }, [currentTime, isReady, isSeeking]);

  const handleReady = () => {
    setIsReady(true);
    setIsLoading(false);
    setError(null);
    console.log('VideoPlayer: Player is ready');
    onReadyToPlay?.();
  };

  const handleError = (e: any) => {
    console.error('Player error:', e);
    setError('Erreur de chargement de la vidéo. La vidéo peut être restreinte ou non disponible.');
    setIsLoading(false);
  };

  // Timeout de sécurité (5 secondes max pour disparaître le spinner)
  useEffect(() => {
    if (!isLoading) return;
    const timeout = setTimeout(() => {
      setIsLoading(false);
    }, 5000);
    return () => clearTimeout(timeout);
  }, [isLoading]);

  return (
    <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', backgroundColor: '#000' }}>
      {error ? (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#1a1a1a',
          color: 'white',
          padding: '20px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
          <p style={{ margin: 0, fontSize: '16px' }}>{error}</p>
          <p style={{ marginTop: '12px', fontSize: '14px', opacity: 0.7 }}>
            ID Vidéo: {youtubeId}
          </p>
        </div>
      ) : (
        <>
          {isLoading && (
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#000',
              zIndex: 10
            }}>
              <div style={{
                width: '40px',
                height: '40px',
                border: '3px solid rgba(255,255,255,0.3)',
                borderTopColor: '#fff',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }} />
            </div>
          )}
          <Player
            ref={playerRef}
            url={`https://www.youtube.com/watch?v=${youtubeId}`}
            width="100%"
            height="100%"
            playing={isPlaying}
            controls={true}
            progressInterval={1000}
            onReady={handleReady}
            onPlay={() => {
              setIsLoading(false);
              onPlay();
            }}
            onPause={onPause}
            onError={handleError}
            onBuffer={() => {
              setIsLoading(true);
              onBuffering?.();
            }}
            onBufferEnd={() => {
              setIsLoading(false);
              onReadyToPlay?.();
            }}
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
                  enablejsapi: 1,
                  origin: getOrigin(),
                  widget_referrer: getWidgetReferrer(),
                  modestbranding: 1,
                  rel: 0,
                  showinfo: 0,
                  playsinline: 1,
                  fs: 1,
                  frameborder: 0,
                },
                preload: true,
              },
            }}
            style={{ opacity: isLoading ? 0.5 : 1 }}
          />
        </>
      )}
      <style jsx>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

