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

  console.log('[DEBUG] VideoPlayer Props:', { youtubeId, isPlaying, currentTime, isReady, isLoading });

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
        // Seuil plus large pour éviter les seeks incessants (2s)
        if (Math.abs(currentPlayerTime - currentTime) > 2) {
          if (Date.now() - lastSeekRef.current < 1000) {
            return;
          }
          lastSeekRef.current = Date.now();
          console.log('[DEBUG] VideoPlayer: Seeking to', currentTime);
          playerRef.current.seekTo(currentTime, 'seconds');
        }
      } catch (e) {
        console.error('Error seeking:', e);
      }
    }
  }, [currentTime, isReady, isSeeking]);

  const handleReady = () => {
    console.log('[DEBUG] VideoPlayer: onReady fired');
    setIsReady(true);
    setIsLoading(false);
    setError(null);
    onReadyToPlay?.();
  };

  const handleError = (e: any) => {
    console.error('[DEBUG] VideoPlayer: onError fired', e);
    setError('Erreur de chargement de la vidéo. La vidéo peut être restreinte ou non disponible.');
    setIsLoading(false);
  };

  useEffect(() => {
    if (!isLoading) return;
    const timeout = setTimeout(() => {
      console.log('[DEBUG] VideoPlayer: Security timeout for isLoading fired');
      setIsLoading(false);
    }, 6000);
    return () => clearTimeout(timeout);
  }, [isLoading]);

  if (!youtubeId) {
    return (
      <div style={{ width: '100%', aspectRatio: '16/9', backgroundColor: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
        <p>Aucune vidéo sélectionnée</p>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', backgroundColor: '#000', opacity: isLoading ? 0.7 : 1, transition: 'opacity 0.3s ease' }}>
      {error ? (
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          backgroundColor: '#1a1a1a', color: 'white', padding: '20px', textAlign: 'center', zIndex: 5
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
          <p style={{ margin: 0, fontSize: '16px' }}>{error}</p>
          <p style={{ marginTop: '12px', fontSize: '14px', opacity: 0.7 }}>ID Vidéo: {youtubeId}</p>
        </div>
      ) : (
        <>
          {isLoading && (
            <div style={{
              position: 'absolute',
              top: 0, left: 0, right: 0, bottom: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 10
            }}>
              <div className="loading-spinner-video" />
            </div>
          )}
          <Player
            key={youtubeId} // Force remount on ID change
            ref={playerRef}
            url={`https://www.youtube.com/watch?v=${youtubeId}`}
            width="100%"
            height="100%"
            playing={isPlaying}
            controls={true}
            progressInterval={1000}
            onReady={handleReady}
            onPlay={() => {
              console.log('[DEBUG] VideoPlayer: onPlay fired');
              setIsLoading(false);
              onPlay();
            }}
            onPause={() => {
              console.log('[DEBUG] VideoPlayer: onPause fired');
              onPause();
            }}
            onError={handleError}
            onBuffer={() => {
              console.log('[DEBUG] VideoPlayer: onBuffer fired');
              setIsLoading(true);
              onBuffering?.();
            }}
            onBufferEnd={() => {
              console.log('[DEBUG] VideoPlayer: onBufferEnd fired');
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
                },
              },
            }}
          />
        </>
      )}
      <style jsx>{`
        .loading-spinner-video {
          width: 40px;
          height: 40px;
          border: 3px solid rgba(255,255,255,0.3);
          borderTopColor: #fff;
          borderRadius: 50%;
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

