'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import io from 'socket.io-client';
import PlaylistComponent from '@/app/components/PlaylistComponent';
import Chat from '@/app/components/Chat';
import styles from './RoomPage.module.css';
import VideoPlayer from '@/app/components/VideoPlayer';
import { roomsApi, playlistApi, marqueursApi } from '@/app/lib/api';
import { Marqueur } from '@/app/types/types';

// ============================================================================
// LOGS HELPERS
// Prefixes pour filtrer facilement dans la console du navigateur
// [ROOM] = logs generaux de la room
// [SOCKET] = logs des evenements Socket.io
// [MARQUEURS] = logs des marqueurs
// [PLAYER] = logs du player video
// [API] = logs des appels API
// ============================================================================
const log = {
  room: (msg: string, data?: any) => console.log(`[ROOM] ${msg}`, data ?? ''),
  socket: (msg: string, data?: any) => console.log(`[SOCKET] ${msg}`, data ?? ''),
  marqueurs: (msg: string, data?: any) => console.log(`[MARQUEURS] ${msg}`, data ?? ''),
  player: (msg: string, data?: any) => console.log(`[PLAYER] ${msg}`, data ?? ''),
  api: (msg: string, data?: any) => console.log(`[API] ${msg}`, data ?? ''),
  error: (msg: string, data?: any) => console.error(`[ERROR] ${msg}`, data ?? ''),
};

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

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function RoomPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const code = params.code as string;
  const memberId = Number(searchParams.get('memberId'));
  const pseudo = searchParams.get('pseudo') || '';

  // === ETATS EXISTANTS ===
  const [playlist, setPlaylist] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [searchUrl, setSearchUrl] = useState('');
  const [currentVideo, setCurrentVideo] = useState<any>(null);
  const [position, setPosition] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [roomInternalId, setRoomInternalId] = useState<number | null>(null);
  const socketRef = useRef<any>(null);
  const isSyncingRef = useRef(false);

  // === NOUVEAUX ETATS : MARQUEURS ===
  const [marqueurs, setMarqueurs] = useState<Marqueur[]>([]);

  const normaliserMarqueur = useCallback((raw: any): Marqueur => {
    return {
      id: String(raw.id),
      timecode: Number(raw.timeSec ?? raw.timecode ?? 0),
      label: raw.label ?? 'Marqueur',
      categorie: raw.category ?? raw.categorie ?? 'COMMENT',
      roomId: String(raw.room?.id ?? roomInternalId ?? ''),
      auteurId: String(raw.createdBy?.id ?? raw.auteurId ?? ''),
      auteurNom: raw.createdBy?.name ?? raw.auteurNom ?? 'Utilisateur',
    } as Marqueur;
  }, [roomInternalId]);

  // === CHARGEMENT DES MARQUEURS ===
  const chargerMarqueurs = useCallback(async (roomIdParam?: number | null) => {
    const idToUse = roomIdParam ?? roomInternalId;
    if (!idToUse) {
      log.marqueurs('Skip chargement marqueurs: roomInternalId indisponible');
      return;
    }

    log.marqueurs('Chargement des marqueurs pour roomId', idToUse);
    try {
      const response = await marqueursApi.getMarqueurs(idToUse);
      const liste = Array.isArray(response.data) ? response.data.map(normaliserMarqueur) : [];
      log.marqueurs(`${liste.length} marqueurs charges (mapping front ok)`, liste);
      setMarqueurs(liste);
    } catch (err) {
      log.error('Erreur chargement marqueurs', err);
      setMarqueurs([]);
    }
  }, [roomInternalId, normaliserMarqueur]);

  // === CREATION D UN NOUVEAU MARQUEUR ===
  const handleNouveauMarqueur = async (timecode: number) => {
    log.marqueurs(`Nouveau marqueur demande a ${timecode}s`);

    if (!roomInternalId) {
      log.error('Creation marqueur impossible: roomInternalId manquant');
      return;
    }

    if (!currentVideo?.youtubeId) {
      log.error('Creation marqueur impossible: youtubeId manquant');
      return;
    }

    if (!Number.isFinite(memberId)) {
      log.error('Creation marqueur impossible: memberId invalide', memberId);
      return;
    }

    try {
      const response = await marqueursApi.creerMarqueur(roomInternalId, {
        timeSec: timecode,
        label: `Marqueur a ${Math.floor(timecode)}s`,
        category: 'COMMENT',
        videoId: currentVideo.youtubeId,
        createdById: memberId,
      });

      const nouveauMarqueur = normaliserMarqueur(response.data);
      log.marqueurs('Marqueur cree avec succes', nouveauMarqueur);
      setMarqueurs((prev) => [...prev, nouveauMarqueur]);

      // TODO NADJIB: si vous ajoutez un event WS marker-created, on le branchera ici.
      // socketRef.current?.emit('marker-created', { roomId: roomInternalId, marker: nouveauMarqueur });
    } catch (err) {
      log.error('Erreur creation marqueur', err);
    }
  };

  const calculateAdjustedPosition = useCallback((playbackData: any) => {
    if (!playbackData) return 0;
    let pos = playbackData.positionSec || 0;
    if (playbackData.status === 'PLAYING' && playbackData.serverTimeRef) {
      const serverTime = new Date(playbackData.serverTimeRef).getTime();
      const now = Date.now();
      const elapsedSeconds = (now - serverTime) / 1000;
      pos = pos + elapsedSeconds;
      if (playbackData.video?.durationSec && pos > playbackData.video.durationSec) {
        pos = playbackData.video.durationSec;
      }
    }
    return pos;
  }, []);

  const loadRoomData = useCallback(async () => {
    log.room('Chargement etat serveur...');
    try {
      const stateRes = await roomsApi.getRoomState(code);
      const stateData = stateRes.data;
      log.api('getRoomState reponse recue', stateData);

      if (isSyncingRef.current) {
        log.room('Synchro en cours, loadRoomData ignore');
        return;
      }

      setRoomInternalId(stateData.roomId ?? null);
      setPlaylist(stateData.playlist);
      setMembers(stateData.members || []);
      log.room(`${stateData.members?.length ?? 0} membres dans la room`);

      if (stateData.playback?.video) {
        setCurrentVideo(stateData.playback.video);
        const adjustedPosition = calculateAdjustedPosition(stateData.playback);
        log.player(`Position ajustee : ${adjustedPosition}s - statut : ${stateData.playback.status}`);
        setPosition(adjustedPosition);
        setIsPlaying(stateData.playback.status === 'PLAYING');
      } else {
        log.room('Aucune video en cours de lecture');
      }

      return stateData;
    } catch (err) {
      log.error('Erreur chargement salon', err);
    }
  }, [code, calculateAdjustedPosition]);

  useEffect(() => {
    log.room(`Initialisation de la room : ${code} - memberId : ${memberId}`);
    const initialLoad = async () => {
      const stateData = await loadRoomData();
      await chargerMarqueurs(stateData?.roomId ?? null);
      setLoading(false);
      log.room('Chargement initial termine');
    };
    initialLoad();
    const interval = setInterval(() => {
      log.room('Polling toutes les 5s...');
      loadRoomData();
    }, 5000);
    return () => clearInterval(interval);
  }, [code, loadRoomData, chargerMarqueurs]);

  useEffect(() => {
    if (!code) return;

    log.socket(`Connexion Socket.io vers ${API_URL}`);
    socketRef.current = io(API_URL, {
      transports: ['websocket', 'polling'],
      extraHeaders: { 'ngrok-skip-browser-warning': 'true' },
    });

    socketRef.current.on('connect', () => {
      log.socket(`Socket connecte - id : ${socketRef.current?.id}`);
      socketRef.current.emit('join-room', { codeRoom: code, memberId });
      log.socket('Evenement join-room emis', { codeRoom: code, memberId });
    });

    socketRef.current.on('disconnect', (reason: string) => {
      log.socket(`Socket deconnecte - raison : ${reason}`);
    });

    socketRef.current.on('connect_error', (err: any) => {
      log.error('Socket erreur de connexion', err.message);
    });

    socketRef.current.on('playback-updated', async (data: any) => {
      log.socket('Evenement playback-updated recu', data);
      isSyncingRef.current = true;
      try {
        let targetPosition = data.playback?.positionSec || 0;
        if (data.action === 'play' && data.playback?.serverTimeRef) {
          const serverTime = new Date(data.playback.serverTimeRef).getTime();
          const now = Date.now();
          targetPosition = targetPosition + (now - serverTime) / 1000;
        }
        log.player(`Synchro position -> ${targetPosition}s - action : ${data.action}`);
        setPosition(targetPosition);
        if (data.action === 'play') {
          setIsPlaying(true);
          log.player('Etat -> PLAYING');
        } else if (data.action === 'pause') {
          setIsPlaying(false);
          log.player('Etat -> PAUSED');
        }
      } catch (error) {
        log.error('Erreur synchronisation socket', error);
      } finally {
        setTimeout(() => { isSyncingRef.current = false; }, 150);
      }
    });

    // TODO NADJIB : ecouter l evenement Socket.io quand un autre user pose un marqueur
    // socketRef.current.on('nouveau_marqueur', (marqueur: Marqueur) => {
    //   log.marqueurs('Nouveau marqueur recu via Socket.io', marqueur);
    //   setMarqueurs((prev) => [...prev, marqueur]);
    // });

    socketRef.current.on('error', (error: any) => {
      log.error('Erreur Socket', error);
    });

    return () => {
      log.socket('Deconnexion Socket.io');
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, [code, memberId]);

  const handlePlay = () => {
    log.player('Bouton Play clique - position actuelle : ' + position);
    setIsPlaying(true);
    socketRef.current?.emit('play', { codeRoom: code, positionSec: position });
    log.socket('Evenement play emis', { codeRoom: code, positionSec: position });
  };

  const handlePause = () => {
    log.player('Bouton Pause clique - position actuelle : ' + position);
    setIsPlaying(false);
    socketRef.current?.emit('pause', { codeRoom: code, positionSec: position });
    log.socket('Evenement pause emis', { codeRoom: code, positionSec: position });
  };

  const handleSeek = (newPosition: number) => {
    log.player(`Seek manuel -> ${newPosition}s`);
    setPosition(newPosition);
    socketRef.current?.emit('seek', { codeRoom: code, positionSec: newPosition, wasPlaying: isPlaying });
    log.socket('Evenement seek emis', { codeRoom: code, positionSec: newPosition, wasPlaying: isPlaying });
  };

  const handleNextVideo = async () => {
    log.room('Bouton Suivant clique');
    try {
      const response = await playlistApi.nextVideo(code);
      const data = response.data;
      log.api('nextVideo reponse', data);
      setPlaylist({ ...playlist, currentIndex: data.currentIndex, entries: data.entries });
      if (data.currentIndex >= 0 && data.entries?.length > 0) {
        const currentEntry = data.entries[data.currentIndex];
        if (currentEntry?.video) {
          socketRef.current?.emit('changeVideo', { roomCode: code, video: currentEntry.video, sourceType: 'PLAYLIST' });
          log.socket('Evenement changeVideo emis', currentEntry.video);
          await loadRoomData();
        }
      }
    } catch (error: any) {
      log.error('Erreur handleNextVideo', error);
      if (error.response?.status === 409) alert('Vous etes deja a la derniere video');
      if (error.response?.status === 404) {
        alert('Endpoint /playlist/next introuvable. Verifiez NEXT_PUBLIC_API_URL et le backend.');
      }
    }
  };

  const handlePreviousVideo = async () => {
    log.room('Bouton Precedent clique');
    try {
      const response = await playlistApi.previousVideo(code);
      const data = response.data;
      log.api('previousVideo reponse', data);
      setPlaylist({ ...playlist, currentIndex: data.currentIndex, entries: data.entries });
      if (data.currentIndex >= 0 && data.entries?.length > 0) {
        const currentEntry = data.entries[data.currentIndex];
        if (currentEntry?.video) {
          socketRef.current?.emit('changeVideo', { roomCode: code, video: currentEntry.video, sourceType: 'PLAYLIST' });
          log.socket('Evenement changeVideo emis', currentEntry.video);
          await loadRoomData();
        }
      }
    } catch (error: any) {
      log.error('Erreur handlePreviousVideo', error);
      if (error.response?.status === 409) alert('Vous etes deja a la premiere video');
      if (error.response?.status === 404) {
        alert('Endpoint /playlist/previous introuvable. Verifiez NEXT_PUBLIC_API_URL et le backend.');
      }
    }
  };

  const handleReorder = async (entryId: number, oldPosition: number, newPosition: number) => {
    log.room(`Reorder entryId:${entryId} de ${oldPosition} vers ${newPosition}`);
    try {
      const response = await playlistApi.reorderPlaylist({ codeRoom: code, memberId, entryId, oldPosition, newPosition });
      log.api('reorderPlaylist reponse', response.data);
      await loadRoomData();
      return response.data;
    } catch (err: any) {
      log.error('Erreur reorganisation', err);
      alert('Erreur lors de la reorganisation: ' + err.message);
      throw err;
    }
  };

  const handleSearch = async (playDirect = true) => {
    if (!searchUrl.trim()) return alert('Entrez une URL');
    log.room(`Recherche video : ${searchUrl} - playDirect : ${playDirect}`);
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
    log.room(`videoId extrait : ${videoId}`);
    try {
      const youtubeRes = await roomsApi.getYouTubeInfo(videoId);
      const youtubeData = youtubeRes.data;
      log.api('getYouTubeInfo reponse', youtubeData);
      if (playDirect) {
        await roomsApi.playDirectVideo({
          codeRoom: code, memberId, youtubeId: videoId,
          youtubeVTitle: youtubeData.title, youtubeVChannel: youtubeData.author,
          youtubeVDurationSec: youtubeData.durationSec || 180,
          youtubeVThumbnailUrl: youtubeData.thumbnail,
        });
        log.room('playDirectVideo appele avec succes');
      } else {
        await playlistApi.addToPlaylist({
          codeRoom: code, memberId, youtubeId: videoId,
          youtubeVTitle: youtubeData.title, youtubeVChannel: youtubeData.author,
          youtubeVDurationSec: youtubeData.durationSec || 180,
          youtubeVThumbnailUrl: youtubeData.thumbnail,
        });
        log.room('addToPlaylist appele avec succes');
        alert('Video ajoutee');
      }
      setSearchUrl('');
      await loadRoomData();
    } catch (err: any) {
      log.error('Erreur recherche video', err);
      alert('Erreur: ' + (err.response?.data?.message || err.message));
    }
  };

  const handlePlayVideo = async (index: number) => {
    log.room(`Lecture video index : ${index}`);
    try {
      await playlistApi.changeIndex(memberId, code, index);
      socketRef.current?.emit('video-change', { codeRoom: code, videoId: playlist.entries[index]?.video?.youtubeId || '' });
      log.socket('Evenement video-change emis');
      await loadRoomData();
    } catch (err: any) {
      log.error('Erreur lecture video', err);
      alert('Erreur: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleDelete = async (entryId: number) => {
    if (!confirm('Supprimer ?')) return;
    log.room(`Suppression video entryId : ${entryId}`);
    try {
      await playlistApi.deleteFromPlaylist(memberId, code, entryId);
      log.api('deleteFromPlaylist succes');
      await loadRoomData();
    } catch (err: any) {
      log.error('Erreur suppression', err);
      alert('Erreur: ' + (err.response?.data?.message || err.message));
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleQuitRoom = () => {
    log.room('Quitter la room');
    if (socketRef.current) socketRef.current.disconnect();
    router.push('/');
  };

  const currentMemberName = members.find(m => m.id === memberId)?.name || "";

  if (loading) return <div className={styles.loading}>Chargement...</div>;

  return (
    <div className={styles.container}>
      <div className={styles.roomHeader}>
        <h1 className={styles.roomTitle}>Salon: {code}</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className={`${styles.connectionBadge} ${socketRef.current?.connected ? styles.connected : styles.disconnected}`}>
            {socketRef.current?.connected ? 'Connecte' : 'Deconnecte'}
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
          >
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
          Jouer
        </button>
        <button onClick={() => handleSearch(false)} className={`${styles.searchButton} ${styles.addButton}`}>
          Playlist
        </button>
      </div>

      {/* Membres */}
      <div className={styles.membersSection}>
        <h3>Membres ({members.length}):</h3>
        <div className={styles.membersList}>
          {members.map(member => (
            member.id === memberId ? (
              <span key={member.id} className={`${styles.memberTag} ${styles.currentMember}`}>
                {member.name} (Vous)
              </span>
            ) : (
              <span key={member.id} className={styles.memberTag}>
                {member.name}
              </span>
            )
          ))}
        </div>
      </div>

      {/* Video en cours */}
      {currentVideo && (
        <div className={styles.videoSection}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {currentVideo.title}
          </h3>
          <p>Chaine: {currentVideo.channelTitle || currentVideo.author}</p>

          <div className={styles.playerContainer}>
            <VideoPlayer
              youtubeId={currentVideo.youtubeId}
              isPlaying={isPlaying}
              currentTime={position}
              roomId={code}
              syncSocket={socketRef.current}
              marqueurs={marqueurs}
              onProgress={(time) => {
                // Log seulement toutes les 5s pour ne pas spammer la console
                if (Math.floor(time) % 5 === 0) {
                  log.player(`onProgress : ${time.toFixed(1)}s`);
                }
                setPosition(time);
              }}
              onPlay={() => {
                log.player('onPlay declenche depuis VideoPlayer');
                handlePlay();
              }}
              onPause={() => {
                log.player('onPause declenche depuis VideoPlayer');
                handlePause();
              }}
              onSeek={(time) => {
                log.player(`onSeek declenche depuis VideoPlayer -> ${time}s`);
                setPosition(time);
                socketRef.current?.emit('seek', { codeRoom: code, positionSec: time, wasPlaying: isPlaying });
                log.socket('Evenement seek emis depuis VideoPlayer', { positionSec: time });
              }}
              onDuration={(duration) => {
                log.player(`Duree video recue : ${duration}s`);
              }}
              onNouveauMarqueur={handleNouveauMarqueur}
            />
          </div>

          {/* Controles */}
          <div className={styles.controlsSection}>
            <div className={styles.controlButtons}>
              <button
                onClick={handlePreviousVideo}
                className={`${styles.controlButton} ${styles.previousButton}`}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}
              >
                Precedent
              </button>
              <button
                onClick={handlePlay}
                className={`${styles.controlButton} ${styles.playButton}`}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}
              >
                Lecture
              </button>
              <button
                onClick={handlePause}
                className={`${styles.controlButton} ${styles.pauseButton}`}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}
              >
                Pause
              </button>
              <button
                onClick={handleNextVideo}
                className={`${styles.controlButton} ${styles.nextButton}`}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}
              >
                Suivant
              </button>
            </div>

            <div className={styles.progressSection}>
              <div className={styles.statusInfo}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <strong>Etat:</strong>
                  {isPlaying ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      En lecture
                    </span>
                  ) : (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
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
