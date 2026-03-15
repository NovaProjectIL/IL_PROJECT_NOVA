'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import io from 'socket.io-client';
import PlaylistComponent from '@/app/components/PlaylistComponent';
import ChatWidget from '@/app/components/ChatWidget';
import { useMarkers } from '@/app/hooks/useMarkers';
import styles from './RoomPage.module.css';
import VideoPlayer from '@/app/components/VideoPlayer';
import { roomsApi, playlistApi } from '@/app/lib/api';

const log = {
  room: (msg: string, data?: any) => console.log(`[ROOM] ${msg}`, data ?? ''),
  socket: (msg: string, data?: any) => console.log(`[SOCKET] ${msg}`, data ?? ''),
  marqueurs: (msg: string, data?: any) => console.log(`[MARQUEURS] ${msg}`, data ?? ''),
  player: (msg: string, data?: any) => console.log(`[PLAYER] ${msg}`, data ?? ''),
  api: (msg: string, data?: any) => console.log(`[API] ${msg}`, data ?? ''),
  error: (msg: string, data?: any) => console.error(`[ERROR] ${msg}`, data ?? ''),
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function RoomPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const code = (params.code as string)?.toUpperCase();
  const memberId = Number(searchParams.get('memberId'));
  const pseudo = searchParams.get('pseudo') || '';

  const [playlist, setPlaylist] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [searchUrl, setSearchUrl] = useState('');
  const [currentVideo, setCurrentVideo] = useState<any>(null);
  const [position, setPosition] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [roomInternalId, setRoomInternalId] = useState<number | null>(null);
  const [showQuitModal, setShowQuitModal] = useState(false);
  const socketRef = useRef<any>(null);

  const [indexActuel, setIndexActuel] = useState<number>(-1);
  const { marqueurs, setMarqueurs, creer: creerMarqueur } = useMarkers(roomInternalId, socketRef.current, code);

  const stateRef = useRef({ position, isPlaying });
  const isUpdatingFromSocket = useRef(false);

  useEffect(() => {
    stateRef.current = { position, isPlaying };
  }, [position, isPlaying]);

  useEffect(() => {
    if (marqueurs.length === 0) {
      setIndexActuel(-1);
      return;
    }
    const tries = [...marqueurs].sort((a, b) => a.timecode - b.timecode);
    let idx = -1;
    for (let i = 0; i < tries.length; i++) {
      if (tries[i].timecode <= position) idx = i;
    }
    if (idx !== indexActuel) {
      setIndexActuel(idx);
    }
  }, [position, marqueurs, indexActuel]);

  const calculateAdjustedPosition = useCallback((playbackData: any) => {
    if (!playbackData) return 0;
    let pos = Number(playbackData.positionSec || 0);
    if (playbackData.status === 'PLAYING' && playbackData.serverTimeRef) {
      const serverTime = new Date(playbackData.serverTimeRef).getTime();
      const now = Date.now();
      const elapsedSeconds = (now - serverTime) / 1000;
      pos += elapsedSeconds;
      if (playbackData.video?.durationSec && pos > playbackData.video.durationSec) {
        pos = playbackData.video.durationSec;
      }
    }
    return pos;
  }, []);

  const loadRoomData = useCallback(async () => {
    if (!code) return;
    try {
      const stateRes = await roomsApi.getRoomState(code);
      const stateData = stateRes.data;
      
      setRoomInternalId(stateData.roomId ?? null);
      setPlaylist(stateData.playlist);
      setMembers(stateData.members || []);
      
      if (stateData.playback?.video) {
        setCurrentVideo((prev: any) => {
          if (prev?.youtubeId !== stateData.playback.video.youtubeId) {
            const adjustedPosition = calculateAdjustedPosition(stateData.playback);
            setPosition(adjustedPosition);
            setIsPlaying(stateData.playback.status === 'PLAYING');
            return stateData.playback.video;
          }
          return prev;
        });
      }
      return stateData;
    } catch (err) {
      log.error('Erreur chargement salon', err);
    }
  }, [code, calculateAdjustedPosition]);

  useEffect(() => {
    if (!code) return;
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
    const socket = io(API_URL, {
      transports: ['websocket', 'polling'],
      extraHeaders: { 'ngrok-skip-browser-warning': 'true' },
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      log.socket('Connecté au serveur sync', { code, memberId });
      socket.emit('join-room', { codeRoom: code, memberId });
    });

    socket.on('room-joined-confirm', (data: any) => {
      log.socket('Confirmation de jointure de salle reçue', data);
    });

    socket.on('room-initial-state', (data: any) => {
      log.socket('État initial reçu', data);
      isUpdatingFromSocket.current = true;
      if (data.playback?.video) {
        setCurrentVideo(data.playback.video);
        const adjusted = calculateAdjustedPosition(data.playback);
        setPosition(adjusted);
        setIsPlaying(data.playback.status === 'PLAYING');
      }
      if (data.users) setMembers(data.users);
      setTimeout(() => { isUpdatingFromSocket.current = false; }, 1000);
    });

    socket.on('playback-updated', (data: any) => {
      log.socket('Playback updated reçu', data);
      isUpdatingFromSocket.current = true;
      
      if (data.action === 'play') {
        const targetPos = calculateAdjustedPosition(data.playback);
        setPosition(targetPos);
        setIsPlaying(true);
      } else if (data.action === 'pause') {
        setPosition(data.playback.positionSec || 0);
        setIsPlaying(false);
      } else if (data.action === 'seek') {
        const targetPos = calculateAdjustedPosition(data.playback);
        setPosition(targetPos);
        // Preserve play/pause state from server
        setIsPlaying(data.playback.status === 'PLAYING');
      }
      
      setTimeout(() => { isUpdatingFromSocket.current = false; }, 1000);
    });

    socket.on('nouveau_marqueur', (marqueurBrut: any) => {
      const m = {
        id: String(marqueurBrut.id),
        timecode: Number(marqueurBrut.timeSec ?? marqueurBrut.timecode ?? 0),
        label: marqueurBrut.label ?? 'Marqueur',
        categorie: marqueurBrut.category ?? marqueurBrut.categorie ?? 'COMMENT',
        roomId: String(marqueurBrut.room?.id ?? roomInternalId ?? ''),
        auteurId: String(marqueurBrut.createdBy?.id ?? marqueurBrut.auteurId ?? ''),
        auteurNom: marqueurBrut.createdBy?.name ?? marqueurBrut.auteurNom ?? 'Utilisateur',
      };
      setMarqueurs((prev) => {
        if (prev.find(x => x.id === m.id)) return prev;
        return [...prev, m];
      });
    });

    socket.on('video-changed', (data: any) => {
      log.socket('Video changed reçu', data);
      loadRoomData();
    });

    // Wait-for-Ready: server orders all clients to seek to a position
    socket.on('force-seek', (data: any) => {
      log.socket('Force-seek reçu', data);
      isUpdatingFromSocket.current = true;
      const targetPos = Number(data.timecode ?? 0);
      setPosition(targetPos);
      // Always pause during LOADING - all-ready will decide whether to resume
      setIsPlaying(false);
      setTimeout(() => { isUpdatingFromSocket.current = false; }, 1500);
    });

    // Wait-for-Ready: all clients buffered, resume together
    socket.on('all-ready', (data: any) => {
      log.socket('All-ready reçu', data);
      isUpdatingFromSocket.current = true;
      const pos = Number(data.positionSec ?? 0);
      const shouldPlay = data.shouldPlay !== false; // default true for backward compat
      setPosition(pos);
      setIsPlaying(shouldPlay);
      setTimeout(() => { isUpdatingFromSocket.current = false; }, 1000);
    });

    socket.on('user-joined', (data: any) => {
      log.socket('User joined reçu', data);
      loadRoomData();
    });

    // A remote client started buffering: server orders everyone to pause
    socket.on('force-pause', (data: any) => {
      log.socket('Force-pause reçu (un client charge)', data);
      isUpdatingFromSocket.current = true;
      setIsPlaying(false);
      // We're already at the right position and paused, so we're "ready"
      setTimeout(() => {
        socket.emit('client-ready', { codeRoom: code });
        log.socket('Emitting client-ready after force-pause');
      }, 500);
      setTimeout(() => { isUpdatingFromSocket.current = false; }, 1000);
    });

    return () => {
      socket.off('nouveau_marqueur');
      socket.off('force-pause');
      socket.disconnect();
    };
  }, [code, memberId, roomInternalId, calculateAdjustedPosition, loadRoomData, setMarqueurs]);

  const handlePlay = () => {
    if (isUpdatingFromSocket.current) return;
    if (!code) return;
    log.player('Local play -> emit play socket', { code, pos: stateRef.current.position });
    setIsPlaying(true);
    socketRef.current?.emit('play', { codeRoom: code, positionSec: stateRef.current.position });
  };

  const handlePause = () => {
    if (isUpdatingFromSocket.current) return;
    if (!code) return;
    log.player('Local pause -> emit pause socket', { code, pos: stateRef.current.position });
    setIsPlaying(false);
    socketRef.current?.emit('pause', { codeRoom: code, positionSec: stateRef.current.position });
  };

  const handleSeek = (newPosition: number) => {
    if (isUpdatingFromSocket.current) return;
    if (!code) return;
    log.player('Local seek -> emit seek socket', { code, pos: newPosition });
    isUpdatingFromSocket.current = true;
    setPosition(newPosition);
    socketRef.current?.emit('seek', { codeRoom: code, positionSec: newPosition, wasPlaying: stateRef.current.isPlaying });
    // The seeker already seeked locally, so force-seek won't trigger a remote-sync
    // in VideoPlayer (no diff). Emit client-ready directly after a short delay.
    setTimeout(() => {
      socketRef.current?.emit('client-ready', { codeRoom: code });
      log.player('Seeker emitting client-ready after local seek');
    }, 800);
    setTimeout(() => { isUpdatingFromSocket.current = false; }, 1500);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleQuitRoom = () => {
    setShowQuitModal(true);
  };

  const confirmQuit = () => {
    setShowQuitModal(false);
    if (socketRef.current) socketRef.current.disconnect();
    router.push('/');
  };

  if (loading) return <div className={styles.loading}>Chargement...</div>;

  return (
    <div className={styles.container}>
      <div className={styles.roomHeader}>
        <h1 className={styles.roomTitle}>Salon: {code}</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={handleQuitRoom} className={styles.quitButton}>Quitter</button>
        </div>
      </div>

      <div className={styles.searchSection}>
        <input type="text" value={searchUrl} onChange={(e) => setSearchUrl(e.target.value)} placeholder="URL YouTube" className={styles.searchInput} onKeyPress={(e) => e.key === 'Enter' && handleSearch()} />
        <button onClick={() => handleSearch(true)} className={styles.searchButton}>Jouer</button>
        <button onClick={() => handleSearch(false)} className={`${styles.searchButton} ${styles.addButton}`}>+ Playlist</button>
      </div>

      <div className={styles.membersSection}>
        <h3>Membres ({members.length}):</h3>
        <div className={styles.membersList}>
          {members.map(member => (
            <span key={member.id} className={`${styles.memberTag} ${member.id === memberId ? styles.currentMember : ''}`}>
              {member.name} {member.id === memberId ? '(Vous)' : ''}
            </span>
          ))}
        </div>
      </div>

      {currentVideo && (
        <div className={styles.videoSection}>
          <h3>{currentVideo.title}</h3>
          <div className={styles.playerContainer}>
            <VideoPlayer
              youtubeId={currentVideo.youtubeId}
              isPlaying={isPlaying}
              currentTime={position}
              roomId={code}
              syncSocket={socketRef.current}
              marqueurs={marqueurs}
              indexActuel={indexActuel}
              onProgress={(time) => { if (!isUpdatingFromSocket.current) setPosition(time); }}
              onPlay={handlePlay}
              onPause={handlePause}
              onSeek={handleSeek}
              onDuration={() => {}}
              onNouveauMarqueur={async (timecode) => {
                if (!roomInternalId || !currentVideo?.youtubeId) return;
                await creerMarqueur(roomInternalId, memberId, timecode, currentVideo.youtubeId, socketRef.current, code);
              }}
            />
          </div>

          <div className={styles.controlsSection}>
            <div className={styles.controlButtons}>
<button onClick={async () => {
                try {
                  const response = await playlistApi.previousVideo(code);
                  const data = response.data;
                  if (data.currentIndex >= 0 && data.entries?.length > 0) {
                    const currentEntry = data.entries[data.currentIndex];
                    if (currentEntry?.video) {
                      socketRef.current?.emit('video-change', { codeRoom: code, videoId: currentEntry.video.youtubeId });
                      await loadRoomData();
                    }
                  }
                } catch (error: any) { log.error('Erreur previous video', error); }
              }} className={`${styles.controlButton} ${styles.previousButton}`} title="Précédent">
                <svg viewBox="0 0 24 24" fill="currentColor" height="24" width="24">
                  <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>
                </svg>
              </button>
              
              <button onClick={handlePlay} className={`${styles.controlButton} ${styles.playButton}`} title="Play">
                <svg viewBox="0 0 24 24" fill="currentColor" height="28" width="28">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              </button>
              <button onClick={handlePause} className={`${styles.controlButton} ${styles.pauseButton}`} title="Pause">
                <svg viewBox="0 0 24 24" fill="currentColor" height="28" width="28">
                  <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
                </svg>
              </button>
              
              <button onClick={async () => {
                try {
                  const response = await playlistApi.nextVideo(code);
                  const data = response.data;
                  if (data.currentIndex >= 0 && data.entries?.length > 0) {
                    const currentEntry = data.entries[data.currentIndex];
                    if (currentEntry?.video) {
                      socketRef.current?.emit('video-change', { codeRoom: code, videoId: currentEntry.video.youtubeId });
                      await loadRoomData();
                    }
                  }
                } catch (error: any) { log.error('Erreur next video', error); }
              }} className={`${styles.controlButton} ${styles.nextButton}`} title="Suivant">
                <svg viewBox="0 0 24 24" fill="currentColor" height="24" width="24">
                  <path d="M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12z"/>
                </svg>
              </button>
            </div>
            <div className={styles.statusInfo}>
              <span className={styles.statusBadge}>
                <span className={styles.statusIcon} aria-hidden="true">
                  {isPlaying ? (
                    <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
                      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                    </svg>
                  )}
                </span>
                <span className={styles.statusText}>{isPlaying ? 'Lecture' : 'Pause'}</span>
              </span>
              <span className={styles.statusTime}>{formatTime(position)} / {formatTime(currentVideo.durationSec || 0)}</span>
            </div>
          </div>
        </div>
      )}

      <PlaylistComponent 
        playlist={playlist} 
        code={code} 
        memberId={memberId} 
        onPlayVideo={async (index) => {
          try {
            await playlistApi.changeIndex(memberId, code, index);
            const videoId = playlist.entries[index]?.video?.youtubeId;
            if (videoId) socketRef.current?.emit('video-change', { codeRoom: code, videoId });
            await loadRoomData();
          } catch (err: any) { log.error('Erreur play video', err); }
        }} 
        onDeleteVideo={async (entryId) => {
          if (!confirm('Supprimer ?')) return;
          try {
            await playlistApi.deleteFromPlaylist(memberId, code, entryId);
            await loadRoomData();
          } catch (err: any) { log.error('Erreur suppression', err); }
        }} 
        onReorder={async (entryId, oldPos, newPos) => {
          const res = await playlistApi.reorderPlaylist({ codeRoom: code, memberId, entryId, oldPosition: oldPos, newPosition: newPos });
          await loadRoomData();
          return res.data;
        }} 
        isLoading={loading} 
      />

      <ChatWidget socket={socketRef.current} roomCode={code} pseudo={pseudo} userId={memberId} getCurrentTime={() => position} onSeek={handleSeek} />

      {showQuitModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999,
        }}>
          <div style={{
            background: 'rgba(88, 12, 31, 0.95)',
            border: '1px solid rgba(197, 34, 51, 0.4)',
            borderRadius: '20px',
            padding: '40px',
            maxWidth: '420px',
            width: '90%',
            textAlign: 'center',
            boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🚪</div>
            <h2 style={{ color: 'white', fontSize: '1.5rem', fontWeight: 800, marginBottom: '12px' }}>
              Quitter le salon ?
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.7)', marginBottom: '32px', lineHeight: '1.6' }}>
              Tu vas quitter la session en cours. Les autres participants continueront sans toi.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                onClick={() => setShowQuitModal(false)}
                style={{
                  padding: '12px 28px',
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '12px',
                  color: 'white',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: '1rem',
                  transition: 'all 0.2s',
                }}
              >
                Rester
              </button>
              <button
                onClick={confirmQuit}
                style={{
                  padding: '12px 28px',
                  background: 'linear-gradient(135deg, #C52233, #74121D)',
                  border: 'none',
                  borderRadius: '12px',
                  color: 'white',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: '1rem',
                  boxShadow: '0 4px 12px rgba(197,34,51,0.5)',
                  transition: 'all 0.2s',
                }}
              >
                Quitter
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  async function handleSearch(playDirect = true) {
    if (!searchUrl.trim()) return;
    let videoId = '';
    if (searchUrl.includes('v=')) videoId = searchUrl.split('v=')[1].split('&')[0];
    else if (searchUrl.includes('youtu.be/')) videoId = searchUrl.split('youtu.be/')[1].split('?')[0];
    else if (searchUrl.length === 11) videoId = searchUrl;
    
    try {
      const youtubeRes = await roomsApi.getYouTubeInfo(videoId);
      const youtubeData = youtubeRes.data;
      if (playDirect) {
        await roomsApi.playDirectVideo({ codeRoom: code, memberId, youtubeId: videoId, youtubeVTitle: youtubeData.title, youtubeVChannel: youtubeData.author, youtubeVDurationSec: youtubeData.durationSec || 180, youtubeVThumbnailUrl: youtubeData.thumbnail });
        socketRef.current?.emit('video-change', { codeRoom: code, videoId });
      } else {
        await playlistApi.addToPlaylist({ codeRoom: code, memberId, youtubeId: videoId, youtubeVTitle: youtubeData.title, youtubeVChannel: youtubeData.author, youtubeVDurationSec: youtubeData.durationSec || 180, youtubeVThumbnailUrl: youtubeData.thumbnail });
      }
      setSearchUrl('');
      await loadRoomData();
    } catch (err: any) {
      log.error('Erreur recherche', err);
    }
  }
}
