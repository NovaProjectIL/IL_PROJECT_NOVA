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
  const playPromiseRef = useRef<Promise<void> | null>(null);
  const lastSeekRef = useRef<number>(0);
  const [isReady, setIsReady] = useState(false);
  const [isSeeking, setIsSeeking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isReady && !isSeeking && playerRef.current) {
      try {
        // Guard: vérifier que les seeks ne sont pas trop rapprochés
        if (Date.now() - lastSeekRef.current < 500) {
          return;
        }

        const currentPlayerTime: number = playerRef.current.getCurrentTime();
        // Seuil à 1 seconde pour moins de seeks inutiles
        if (Math.abs(currentPlayerTime - currentTime) > 1) {
          lastSeekRef.current = Date.now();
          playerRef.current.seekTo(currentTime, 'seconds');
        }
      } catch (e) {
        console.error('Error seeking:', e);
      }
    }
  }, [currentTime, isReady, isSeeking]);

  // Handle play state changes with race condition prevention
  useEffect(() => {
    if (!isReady || !playerRef.current) {
      return;
    }

    const handlePlayStateChange = async () => {
      try {
        const internalPlayer = playerRef.current?.getInternalPlayer?.();
        if (!internalPlayer) {
          return;
        }

        if (isPlaying) {
          // Demander la lecture et stocker la promise
          try {
            playPromiseRef.current = internalPlayer.playVideo?.() ?? Promise.resolve();
            if (playPromiseRef.current) {
              await playPromiseRef.current;
              playPromiseRef.current = null;
            }
          } catch (e: any) {
            // Ignorer silencieusement les AbortError (interruption par pause())
            if (e.name !== 'AbortError') {
              console.error('Error playing video:', e);
            }
            playPromiseRef.current = null;
          }
        } else {
          // Pause: attendre que la play promise se resolve PUIS pauseVideo
          if (playPromiseRef.current) {
            try {
              await playPromiseRef.current;
            } catch (e: any) {
              if (e.name !== 'AbortError') {
                console.error('Error waiting for play:', e);
              }
            }
            playPromiseRef.current = null;
          }

          // Appeler pauseVideo après la promise
          try {
            internalPlayer.pauseVideo?.();
          } catch (e: any) {
            if (e.name !== 'AbortError') {
              console.error('Error pausing video:', e);
            }
          }
        }
      } catch (error: any) {
        // Ignorer les AbortError silencieusement
        if (error.name !== 'AbortError') {
          console.error('Error syncing play state:', error);
        }
      }
    };

    handlePlayStateChange();
  }, [isPlaying, isReady]);

  const handleReady = () => {
    setIsReady(true);
    setIsLoading(false);
    setError(null);
  };

  const handleError = (e: any) => {
    console.error('Player error:', e);
    setError('Erreur de chargement de la vidéo. La vidéo peut être restreinte ou non disponible.');
    setIsLoading(false);
  };

  // Use embed URL format which is more reliable for YouTube embeds
  const videoUrl = `https://www.youtube.com/embed/${youtubeId}`;

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
            url={videoUrl}
            width="100%"
            height="100%"
            playing={isPlaying}
            controls={true}
            progressInterval={1000}
            onReady={handleReady}
            onPlay={onPlay}
            onPause={onPause}
            onError={handleError}
            onBuffer={() => setIsLoading(true)}
            onBufferEnd={() => setIsLoading(false)}
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
                  playsinline: 1,
                  enablejsapi: 1,
                  origin: typeof window !== 'undefined' ? window.location.origin : '',
                  widget_referrer: typeof window !== 'undefined' ? window.location.href : '',
                },
                embedOptions: {
                  playsinline: 1,
                }
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