'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import io from 'socket.io-client';
import PlaylistComponent from '@/app/components/PlaylistComponent';
import Chat from '@/app/components/Chat';
import styles from './RoomPage.module.css';
import Timeline from '@/app/components/Timeline';
import VideoPlayer from '@/app/components/VideoPlayer';
import { roomsApi, playlistApi } from '@/app/lib/api';

import {
  SkipBack,
  Play,
  Pause,
  SkipForward,
  Film,
  LogOut,
  Plus,
} from 'lucide-react';

// --- Composant ChatWidget ---
interface ChatWidgetProps {
  pseudo?: string;
  socket: any;
  roomCode: string;
  userId?: number;
  getCurrentTime?: () => number;
  onSeek?: (timecode: number) => void;
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
// PAGE PRINCIPALE (RoomPage)
// ============================================================================

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://vulgarly-unforcible-loura.ngrok-free.dev';
console.log('URL API:', API_URL);

export default function RoomPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const code = params.code as string;
  const memberId = Number(searchParams.get('memberId'));
  const pseudo = searchParams.get('pseudo') || '';

  const [playlist, setPlaylist] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [searchUrl, setSearchUrl] = useState('');
  const [currentVideo, setCurrentVideo] = useState<any>(null);
  const [position, setPosition] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const socketRef = useRef<any>(null);
  const isSyncingRef = useRef(false);

  const handleNextVideo = async () => {
    try {
      const response = await playlistApi.nextVideo(code);
      const data = response.data;
      setPlaylist({ ...playlist, currentIndex: data.currentIndex, entries: data.entries });
      if (data.currentIndex >= 0 && data.entries?.length > 0) {
        const currentEntry = data.entries[data.currentIndex];
        if (currentEntry?.video) {
          socketRef.current?.emit('changeVideo', { roomCode: code, video: currentEntry.video, sourceType: 'PLAYLIST' });
          await loadRoomData();
        }
      }
    } catch (error: any) {
      console.error('Erreur handleNextVideo:', error);
      if (error.response?.status === 409) alert('Vous êtes déjà à la dernière vidéo');
    }
  };

  const handlePreviousVideo = async () => {
    try {
      const response = await playlistApi.previousVideo(code);
      const data = response.data;
      setPlaylist({ ...playlist, currentIndex: data.currentIndex, entries: data.entries });
      if (data.currentIndex >= 0 && data.entries?.length > 0) {
        const currentEntry = data.entries[data.currentIndex];
        if (currentEntry?.video) {
          socketRef.current?.emit('changeVideo', { roomCode: code, video: currentEntry.video, sourceType: 'PLAYLIST' });
          await loadRoomData();
        }
      }
    } catch (error: any) {
      console.error('Erreur handlePreviousVideo:', error);
      if (error.response?.status === 409) alert('Vous êtes déjà à la première vidéo');
    }
  };

  const handleReorder = async (entryId: number, oldPosition: number, newPosition: number) => {
    try {
      const response = await playlistApi.reorderPlaylist({ codeRoom: code, memberId, entryId, oldPosition, newPosition });
      await loadRoomData();
      return response.data;
    } catch (err: any) {
      console.error('Erreur réorganisation:', err);
      alert('Erreur lors de la réorganisation: ' + err.message);
      throw err;
    }
  };

  const calculateAdjustedPosition = useCallback((playbackData: any) => {
    if (!playbackData) return 0;
    let pos = playbackData.positionSec || 0;
    if (playbackData.status === 'PLAYING' && playbackData.serverTimeRef) {
      const serverTime = new Date(playbackData.serverTimeRef).getTime();
      const elapsedSeconds = (Date.now() - serverTime) / 1000;
      pos = pos + elapsedSeconds;
      if (playbackData.video?.durationSec && pos > playbackData.video.durationSec) {
        pos = playbackData.video.durationSec;
      }
    }
    return pos;
  }, []);

  const loadRoomData = useCallback(async () => {
    try {
      const stateRes = await roomsApi.getRoomState(code);
      const stateData = stateRes.data;

      // ✅ CORRECTION : On met à jour currentVideo ET la playlist AVANT
      // de vérifier isSyncingRef, car la vidéo doit toujours s'afficher
      // même si un événement socket est en cours de traitement.
      if (stateData.playback?.video) {
        setCurrentVideo(stateData.playback.video);
      }

      // ✅ CORRECTION : On ne bloque le reste de la mise à jour
      // (position, isPlaying, playlist, members) que si une synchro
      // socket est en cours, pour éviter les conflits de position.
      if (isSyncingRef.current) return;

      setPlaylist(stateData.playlist);
      setMembers(stateData.members || []);

      if (stateData.playback?.video) {
        setPosition(calculateAdjustedPosition(stateData.playback));
        // ✅ FIX: Ne pas forcer le play au démarrage
        setIsPlaying(false);
      }
    } catch (err) {
      console.error('Erreur chargement salon:', err);
    }
  }, [code, calculateAdjustedPosition]);

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
    if (!code) return;

    socketRef.current = io(API_URL, {
      transports: ['websocket', 'polling'],
      ...({ extraHeaders: { 'ngrok-skip-browser-warning': 'true' } } as any),
    });

    socketRef.current.on('connect', () => {
      socketRef.current.emit('join-room', { codeRoom: code, memberId });
    });

    socketRef.current.on('room-initial-state', (data: any) => {
      console.log('État initial reçu via socket:', data);
      if (data.playback?.video) {
        setCurrentVideo(data.playback.video);
        // ✅ FIX: Ne pas forcer le play au démarrage (navigateur le refuse)
        // Toujours démarrer en pause, l'utilisateur cliquera Play
        setIsPlaying(false);
        if (!isSyncingRef.current) {
          setPosition(data.playback.positionSec || 0);
        }
      }
      if (data.playlist) {
        setPlaylist(data.playlist);
      }
      if (data.users) {
        setMembers(data.users);
      }
    });

    socketRef.current.on('playback-updated', async (data: any) => {
      isSyncingRef.current = true;
      try {
        console.log('Playback updated via socket:', data);
        if (data.playback?.video) {
          setCurrentVideo(data.playback.video);
        }

        let targetPosition = data.playback?.positionSec || 0;
        if (data.action === 'play' && data.playback?.serverTimeRef) {
          const serverTime = new Date(data.playback.serverTimeRef).getTime();
          targetPosition = targetPosition + (Date.now() - serverTime) / 1000;
        }
        setPosition(targetPosition);
        if (data.action === 'play') setIsPlaying(true);
        else if (data.action === 'pause') setIsPlaying(false);
        else if (data.action === 'seek') setIsPlaying(false);
      } catch (error) {
        console.error('Erreur synchronisation socket:', error);
      } finally {
        setTimeout(() => { isSyncingRef.current = false; }, 150);
      }
    });

    socketRef.current.on('error', (error: any) => {
      console.error('Erreur Socket:', error);
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, [code, memberId]);

  const handlePlay = () => {
    setIsPlaying(true);
    socketRef.current?.emit('play', { codeRoom: code, positionSec: position });
  };

  const handlePause = () => {
    setIsPlaying(false);
    socketRef.current?.emit('pause', { codeRoom: code, positionSec: position });
  };

  const handleSeek = (newPosition: number) => {
    setPosition(newPosition);
    socketRef.current?.emit('seek', { codeRoom: code, positionSec: newPosition, wasPlaying: isPlaying });
  };

  const handleSearch = async (playDirect: boolean) => {
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
      const youtubeRes = await roomsApi.getYouTubeInfo(videoId);
      const youtubeData = youtubeRes.data;
      
      // ✅ FIX: Toujours ajouter à la playlist d'abord
      await playlistApi.addToPlaylist({
        codeRoom: code, memberId, youtubeId: videoId,
        youtubeVTitle: youtubeData.title, youtubeVChannel: youtubeData.author,
        youtubeVDurationSec: youtubeData.durationSec || 180, youtubeVThumbnailUrl: youtubeData.thumbnail,
      });
      
      // Recharger les données pour avoir l'index correct
      await loadRoomData();
      
      // Si "Jouer" (playDirect=true), mettre en lecture immédiat
      if (playDirect) {
        // Attendre que loadRoomData finisse de mettre à jour la playlist
        setTimeout(() => {
          if (playlist?.entries?.length > 0) {
            // Jouer la première (index 0)
            handlePlayVideo(0);
          }
        }, 500);
      } else {
        alert('Vidéo ajoutée à la playlist');
      }
      
      setSearchUrl('');
    } catch (err: any) {
      console.error('Erreur recherche vidéo:', err);
      alert('Erreur: ' + (err.response?.data?.message || err.message));
    }
  };

  const handlePlayVideo = async (index: number) => {
    try {
      const response = await playlistApi.changeIndex(memberId, code, index);
      // ✅ Le backend retourne la nouvelle playlist avec currentIndex
      setPlaylist(response.data);
      
      // Récupérer la vidéo maintenant chargée
      await new Promise(resolve => setTimeout(resolve, 100));
      await loadRoomData();
      
      socketRef.current?.emit('video-change', { codeRoom: code, videoId: response.data?.entries?.[index]?.video?.youtubeId || '' });
    } catch (err: any) {
      console.error('Erreur lecture vidéo:', err);
      alert('Erreur: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleDelete = async (entryId: number) => {
    if (!confirm('Supprimer ?')) return;
    try {
      await playlistApi.deleteFromPlaylist(memberId, code, entryId);
      await loadRoomData();
    } catch (err: any) {
      console.error('Erreur suppression:', err);
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
    socketRef.current?.disconnect();
    router.push('/');
  };

  if (loading) return <div className={styles.loading}>Chargement...</div>;

  return (
    <div className={styles.container}>
      <div className={styles.roomHeader}>
        <h1 className={styles.roomTitle}>Salon: {code}</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className={`${styles.connectionBadge} ${socketRef.current?.connected ? styles.connected : styles.disconnected}`}>
            {socketRef.current?.connected ? 'Connecté' : 'Déconnecté'}
          </div>
          <button
            onClick={handleQuitRoom}
            className={styles.quitButton}
            title="Quitter le salon"
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '8px 16px',
              background: 'linear-gradient(135deg, #dc2626, #b91c1c)',
              color: 'white', border: 'none', borderRadius: '8px',
              cursor: 'pointer', fontSize: '14px', fontWeight: '600',
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
            <span
              key={member.id}
              className={`${styles.memberTag} ${member.id === memberId ? styles.currentMember : ''}`}
            >
              {member.name}{member.id === memberId ? ' (Vous)' : ''}
            </span>
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

          <div className={styles.playerContainer}>
            <VideoPlayer
              youtubeId={currentVideo.youtubeId}
              isPlaying={isPlaying}
              currentTime={position}
              onProgress={(time) => setPosition(time)}
              onPlay={handlePlay}
              onPause={handlePause}
              onSeek={(time) => {
                setPosition(time);
                socketRef.current?.emit('seek', { codeRoom: code, positionSec: time, wasPlaying: isPlaying });
              }}
              onDuration={(duration) => console.log('Durée:', duration)}
            />
          </div>

          {/* Contrôles */}
          <div className={styles.controlsSection}>
            <div className={styles.controlButtons}>
              <button onClick={handlePreviousVideo} className={`${styles.controlButton} ${styles.previousButton}`}
                title="Vidéo précédente" style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
                <SkipBack size={18} /> Précédent
              </button>
              <button onClick={handlePlay} className={`${styles.controlButton} ${styles.playButton}`}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
                <Play size={18} /> Play
              </button>
              <button onClick={handlePause} className={`${styles.controlButton} ${styles.pauseButton}`}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
                <Pause size={18} /> Pause
              </button>
              <button onClick={handleNextVideo} className={`${styles.controlButton} ${styles.nextButton}`}
                title="Vidéo suivante" style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
                Suivant <SkipForward size={18} />
              </button>
            </div>

            <div className={styles.progressSection}>
              <Timeline
                duration={currentVideo?.durationSec || 0}
                currentTime={position}
                onSeek={handleSeek}
                roomCode={code}
              />
              <div className={styles.statusInfo}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <strong>État:</strong>
                  {isPlaying ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Play size={14} /> En lecture</span>
                  ) : (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Pause size={14} /> En pause</span>
                  )}
                </span>
                <span className={styles.positionInfo}>
                  <strong>Position:</strong> {formatTime(position)} / {currentVideo.durationSec ? formatTime(currentVideo.durationSec) : '??:??'}
                </span>
                {playlist?.entries?.length > 0 && (
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

      {/* Chat */}
      <ChatWidget
        socket={socketRef.current}
        roomCode={code}
        pseudo={pseudo || currentMemberName || "Utilisateur"}
        userId={memberId}
        getCurrentTime={() => position}
        onSeek={(timecode) => handleSeek(timecode)}
      />
    </div>
  );
}