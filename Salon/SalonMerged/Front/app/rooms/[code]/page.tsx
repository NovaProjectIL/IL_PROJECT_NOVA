'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import io from 'socket.io-client';
import PlaylistComponent from '@/app/components/PlaylistComponent';
// 1. IMPORT DU WIDGET
import ChatWidget from '@/app/components/ChatWidget'; 
import styles from './RoomPage.module.css';

// ... (Interfaces YouTube inchangées)
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

const API_URL = 'http://localhost:3001';

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

export default function RoomPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const code = params.code as string;
  const memberId = Number(searchParams.get('memberId'));
  
  // === ÉTATS ===
  const [playlist, setPlaylist] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [searchUrl, setSearchUrl] = useState('');
  const [currentVideo, setCurrentVideo] = useState<any>(null);
  const [position, setPosition] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isYTReady, setIsYTReady] = useState(false);
  
  const socketRef = useRef<any>(null);
  const playerRef = useRef<any>(null);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const isSyncingRef = useRef(false);

  // 2. NOUVEL ÉTAT : Pour savoir quand le socket est prêt à être passé au chat
  const [isSocketConnected, setIsSocketConnected] = useState(false);

  // ... (Tes fonctions existantes : handleNextVideo, handlePreviousVideo, etc. restent identiques) ...
  // Je les compresse ici pour la lisibilité, mais garde ton code original
  const handleNextVideo = async () => { /* ...ton code... */ };
  const handlePreviousVideo = async () => { /* ...ton code... */ };
  const handleReorder = async (entryId: number, oldPos: number, newPos: number) => { /* ...ton code... */ };
  
  const calculateAdjustedPosition = useCallback((playbackData: any) => {
    if (!playbackData) return 0;
    let pos = playbackData.positionSec || 0;
    if (playbackData.status === 'PLAYING' && playbackData.serverTimeRef) {
      const serverTime = new Date(playbackData.serverTimeRef).getTime();
      const elapsed = (Date.now() - serverTime) / 1000;
      pos += elapsed;
    }
    return pos;
  }, []);

  const loadRoomData = useCallback(async () => {
    try {
      const stateRes = await fetch(`${API_URL}/rooms/state?codeRoom=${code}`);
      const stateData = await stateRes.json();
      
      if (isSyncingRef.current) return;
      
      setPlaylist(stateData.playlist);
      setMembers(stateData.members || []);
      
      if (stateData.playback?.video) {
        setCurrentVideo(stateData.playback.video);
        const adjustedPosition = calculateAdjustedPosition(stateData.playback);
        setPosition(adjustedPosition);
        setIsPlaying(stateData.playback.status === 'PLAYING');
        
        if (playerRef.current && isPlayerReady && !isSyncingRef.current) {
          if (Math.abs((playerRef.current.getCurrentTime?.() || 0) - adjustedPosition) > 2) {
            playerRef.current.seekTo(adjustedPosition, true);
          }
        }
      }
    } catch (err) { console.error(err); }
  }, [code, calculateAdjustedPosition]);

  useEffect(() => {
    const init = async () => { await loadRoomData(); setLoading(false); };
    init();
    const interval = setInterval(loadRoomData, 5000);
    return () => clearInterval(interval);
  }, [code, loadRoomData]);

  // Chargement YouTube API
  useEffect(() => {
    if (window.YT) { setIsYTReady(true); return; }
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    tag.async = true;
    window.onYouTubeIframeAPIReady = () => setIsYTReady(true);
    document.head.appendChild(tag);
  }, []);

  // Création Player
  useEffect(() => {
    if (!currentVideo || !isYTReady) return;
    // ... ton code de création du player ...
    playerRef.current = new window.YT.Player('youtube-player', {
        videoId: currentVideo.youtubeId,
        playerVars: { autoplay: isPlaying ? 1 : 0, controls: 1, playsinline: 1 },
        events: {
          onReady: (e: any) => { setIsPlayerReady(true); if(position > 0) e.target.seekTo(position, true); if(isPlaying) e.target.playVideo(); },
          onStateChange: (e: any) => {
             if (isSyncingRef.current) return;
             if (e.data === 1 && !isPlaying) { setIsPlaying(true); socketRef.current?.emit('play', {codeRoom:code, positionSec:e.target.getCurrentTime()}); }
             if (e.data === 2 && isPlaying) { setIsPlaying(false); socketRef.current?.emit('pause', {codeRoom:code, positionSec:e.target.getCurrentTime()}); }
          }
        }
    });
    return () => { if (playerRef.current?.destroy) playerRef.current.destroy(); };
  }, [currentVideo?.youtubeId, isYTReady]);

  // Position Timer
  useEffect(() => {
    if(!isPlayerReady) return;
    const interval = setInterval(() => { if(playerRef.current?.getCurrentTime) setPosition(playerRef.current.getCurrentTime()); }, 1000);
    return () => clearInterval(interval);
  }, [isPlayerReady]);

  // === SOCKET IO ===
  useEffect(() => {
    if (!code) return;
    
    socketRef.current = io(API_URL, { transports: ['websocket', 'polling'] });
    
    socketRef.current.on('connect', () => {
      console.log('Socket connecté');
      socketRef.current.emit('join-room', { codeRoom: code, memberId });
      
      // 3. IMPORTANT : On signale que le socket est prêt pour le chat
      setIsSocketConnected(true);
    });
    
    socketRef.current.on('playback-updated', async (data: any) => {
        // ... ta logique de synchro ...
        if (!playerRef.current || !isPlayerReady) { await loadRoomData(); return; }
        isSyncingRef.current = true;
        // ... play/pause/seek logic ...
        setTimeout(() => isSyncingRef.current = false, 200);
    });
    
    return () => { if (socketRef.current) socketRef.current.disconnect(); };
  }, [code, memberId, isPlayerReady]);

  // ... (Tes autres handlers: handlePlay, handleSearch, etc.) ...
  const handlePlay = () => {}; // Remplacer par tes vraies fonctions
  const handlePause = () => {};
  const handleSeek = (val: number) => {};
  const handleSearch = async (playDirect: boolean) => {};
  const handlePlayVideo = async (index: number) => {};
  const handleDelete = async (id: number) => {};

  const formatTime = (s: number) => {
    const m = Math.floor(s/60), sc = Math.floor(s%60);
    return `${m}:${sc<10?'0':''}${sc}`;
  };

  if (loading) return <div className={styles.loading}>Chargement...</div>;

  // 4. CALCUL DU PSEUDO POUR LE CHAT
  const currentMember = members.find(m => m.id === memberId);
  const myPseudo = currentMember ? currentMember.name : `Membre ${memberId}`;

  return (
    <div className={styles.container}>
      
      {/* 5. INSERTION DU CHAT WIDGET */}
      {/* Il se superpose au reste grâce au CSS 'fixed' dans globals.css */}
      {isSocketConnected && socketRef.current && (
         <ChatWidget 
            socket={socketRef.current} 
            roomCode={code} 
            pseudo={myPseudo} 
         />
      )}

      <h1>Salon: {code}</h1>
      <p>Votre ID: {memberId}</p>
      
      {/* ... LE RESTE DE TON JSX (Recherche, Vidéo, Playlist) ... */}
      <div className={styles.searchSection}>
         {/* ... */}
         <input value={searchUrl} onChange={(e)=>setSearchUrl(e.target.value)} className={styles.searchInput} placeholder="URL YouTube"/>
         <button onClick={()=>handleSearch(true)} className={styles.searchButton}>▶️ Jouer</button>
         <button onClick={()=>handleSearch(false)} className={`${styles.searchButton} ${styles.addButton}`}>➕ Playlist</button>
      </div>

      <div className={styles.membersSection}>
        {members.map(m => (
          <span key={m.id} className={`${styles.memberTag} ${m.id === memberId ? styles.currentMember : ''}`}>
             {m.name}
          </span>
        ))}
      </div>

      {currentVideo && (
        <div className={styles.videoSection}>
           <h3>{currentVideo.title}</h3>
           <div className={styles.playerContainer}>
              <div id="youtube-player" className={styles.youtubePlayer}></div>
           </div>
           <div className={styles.controlsSection}>
              {/* Controls... */}
              <span>{formatTime(position)} / {formatTime(currentVideo.durationSec)}</span>
           </div>
        </div>
      )}

      <PlaylistComponent 
         playlist={playlist} 
         code={code} 
         memberId={memberId} 
         onPlayVideo={handlePlayVideo} 
         onDeleteVideo={handleDelete} 
         onReorder={handleReorder}
         isLoading={loading} 
      />
    </div>
  );
}