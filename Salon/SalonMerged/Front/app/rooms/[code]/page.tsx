'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import io from 'socket.io-client';
import PlaylistComponent from '@/app/components/PlaylistComponent';
import Chat from '@/app/components/Chat';
import styles from './RoomPage.module.css';

// ✅ FIX : Importer l'API configurée
import { roomsApi, playlistApi } from '@/app/lib/api';

// --- IMPORTS DES ICÔNES ---
import {
  MessageCircle,
  SkipBack,
  Play,
  Pause,
  SkipForward,
  Film,
  Loader2,
  CheckCircle2,
  Plus,
  Send,
  LogOut
} from 'lucide-react';

// --- Composant ChatWidget ---
interface ChatWidgetProps {
  pseudo?: string;
  socket: any;
  roomCode: string;
  userId?: number;
  getCurrentTime?: () => number; // ← NOUVEAU
  onSeek?: (timecode: number) => void; // ← NOUVEAU
}

function ChatWidget({ pseudo = "", userId, socket, roomCode, getCurrentTime, onSeek }: ChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [sidebarWidth, setSidebarWidth] = useState(420);
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stopResizing = () => setIsResizing(false);
    const resize = (e: MouseEvent) => {
      if (isResizing) {
        const newWidth = window.innerWidth - e.clientX;
        if (newWidth > 300 && newWidth < 800) setSidebarWidth(newWidth);
      }
    };
    if (isResizing) {
      window.addEventListener("mousemove", resize);
      window.addEventListener("mouseup", stopResizing);
    }
    return () => {
      window.removeEventListener("mousemove", resize);
      window.removeEventListener("mouseup", stopResizing);
    };
  }, [isResizing]);

  const handleMessageReceived = () => {
    if (!isOpen) setUnreadCount((prev) => prev + 1);
  };

  useEffect(() => {
    if (isOpen) setUnreadCount(0);
  }, [isOpen]);

  if (!roomCode) return null;

  return (
    <>
      {!isOpen && (
        <div className="chat-trigger-side" onClick={() => setIsOpen(true)} title="Ouvrir le chat">
          <span className="chat-trigger-text">Chat</span>
          {unreadCount > 0 && <span className="badge-notification animate-jump">{unreadCount > 9 ? "9+" : unreadCount}</span>}
        </div>
      )}

      <div ref={sidebarRef} className={`chat-sidebar-container ${isOpen ? '' : 'closed'}`} style={{ width: `${sidebarWidth}px` }}>
        <div className="resize-handle" onMouseDown={(e) => { e.preventDefault(); setIsResizing(true); }}><div className="resize-line"></div></div>
        <div className="chat-panel">
          <Chat 
            onClose={() => setIsOpen(false)} 
            pseudo={pseudo} 
            userId={userId}
            onMessageReceived={handleMessageReceived} 
            socket={socket} 
            roomCode={roomCode}
            getCurrentTime={getCurrentTime}
            onSeek={onSeek}  
          />
        </div>
      </div>
    </>
  );
}

// ============================================================================
// PARTIE 2 : PAGE PRINCIPALE (RoomPage)
// ============================================================================

interface YouTubePlayerEvent {
  target: any;
  data?: number;
}

interface YouTubePlayer {
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  getPlayerState: () => number;
  destroy: () => void;
  getVideoData?: () => { video_id: string; title: string };
}

// ✅ FIX : Utiliser la même URL que dans api.ts
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://vulgarly-unforcible-loura.ngrok-free.dev';
console.log('🌐 URL API:', API_URL);

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

export default function RoomPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const code = params.code as string;
  const memberId = Number(searchParams.get('memberId'));
  const pseudo = searchParams.get('pseudo') || '';
  
  // === ÉTATS ===
  const [playlist, setPlaylist] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [searchUrl, setSearchUrl] = useState('');
  const [currentVideo, setCurrentVideo] = useState<any>(null);
  const [position, setPosition] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isYTReady, setIsYTReady] = useState(false);
  const [playerInitAttempt, setPlayerInitAttempt] = useState(0);
  const socketRef = useRef<any>(null);
  const playerRef = useRef<any>(null);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const isSyncingRef = useRef(false);

  // Fonction pour passer à la vidéo suivante
  const handleNextVideo = async () => {
    console.log('⏭️ Bouton Suivant cliqué');
    console.log('État playlist:', {
      currentIndex: playlist?.currentIndex,
      totalVideos: playlist?.entries?.length
    });
    
    try {
      // ✅ FIX : Utiliser l'API axios
      const response = await playlistApi.nextVideo(code);
      const data = response.data;
      
      console.log('✅ Données next reçues:', data);
      
      setPlaylist({
        ...playlist,
        currentIndex: data.currentIndex,
        entries: data.entries
      });
      
      if (data.currentIndex >= 0 && data.entries?.length > 0) {
        const currentEntry = data.entries[data.currentIndex];
        if (currentEntry?.video) {
          console.log('🎬 Changement vers:', currentEntry.video.title);
          
          socketRef.current?.emit('changeVideo', {
            roomCode: code,
            video: currentEntry.video,
            sourceType: 'PLAYLIST'
          });
          
          await loadRoomData();
        }
      }
    } catch (error: any) {
      console.error('❌ Erreur handleNextVideo:', error);
      if (error.response?.status === 409) {
        alert('Vous êtes déjà à la dernière vidéo');
      }
    }
  };

  // Fonction pour revenir à la vidéo précédente
  const handlePreviousVideo = async () => {
    console.log('⏮️ Bouton Précédent cliqué');
    console.log('État playlist:', {
      currentIndex: playlist?.currentIndex,
      totalVideos: playlist?.entries?.length
    });
    
    try {
      // ✅ FIX : Utiliser l'API axios
      const response = await playlistApi.previousVideo(code);
      const data = response.data;
      
      console.log('✅ Données previous reçues:', data);
      
      setPlaylist({
        ...playlist,
        currentIndex: data.currentIndex,
        entries: data.entries
      });
      
      if (data.currentIndex >= 0 && data.entries?.length > 0) {
        const currentEntry = data.entries[data.currentIndex];
        if (currentEntry?.video) {
          console.log('🎬 Changement vers:', currentEntry.video.title);
          
          socketRef.current?.emit('changeVideo', {
            roomCode: code,
            video: currentEntry.video,
            sourceType: 'PLAYLIST'
          });
          
          await loadRoomData();
        }
      }
    } catch (error: any) {
      console.error('❌ Erreur handlePreviousVideo:', error);
      if (error.response?.status === 409) {
        alert('Vous êtes déjà à la première vidéo');
      }
    }
  };

  const handleReorder = async (entryId: number, oldPosition: number, newPosition: number) => {
    console.log('🔄 Réorganisation:', { entryId, oldPosition, newPosition });
    
    try {
      // ✅ FIX : Utiliser l'API axios
      const response = await playlistApi.reorderPlaylist({
        codeRoom: code,
        memberId,
        entryId,
        oldPosition,
        newPosition
      });
      
      console.log('✅ Playlist réorganisée:', response.data);
      await loadRoomData();
      
      return response.data;
    } catch (err: any) {
      console.error('❌ Erreur réorganisation:', err);
      alert('Erreur lors de la réorganisation: ' + err.message);
      throw err;
    }
  };

  const calculateAdjustedPosition = useCallback((playbackData: any) => {
    if (!playbackData) return 0;
    
    let position = playbackData.positionSec || 0;
    
    if (playbackData.status === 'PLAYING' && playbackData.serverTimeRef) {
      const serverTime = new Date(playbackData.serverTimeRef).getTime();
      const now = Date.now();
      const elapsedSeconds = (now - serverTime) / 1000;
      position = position + elapsedSeconds;
      
      if (playbackData.video?.durationSec && position > playbackData.video.durationSec) {
        position = playbackData.video.durationSec;
      }
    }
    
    return position;
  }, []);

  // ✅ FIX : Utiliser l'API axios au lieu de fetch
  const loadRoomData = useCallback(async () => {
    try {
      console.log('📡 Chargement état serveur...');
      
      // ✅ FIX PRINCIPAL : Utiliser roomsApi au lieu de fetch()
      const stateRes = await roomsApi.getRoomState(code);
      const stateData = stateRes.data;

      if (isSyncingRef.current) {
        console.log('⏳ Synchro en cours, ignore loadRoomData');
        return;
      }

      setPlaylist(stateData.playlist);
      setMembers(stateData.members || []);

      if (stateData.playback?.video) {
        setCurrentVideo(stateData.playback.video);

        const adjustedPosition = calculateAdjustedPosition(stateData.playback);
        console.log('⏱️ Position ajustée:', adjustedPosition, 'vs original:', stateData.playback.positionSec);

        setPosition(adjustedPosition);
        setIsPlaying(stateData.playback.status === 'PLAYING');

        if (playerRef.current && isPlayerReady && !isSyncingRef.current) {
          const playerPosition = playerRef.current.getCurrentTime?.() || 0;

          if (Math.abs(playerPosition - adjustedPosition) > 2) {
            console.log('🔄 Sync depuis loadRoomData:', adjustedPosition);
            playerRef.current.seekTo(adjustedPosition, true);
          }
        }
      }
    } catch (err) {
      console.error('❌ Erreur chargement salon:', err);
    }
  }, [code, calculateAdjustedPosition, isPlayerReady]);

  useEffect(() => {
    const initialLoad = async () => {
      await loadRoomData();
      setLoading(false);
    };
    
    initialLoad();
    const interval = setInterval(loadRoomData, 5000);
    return () => clearInterval(interval);
  }, [code, loadRoomData]);

  useEffect(() => {
    if (window.YT) {
      setIsYTReady(true);
      return;
    }
    
    if (document.querySelector('script[src*="youtube.com/iframe_api"]')) {
      const interval = setInterval(() => {
        if (window.YT) {
          setIsYTReady(true);
          clearInterval(interval);
        }
      }, 100);
      
      return () => clearInterval(interval);
    }
    
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    tag.async = true;
    
    window.onYouTubeIframeAPIReady = () => {
      console.log('🎬 YouTube API prête');
      setIsYTReady(true);
    };
    
    const firstScriptTag = document.getElementsByTagName('script')[0];
    if (firstScriptTag?.parentNode) {
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    } else {
      document.head.appendChild(tag);
    }
    
    return () => {
      window.onYouTubeIframeAPIReady = () => {};
    };
  }, []);

  useEffect(() => {
    if (!currentVideo || !isYTReady) {
      console.log('⏳ En attente: ', {
        hasVideo: !!currentVideo,
        youtubeId: currentVideo?.youtubeId,
        isYTReady
      });
      return;
    }
    
    console.log('▶️ Création du player pour:', currentVideo.youtubeId);
    
    if (playerRef.current && playerRef.current.destroy) {
      playerRef.current.destroy();
      playerRef.current = null;
      setIsPlayerReady(false);
    }
    
    if (!window.YT || !window.YT.Player) {
      console.error('❌ window.YT.Player non disponible');
      return;
    }
    
    try {
      playerRef.current = new window.YT.Player('youtube-player', {
        videoId: currentVideo.youtubeId,
        playerVars: {
          autoplay: isPlaying ? 1 : 0,
          controls: 1,
          modestbranding: 1,
          rel: 0,
          enablejsapi: 1,
          playsinline: 1,
        },
        events: {
          onReady: (event: any) => {
            setIsPlayerReady(true);
            
            if (position > 0) {
              setTimeout(() => {
                event.target.seekTo(position, true);
              }, 500);
            }
            
            if (isPlaying) {
              setTimeout(() => {
                event.target.playVideo();
              }, 600);
            }
          },
          onStateChange: (event: any) => {
            if (isSyncingRef.current) return;
            
            const state = event.data;
            const currentPos = event.target.getCurrentTime();
            
            if (state === 1) {
              if (!isPlaying) {
                setIsPlaying(true);
                socketRef.current?.emit('play', { 
                  codeRoom: code, 
                  positionSec: currentPos
                });
              }
            } 
            else if (state === 2) {
              if (isPlaying) {
                setIsPlaying(false);
                socketRef.current?.emit('pause', { 
                  codeRoom: code, 
                  positionSec: currentPos
                });
              }
            }
          },
          onError: (event: any) => {
            console.error('❌ Erreur YouTube player');
          }
        }
      });
    } catch (error) {
      console.error('❌ Erreur création player:', error);
    }
    
    return () => {
      if (playerRef.current && playerRef.current.destroy) {
        console.log('🗑️ Destruction du player');
        playerRef.current.destroy();
        playerRef.current = null;
        setIsPlayerReady(false);
      }
    };
  }, [currentVideo?.youtubeId, isYTReady, playerInitAttempt]);

  useEffect(() => {
    if (!isPlayerReady || !playerRef.current) return;
    
    const interval = setInterval(() => {
      if (playerRef.current?.getCurrentTime) {
        const currentTime = playerRef.current.getCurrentTime();
        setPosition(currentTime);
      }
    }, 1000);
    
    return () => clearInterval(interval);
  }, [isPlayerReady]);

  useEffect(() => {
    if (!code) return;
    
    console.log('🔌 Initialisation Socket.io pour:', code);
    
    socketRef.current = io(API_URL, {
      transports: ['websocket', 'polling'],
      // ✅ IMPORTANT : Header ngrok pour Socket.IO
      extraHeaders: {
        'ngrok-skip-browser-warning': 'true',
      },
    });
    
    socketRef.current.on('connect', () => {
      console.log('✅ Socket.io connecté');
      socketRef.current.emit('join-room', { codeRoom: code, memberId });
    });
    
    socketRef.current.on('playback-updated', async (data: any) => {
      console.log('📡 Socket reçu:', data.action, 'position:', data.playback?.positionSec);
      
      if (!playerRef.current || !isPlayerReady) {
        console.log('⏳ Player pas prêt, chargement état...');
        await loadRoomData();
        return;
      }
      
      isSyncingRef.current = true;
      
      try {
        let targetPosition = data.playback?.positionSec || 0;
        
        if (data.action === 'play' && data.playback?.serverTimeRef) {
          const serverTime = new Date(data.playback.serverTimeRef).getTime();
          const now = Date.now();
          const elapsedSeconds = (now - serverTime) / 1000;
          targetPosition = targetPosition + elapsedSeconds;
          console.log('⏱️ Position ajustée:', targetPosition, 'elapsed:', elapsedSeconds);
        }
        
        if (targetPosition > 0) {
          console.log('🎯 Seek socket vers:', targetPosition);
          playerRef.current.seekTo(targetPosition, true);
          setPosition(targetPosition);
        }
        
        if (data.action === 'play') {
          console.log('▶️ Play socket');
          playerRef.current.playVideo();
          setIsPlaying(true);
        } else if (data.action === 'pause') {
          console.log('⏸️ Pause socket');
          playerRef.current.pauseVideo();
          setIsPlaying(false);
        }
        
      } catch (error) {
        console.error('❌ Erreur synchronisation socket:', error);
      } finally {
        setTimeout(() => {
          isSyncingRef.current = false;
          console.log('✅ Synchronisation terminée');
        }, 150);
      }
    });
    
    socketRef.current.on('error', (error: any) => {
      console.error('❌ Erreur Socket:', error);
    });
    
    return () => {
      console.log('🔌 Déconnexion Socket.io');
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [code, memberId, isPlayerReady]);

  const handlePlay = () => {
    console.log('▶️ Bouton Play cliqué');
    
    if (playerRef.current && isPlayerReady) {
      try {
        const currentPos = playerRef.current.getCurrentTime();
        console.log('⏱️ Position actuelle:', currentPos);
        
        playerRef.current.playVideo();
        setIsPlaying(true);
        setPosition(currentPos);
        
        socketRef.current?.emit('play', { 
          codeRoom: code, 
          positionSec: currentPos
        });
        
        console.log('✅ Événement play envoyé');
      } catch (error) {
        console.error('❌ Erreur handlePlay:', error);
      }
    } else {
      console.error('❌ Player non prêt');
    }
  };
  
  const handlePause = () => {
    console.log('⏸️ Bouton Pause cliqué');
    
    if (playerRef.current && isPlayerReady) {
      try {
        const currentPos = playerRef.current.getCurrentTime();
        console.log('⏱️ Position actuelle:', currentPos);
        
        playerRef.current.pauseVideo();
        setIsPlaying(false);
        setPosition(currentPos);
        
        socketRef.current?.emit('pause', { 
          codeRoom: code, 
          positionSec: currentPos
        });
        
        console.log('✅ Événement pause envoyé');
      } catch (error) {
        console.error('❌ Erreur handlePause:', error);
      }
    } else {
      console.error('❌ Player non prêt');
    }
  };

  const handleSeek = (newPosition: number) => {
    console.log('🎯 Seek manuel à:', newPosition);
    
    if (playerRef.current && isPlayerReady) {
      try {
        isSyncingRef.current = true;
        
        playerRef.current.seekTo(newPosition, true);
        setPosition(newPosition);
        
        socketRef.current?.emit('seek', { 
          codeRoom: code, 
          positionSec: newPosition,
          wasPlaying: isPlaying
        });
        
        setTimeout(() => {
          isSyncingRef.current = false;
          console.log('✅ Mode synchro désactivé après seek');
        }, 500);
        
      } catch (error) {
        console.error('❌ Erreur handleSeek:', error);
        isSyncingRef.current = false;
      }
    }
  };

  // Recherche vidéo
  const handleSearch = async (playDirect = true) => {
    if (!searchUrl.trim()) return alert('Entrez une URL');
    
    let videoId = '';
    if (searchUrl.includes('youtube.com/watch?v=')) {
      videoId = searchUrl.split('v=')[1].split('&')[0];
    } else if (searchUrl.includes('youtu.be/')) {
      videoId = searchUrl.split('youtu.be/')[1].split('?')[0];
    } else if (searchUrl.length === 11) {
      videoId = searchUrl;
    } else {
      return alert('URL YouTube invalide');
    }

    try {
      // ✅ FIX : Utiliser l'API axios
      const youtubeRes = await roomsApi.getYouTubeInfo(videoId);
      const youtubeData = youtubeRes.data;
      
      if (playDirect) {
        // ✅ FIX : Utiliser l'API axios
        await roomsApi.playDirectVideo({
          codeRoom: code,
          memberId,
          youtubeId: videoId,
          youtubeVTitle: youtubeData.title,
          youtubeVChannel: youtubeData.author,
          youtubeVDurationSec: youtubeData.durationSec || 180,
          youtubeVThumbnailUrl: youtubeData.thumbnail,
        });
      } else {
        // ✅ FIX : Utiliser l'API axios
        await playlistApi.addToPlaylist({
          codeRoom: code,
          memberId,
          youtubeId: videoId,
          youtubeVTitle: youtubeData.title,
          youtubeVChannel: youtubeData.author,
          youtubeVDurationSec: youtubeData.durationSec || 180,
          youtubeVThumbnailUrl: youtubeData.thumbnail,
        });
        alert('✅ Vidéo ajoutée');
      }
      
      setSearchUrl('');
      await loadRoomData();
      
    } catch (err: any) {
      console.error('❌ Erreur recherche vidéo:', err);
      alert('Erreur: ' + (err.response?.data?.message || err.message));
    }
  };

  const handlePlayVideo = async (index: number) => {
    try {
      // ✅ FIX : Utiliser l'API axios
      await playlistApi.changeIndex(memberId, code, index);
      
      socketRef.current?.emit('video-change', { 
        codeRoom: code,
        videoId: playlist.entries[index]?.video?.youtubeId || ''
      });
      
      await loadRoomData();
    } catch (err: any) {
      console.error('❌ Erreur lecture vidéo:', err);
      alert('Erreur: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleDelete = async (entryId: number) => {
    if (!confirm('Supprimer ?')) return;
    try {
      // ✅ FIX : Utiliser l'API axios
      await playlistApi.deleteFromPlaylist(memberId, code, entryId);
      await loadRoomData();
    } catch (err: any) {
      console.error('❌ Erreur suppression:', err);
      alert('Erreur: ' + (err.response?.data?.message || err.message));
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const currentMemberName = members.find(m => m.id === memberId)?.name || "";

  const handleQuitRoom = () => {
    if (socketRef.current) {
      socketRef.current.disconnect();
    }
    router.push('/');
  };

  if (loading) return <div className={styles.loading}>Chargement...</div>;

  return (
    <div className={styles.container}>
      <div className={styles.roomHeader}>
        <h1 className={styles.roomTitle}>Salon: {code}</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className={`${styles.connectionBadge} ${socketRef.current?.connected ? styles.connected : styles.disconnected}`}>
            {socketRef.current?.connected ? '🟢 Connecté' : '🔴 Déconnecté'}
          </div>
          <button
            onClick={handleQuitRoom}
            className={styles.quitButton}
            title="Quitter le salon"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              background: 'linear-gradient(135deg, #dc2626, #b91c1c)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '600',
              transition: 'all 0.3s ease',
              boxShadow: '0 4px 12px rgba(220, 38, 38, 0.4)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 16px rgba(220, 38, 38, 0.6)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(220, 38, 38, 0.4)';
            }}
          >
            <LogOut size={16} />
            Quitter
          </button>
        </div>
      </div>
      
      {/* Recherche */}
      <div className={styles.searchSection}>
        <h3>Rechercher YouTube:</h3>
        <label htmlFor="youtube-url-input" className="sr-only">URL YouTube</label>
        <input
          id="youtube-url-input"
          type="text"
          value={searchUrl}
          onChange={(e) => setSearchUrl(e.target.value)}
          placeholder="URL YouTube"
          className={styles.searchInput}
          onKeyPress={(e) => e.key === 'Enter' && handleSearch(true)}
        />
        <button onClick={() => handleSearch(true)} className={styles.searchButton}>
          <Play size={16} style={{ marginRight: '6px', display: 'inline-block', verticalAlign: 'middle' }} />
          Jouer
        </button>
        <button onClick={() => handleSearch(false)} className={`${styles.searchButton} ${styles.addButton}`}>
          <Plus size={16} style={{ marginRight: '6px', display: 'inline-block', verticalAlign: 'middle' }} />
          Playlist
        </button>
      </div>
      
      {/* Membres */}
      <div className={styles.membersSection}>
        <h3>Membres ({members.length}):</h3>
        <div className={styles.membersList}>
          {members.map(member => (
            member.id === memberId ? (
              <span
                key={member.id}
                className={`${styles.memberTag} ${styles.currentMember}`}
              >
                {member.name} (Vous)
              </span>
            ) : (
              <span
                key={member.id}
                className={`${styles.memberTag}`}
              >
                {member.name}
              </span>
            )
          ))}
        </div>
      </div>
      
      {/* Vidéo en cours */}
      {currentVideo && (
        <div className={styles.videoSection}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Film size={24} />
            {currentVideo.title}
          </h3>
          <p>Chaîne: {currentVideo.channelTitle || currentVideo.author}</p>
          
          {/* Player YouTube */}
          <div className={styles.playerContainer}>
            <div 
              id="youtube-player" 
              className={styles.youtubePlayer}
            ></div>
            
            {!isYTReady && (
              <div className={styles.playerOverlay}>
                <div className={styles.overlayContent}>
                  <div className={styles.overlayText} style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                    <Loader2 size={20} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
                    Chargement du player YouTube...
                  </div>
                  <div className={styles.videoId}>Vidéo: {currentVideo.youtubeId}</div>
                </div>
              </div>
            )}
            
            {isYTReady && !isPlayerReady && (
              <div className={styles.playerOverlay}>
                <div className={styles.overlayContent}>
                  <div className={styles.overlayText} style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                    <Film size={20} />
                    Initialisation du player...
                  </div>
                  <button 
                    onClick={() => {
                      setPlayerInitAttempt(prev => prev + 1);
                      console.log('🔄 Réessai d\'initialisation');
                    }}
                    className={styles.retryButton}
                  >
                    Réessayer
                  </button>
                </div>
              </div>
            )}
          </div>
          
          {/* État de synchronisation */}
          <div className={`${styles.syncStatus} ${isPlayerReady ? styles.syncReady : styles.syncLoading}`}>
            {isYTReady ? (
              isPlayerReady ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
                  <CheckCircle2 size={16} />
                  Player prêt - Synchronisation activée
                </span>
              ) : (
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
                  <Loader2 size={16} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
                  Player en cours d'initialisation...
                </span>
              )
            ) : (
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
                <Loader2 size={16} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
                Chargement de l'API YouTube...
              </span>
            )}
          </div>
          
          {/* Contrôles */}
          <div className={styles.controlsSection}>
            <div className={styles.controlButtons}>
              <button 
                onClick={handlePreviousVideo} 
                className={`${styles.controlButton} ${styles.previousButton}`}
                title="Vidéo précédente"
                style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}
              >
                <SkipBack size={18} />
                Précédent
              </button>
              
              <button 
                onClick={handlePlay} 
                className={`${styles.controlButton} ${styles.playButton}`}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}
              >
                <Play size={18} />
                Play
              </button>
              
              <button 
                onClick={handlePause} 
                className={`${styles.controlButton} ${styles.pauseButton}`}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}
              >
                <Pause size={18} />
                Pause
              </button>
              
              <button 
                onClick={handleNextVideo} 
                className={`${styles.controlButton} ${styles.nextButton}`}
                title="Vidéo suivante"
                style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}
              >
                Suivant
                <SkipForward size={18} />
              </button>
            </div>
            
            {/* Barre de progression */}
            <div className={styles.progressSection}>
              <div className={styles.timeLabels}>
                <span>{formatTime(position)}</span>
                <span>
                  {currentVideo.durationSec ? formatTime(currentVideo.durationSec) : '??:??'}
                </span>
              </div>
              <label htmlFor="video-progress-bar" className="sr-only">
                Barre de progression de la vidéo
              </label>
              <input
                id="video-progress-bar"
                type="range"
                min="0"
                max={currentVideo.durationSec || 1}
                value={position}
                onChange={(e) => handleSeek(Number(e.target.value))}
                className={styles.progressBar}
                title={`Position: ${formatTime(position)}`}
                aria-label="Contrôle de position de la vidéo"
              />
              <div className={styles.statusInfo}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <strong>État:</strong> 
                  {isPlaying ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Play size={14} />
                      En lecture
                    </span>
                  ) : (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Pause size={14} />
                      En pause
                    </span>
                  )}
                </span>
                <span className={styles.positionInfo}>
                  <strong>Position:</strong> {formatTime(position)} / {currentVideo.durationSec ? formatTime(currentVideo.durationSec) : '??:??'}
                </span>
                
                {playlist && playlist.entries && playlist.entries.length > 0 && (
                  <span className={styles.playlistInfo}>
                    <strong>Playlist:</strong> {playlist.currentIndex + 1}/{playlist.entries.length}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Playlist */}
      <PlaylistComponent
        playlist={playlist}
        code={code}
        memberId={memberId}
        onPlayVideo={handlePlayVideo}
        onDeleteVideo={handleDelete}
        onReorder={handleReorder}
        isLoading={loading}
      />
      
      <ChatWidget
        socket={socketRef.current}
        roomCode={code}
        pseudo={pseudo || currentMemberName || "Utilisateur"}
        userId={memberId}
        getCurrentTime={() => playerRef.current?.getCurrentTime?.() ?? 0}  // ← NOUVEAU
        onSeek={(timecode) => handleSeek(timecode)} 
      />
      
    </div>
  );
}