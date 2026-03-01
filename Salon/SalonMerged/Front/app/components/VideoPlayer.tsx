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
  const [isReady, setIsReady] = useState(false);
  const [isSeeking, setIsSeeking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isReady && !isSeeking && playerRef.current) {
      try {
        const currentPlayerTime: number = playerRef.current.getCurrentTime();
        if (Math.abs(currentPlayerTime - currentTime) > 0.5) {
          playerRef.current.seekTo(currentTime, 'seconds');
        }
      } catch (e) {
        console.error('Error seeking:', e);
      }
    }
  }, [currentTime, isReady, isSeeking]);

  // Handle play state changes
  useEffect(() => {
    if (isReady && playerRef.current) {
      try {
        if (isPlaying && !playerRef.current.getPlayerState?.()) {
          // If should be playing but player state suggests otherwise
          playerRef.current.seekTo(currentTime, 'seconds');
        }
      } catch (e) {
        console.error('Error syncing play state:', e);
      }
    }
  }, [isPlaying, isReady, currentTime]);

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