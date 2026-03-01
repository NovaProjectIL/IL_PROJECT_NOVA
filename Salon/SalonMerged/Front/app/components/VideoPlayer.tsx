'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX } from 'lucide-react';

// @ts-ignore - YouTube API declaration
declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
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

const VideoPlayer: React.FC<VideoPlayerProps> = ({
  youtubeId,
  isPlaying,
  currentTime,
  onProgress,
  onPlay,
  onPause,
  onSeek,
  onDuration,
}) => {
  const playerRef = useRef<any>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [isBuffering, setIsBuffering] = useState(false);
  const [volume, setVolume] = useState(80);
  const [isMuted, setIsMuted] = useState(false);
  const [duration, setDuration] = useState(0);
  const [displayTime, setDisplayTime] = useState(0);
  const progressIntervalRef = useRef<any>(null);

  // ✅ Load YouTube API
  useEffect(() => {
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag?.parentNode?.insertBefore(tag, firstScriptTag);
    }
  }, []);

  // ✅ Initialize YouTube player
  useEffect(() => {
    if (!youtubeId || !window.YT || !window.YT.Player) return;

    const container = document.getElementById('youtube-player-container');
    if (!container) return;

    try {
      // Clear previous player
      const oldContainer = document.getElementById('youtube-player');
      if (oldContainer) {
        oldContainer.innerHTML = '';
      }

      const playerDiv = document.createElement('div');
      playerDiv.id = 'youtube-player';
      playerDiv.style.width = '100%';
      playerDiv.style.height = '100%';
      container.innerHTML = '';
      container.appendChild(playerDiv);

      playerRef.current = new window.YT.Player('youtube-player', {
        height: '100%',
        width: '100%',
        videoId: youtubeId,
        events: {
          onReady: (event: any) => {
            setVideoError(null);
            const dur = event.target.getDuration();
            setDuration(dur);
            onDuration(dur);
            console.log('✅ Video player ready:', youtubeId);
          },
          onStateChange: (event: any) => {
            const state = event.data;
            if (state === window.YT.PlayerState.PLAYING) {
              setIsBuffering(false);
              onPlay();
            } else if (state === window.YT.PlayerState.PAUSED) {
              onPause();
            } else if (state === window.YT.PlayerState.BUFFERING) {
              setIsBuffering(true);
            }
          },
          onError: (event: any) => {
            const errorMessages: Record<number, string> = {
              2: 'Invalid parameter',
              5: 'HTML5 player error',
              100: 'Video not found or not embeddable',
              101: 'Video cannot be played embedded',
              150: 'Video cannot be played embedded',
            };
            const error = errorMessages[event.data] || 'Erreur vidéo inconnue';
            console.error('❌ YouTube Error:', error);
            setVideoError(error);
          },
        },
        playerVars: {
          autoplay: 0,
          controls: 0,
          modestbranding: 1,
          rel: 0,
          showinfo: 0,
          iv_load_policy: 3,
          fs: 1,
        },
      });
    } catch (err: any) {
      console.error('❌ Erreur création player:', err);
      setVideoError(err.message);
    }

    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, [youtubeId, onPlay, onPause, onDuration]);

  // ✅ Play/Pause control
  useEffect(() => {
    if (!playerRef.current) return;
    try {
      if (isPlaying) {
        playerRef.current.playVideo();
      } else {
        playerRef.current.pauseVideo();
      }
    } catch (err) {
      console.error('Play/pause error:', err);
    }
  }, [isPlaying]);

  // ✅ Volume control
  useEffect(() => {
    if (!playerRef.current) return;
    try {
      playerRef.current.setVolume(isMuted ? 0 : volume);
      playerRef.current.setSize(window.innerWidth, window.innerHeight);
    } catch (err) {
      // Ignore
    }
  }, [volume, isMuted]);

  // ✅ Seeking
  useEffect(() => {
    if (currentTime !== undefined && playerRef.current) {
      try {
        const playerTime = playerRef.current.getCurrentTime?.();
        if (Math.abs(playerTime - currentTime) > 0.5) {
          playerRef.current.seekTo(currentTime, true);
        }
      } catch (err) {
        // Ignore seek errors
      }
    }
  }, [currentTime]);

  // ✅ Progress updates
  useEffect(() => {
    progressIntervalRef.current = setInterval(() => {
      if (!playerRef.current) return;
      try {
        const time = playerRef.current.getCurrentTime?.() || 0;
        const dur = playerRef.current.getDuration?.() || 0;
        setDisplayTime(time);
        if (dur > 0) {
          setDuration(dur);
          onProgress(time);
        }
      } catch (err) {
        // Ignore
      }
    }, 250);

    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, [onProgress]);

  const handlePlayPause = () => {
    if (isPlaying) {
      onPause();
    } else {
      onPlay();
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setVolume(parseInt(e.target.value));
  };

  const handleMute = () => {
    setIsMuted(!isMuted);
  };

  if (!youtubeId) {
    return (
      <div
        style={{
          width: '100%',
          backgroundColor: '#000',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontSize: '16px',
          minHeight: '400px',
        }}
      >
        Pas de vidéo sélectionnée
      </div>
    );
  }

  return (
    <div style={{ width: '100%' }}>
      {/* Video Container */}
      <div
        style={{
          width: '100%',
          backgroundColor: '#000',
          position: 'relative',
          paddingBottom: '56.25%',
        }}
      >
        <div
          id="youtube-player-container"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
          }}
        >
          {videoError && (
            <div
              style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#1a1a1a',
                color: '#ff6b6b',
                flexDirection: 'column',
                padding: '20px',
                textAlign: 'center',
              }}
            >
              <p style={{ marginBottom: '10px', fontSize: '16px', fontWeight: 'bold' }}>❌ Erreur vidéo</p>
              <p style={{ fontSize: '13px', opacity: 0.8 }}>{videoError}</p>
              <p style={{ fontSize: '12px', opacity: 0.6, marginTop: '20px' }}>
                ID: {youtubeId}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Custom Controls */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          backgroundColor: '#222',
          color: '#fff',
          gap: '12px',
        }}
      >
        {/* Play Button */}
        <button
          onClick={handlePlayPause}
          style={{
            background: 'none',
            border: 'none',
            color: '#fff',
            cursor: 'pointer',
            padding: '8px',
            display: 'flex',
            alignItems: 'center',
          }}
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? <Pause size={24} /> : <Play size={24} />}
        </button>

        {/* Volume Control */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '150px' }}>
          <button
            onClick={handleMute}
            style={{
              background: 'none',
              border: 'none',
              color: '#fff',
              cursor: 'pointer',
              padding: '8px',
              display: 'flex',
              alignItems: 'center',
            }}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
          </button>
          <input
            type="range"
            min="0"
            max="100"
            value={isMuted ? 0 : volume}
            onChange={handleVolumeChange}
            style={{
              flex: 1,
              cursor: 'pointer',
            }}
          />
        </div>

        {/* Status */}
        <div style={{ fontSize: '12px', opacity: 0.7, minWidth: '100px', textAlign: 'right' }}>
          {isBuffering ? (
            <span>⏳ Chargement...</span>
          ) : (
            <span>
              {Math.floor(displayTime)}s / {Math.floor(duration)}s
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default VideoPlayer;
