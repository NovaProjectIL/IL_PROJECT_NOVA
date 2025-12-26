'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import io from 'socket.io-client';
import PlaylistComponent from '@/app/components/PlaylistComponent';
import styles from './RoomPage.module.css';

// Ajoutez ces interfaces/types
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

// Utilisez une URL relative ou vérifiez l'environnement
const API_URL = 'http://localhost:3001';

console.log('🌐 URL API:', API_URL);

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
  const [playerInitAttempt, setPlayerInitAttempt] = useState(0);
  
  const socketRef = useRef<any>(null);
  const playerRef = useRef<any>(null);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const isSyncingRef = useRef(false);

  // Fonction pour passer à la vidéo suivante
// Fonction pour passer à la vidéo suivante
const handleNextVideo = async () => {
  console.log(' Bouton Suivant cliqué');
  console.log('État playlist:', {
    currentIndex: playlist?.currentIndex,
    totalVideos: playlist?.entries?.length
  });
  
  try {
    const response = await fetch(`${API_URL}/playlist/next`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        codeRoom: code
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      
      if (response.status === 409) {
        console.log('Déjà à la dernière vidéo');
        alert('Vous êtes déjà à la dernière vidéo');
        return;
      }
      
      throw new Error(errorData.message || `Erreur ${response.status}`);
    }
    
    const data = await response.json();
    console.log(' Données next reçues:', data);
    
    // Mettre à jour l'état local immédiatement
    setPlaylist({
      ...playlist,
      currentIndex: data.currentIndex,
      entries: data.entries
    });
    
    // Si une vidéo est disponible, émettre le changement
    if (data.currentIndex >= 0 && data.entries?.length > 0) {
      const currentEntry = data.entries[data.currentIndex];
      if (currentEntry?.video) {
        console.log('🎬 Changement vers:', currentEntry.video.title);
        
        // Émettre via socket pour synchroniser tous les clients
        socketRef.current?.emit('changeVideo', {
          roomCode: code,
          video: currentEntry.video,
          sourceType: 'PLAYLIST'
        });
        
        // Recharger pour être sûr
        await loadRoomData();
      }
    }
  } catch (error) {
    console.error(' Erreur handleNextVideo:', error);

  }
};

// Fonction pour revenir à la vidéo précédente
const handlePreviousVideo = async () => {
  console.log(' Bouton Précédent cliqué');
  console.log(' État playlist:', {
    currentIndex: playlist?.currentIndex,
    totalVideos: playlist?.entries?.length
  });
  
  try {
    const response = await fetch(`${API_URL}/playlist/previous`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        codeRoom: code
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      
      if (response.status === 409) {
        console.log(' Déjà à la première vidéo');
        alert('Vous êtes déjà à la première vidéo');
        return;
      }
      
      throw new Error(errorData.message || `Erreur ${response.status}`);
    }
    
    const data = await response.json();
    console.log(' Données previous reçues:', data);
    
    // Mettre à jour l'état local immédiatement
    setPlaylist({
      ...playlist,
      currentIndex: data.currentIndex,
      entries: data.entries
    });
    
    // Si une vidéo est disponible, émettre le changement
    if (data.currentIndex >= 0 && data.entries?.length > 0) {
      const currentEntry = data.entries[data.currentIndex];
      if (currentEntry?.video) {
        console.log('🎬 Changement vers:', currentEntry.video.title);
        
        // Émettre via socket pour synchroniser tous les clients
        socketRef.current?.emit('changeVideo', {
          roomCode: code,
          video: currentEntry.video,
          sourceType: 'PLAYLIST'
        });
        
        // Recharger pour être sûr
        await loadRoomData();
      }
    }
  } catch (error) {
    console.error(' Erreur handlePreviousVideo:', error);
   
  }
};


 

  const handleReorder = async (entryId: number, oldPosition: number, newPosition: number) => {
    console.log(' Réorganisation:', { entryId, oldPosition, newPosition });
    
    try {
      const response = await fetch(`${API_URL}/playlist/reorder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codeRoom: code,
          memberId,
          entryId,
          oldPosition,
          newPosition
        })
      });
      
      if (!response.ok) {
        throw new Error(`Erreur HTTP: ${response.status}`);
      }
      
      const result = await response.json();
      console.log('Playlist réorganisée:', result);
      
      await loadRoomData();
      
      return result;
    } catch (err: any) {
      console.error(' Erreur réorganisation:', err);
      alert('Erreur lors de la réorganisation: ' + err.message);
      throw err;
    }
  };

  // Ajoutez cette fonction
const calculateAdjustedPosition = useCallback((playbackData: any) => {
  if (!playbackData) return 0;
  
  let position = playbackData.positionSec || 0;
  
  // Si la vidéo est en lecture, ajuster avec le temps écoulé
  if (playbackData.status === 'PLAYING' && playbackData.serverTimeRef) {
    const serverTime = new Date(playbackData.serverTimeRef).getTime();
    const now = Date.now();
    const elapsedSeconds = (now - serverTime) / 1000;
    position = position + elapsedSeconds;
    
    // Ne pas dépasser la durée de la vidéo
    if (playbackData.video?.durationSec && position > playbackData.video.durationSec) {
      position = playbackData.video.durationSec;
    }
  }
  
  return position;
}, []);

// Modifiez loadRoomData
const loadRoomData = useCallback(async () => {
  try {
    console.log('📡 Chargement état serveur...');
    const stateRes = await fetch(`${API_URL}/rooms/state?codeRoom=${code}`);
    const stateData = await stateRes.json();
    
    // Vérifier si une synchro est en cours
    if (isSyncingRef.current) {
      console.log('⏳ Synchro en cours, ignore loadRoomData');
      return;
    }
    
    setPlaylist(stateData.playlist);
    setMembers(stateData.members || []);
    
    if (stateData.playback?.video) {
      setCurrentVideo(stateData.playback.video);
      
      // Calculer la position ajustée
      const adjustedPosition = calculateAdjustedPosition(stateData.playback);
      console.log(' Position ajustée:', adjustedPosition, 'vs original:', stateData.playback.positionSec);
      
      setPosition(adjustedPosition);
      setIsPlaying(stateData.playback.status === 'PLAYING');
      
      // Appliquer au player si prêt
      if (playerRef.current && isPlayerReady && !isSyncingRef.current) {
        const playerPosition = playerRef.current.getCurrentTime?.() || 0;
        
        // Synchroniser seulement si la différence est significative
        if (Math.abs(playerPosition - adjustedPosition) > 2) {
          console.log(' Sync depuis loadRoomData:', adjustedPosition);
          playerRef.current.seekTo(adjustedPosition, true);
        }
      }
    }
  } catch (err) {
    console.error(' Erreur chargement salon:', err);
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
    // Vérifier si l'API est déjà chargée
    if (window.YT) {
      setIsYTReady(true);
      return;
    }
    
    // Vérifier si le script est déjà en cours de chargement
    if (document.querySelector('script[src*="youtube.com/iframe_api"]')) {
      const interval = setInterval(() => {
        if (window.YT) {
          setIsYTReady(true);
          clearInterval(interval);
        }
      }, 100);
      
      return () => clearInterval(interval);
    }
    
    // Créer et charger le script
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    tag.async = true;
    
    // Définir le callback AVANT de charger le script
    window.onYouTubeIframeAPIReady = () => {
      console.log('🎬 YouTube API prête');
      setIsYTReady(true);
    };
    
    // Insérer le script
    const firstScriptTag = document.getElementsByTagName('script')[0];
    if (firstScriptTag?.parentNode) {
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    } else {
      document.head.appendChild(tag);
    }
    
    // Nettoyage
    return () => {
      // Réinitialiser le callback à une fonction vide
      window.onYouTubeIframeAPIReady = () => {};
    };
  }, []);

  useEffect(() => {
    if (!currentVideo || !isYTReady) {
      console.log(' En attente: ', {
        hasVideo: !!currentVideo,
        youtubeId: currentVideo?.youtubeId,
        isYTReady
      });
      return;
    }
    
    console.log('Création du player pour:', currentVideo.youtubeId);
    
    if (playerRef.current && playerRef.current.destroy) {
      playerRef.current.destroy();
      playerRef.current = null;
      setIsPlayerReady(false);
    }
    
    if (!window.YT || !window.YT.Player) {
      console.error('window.YT.Player non disponible');
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
            // IMPORTANT: Ignorer TOUT quand on reçoit une synchro du socket
            if (isSyncingRef.current) return;
            
            const state = event.data;
            const currentPos = event.target.getCurrentTime();
            
            // Envoyer UNIQUEMENT les actions MANUELLES de l'utilisateur local
            if (state === 1) { // Lecture
              // Si on était pas déjà en lecture, c'est que l'utilisateur a cliqué play
              if (!isPlaying) {
                setIsPlaying(true);
                socketRef.current?.emit('play', { 
                  codeRoom: code, 
                  positionSec: currentPos
                });
              }
            } 
            else if (state === 2) { // Pause
              // Si on était en lecture, c'est que l'utilisateur a cliqué pause
              if (isPlaying) {
                setIsPlaying(false);
                socketRef.current?.emit('pause', { 
                  codeRoom: code, 
                  positionSec: currentPos
                });
              }
            }
            // IGNORER les états 3 (buffering) et 5 (cue)
          },
          onError: (event: any) => {
            console.error('Erreur YouTube player');
          }
        }
      });
    } catch (error) {
      console.error('Erreur création player:', error);
    }
    
    return () => {
      if (playerRef.current && playerRef.current.destroy) {
        console.log(' Destruction du player');
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
    });
    
    socketRef.current.on('connect', () => {
      console.log(' Socket.io connecté');
      socketRef.current.emit('join-room', { codeRoom: code, memberId });
    });
    
    socketRef.current.on('playback-updated', async (data: any) => {
      console.log(' Socket reçu:', data.action, 'position:', data.playback?.positionSec);
      
      // 1. Vérifier si le player est prêt
      if (!playerRef.current || !isPlayerReady) {
        console.log(' Player pas prêt, chargement état...');
        await loadRoomData(); // Charger l'état quand même
        return;
      }
      
      // 2. Activer le mode synchronisation
      isSyncingRef.current = true;
      
      try {
        // 3. CALCULER la position actuelle (IMPORTANT pour la synchro)
        let targetPosition = data.playback?.positionSec || 0;
        
        if (data.action === 'play' && data.playback?.serverTimeRef) {
          // Si c'est un play, ajuster la position avec le temps écoulé
          const serverTime = new Date(data.playback.serverTimeRef).getTime();
          const now = Date.now();
          const elapsedSeconds = (now - serverTime) / 1000;
          targetPosition = targetPosition + elapsedSeconds;
          console.log(' Position ajustée:', targetPosition, 'elapsed:', elapsedSeconds);
        }
        
        // 4. Synchroniser la position AVANT play/pause
        if (targetPosition > 0) {
          console.log(' Seek socket vers:', targetPosition);
          playerRef.current.seekTo(targetPosition, true);
          setPosition(targetPosition);
        }
        
        // 5. Synchroniser play/pause
        if (data.action === 'play') {
          console.log(' Play socket');
          playerRef.current.playVideo();
          setIsPlaying(true);
        } else if (data.action === 'pause') {
          console.log('Pause socket');
          playerRef.current.pauseVideo();
          setIsPlaying(false);
        } else if (data.action === 'seek') {
          console.log(' Seek socket seulement');
          // Pour seek, on ne change pas l'état play/pause
        }
        
      } catch (error) {
        console.error('Erreur synchronisation socket:', error);
      } finally {
        // 6. Désactiver le mode synchro après un délai
        setTimeout(() => {
          isSyncingRef.current = false;
          console.log(' Synchronisation terminée');
        }, 150); // Légèrement plus long pour être sûr
      }
    });
    
    socketRef.current.on('error', (error: any) => {
      console.error(' Erreur Socket:', error);
    });
    
    return () => {
      console.log('🔌 Déconnexion Socket.io');
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [code, memberId, isPlayerReady]);

  const handlePlay = () => {
    console.log('Bouton Play cliqué');
    
    if (playerRef.current && isPlayerReady) {
      try {
        const currentPos = playerRef.current.getCurrentTime();
        console.log(' Position actuelle:', currentPos);
        
        playerRef.current.playVideo();
        setIsPlaying(true);
        setPosition(currentPos);
        
        socketRef.current?.emit('play', { 
          codeRoom: code, 
          positionSec: currentPos
        });
        
        console.log('Événement play envoyé');
      } catch (error) {
        console.error('Erreur handlePlay:', error);
      }
    } else {
      console.error(' Player non prêt');
    }
  };
  
  const handlePause = () => {
    console.log('Bouton Pause cliqué');
    
    if (playerRef.current && isPlayerReady) {
      try {
        const currentPos = playerRef.current.getCurrentTime();
        console.log(' Position actuelle:', currentPos);
        
        playerRef.current.pauseVideo();
        setIsPlaying(false);
        setPosition(currentPos);
        
        socketRef.current?.emit('pause', { 
          codeRoom: code, 
          positionSec: currentPos
        });
        
        console.log(' Événement pause envoyé');
      } catch (error) {
        console.error(' Erreur handlePause:', error);
      }
    } else {
      console.error(' Player non prêt');
    }
  };

const handleSeek = (newPosition: number) => {
  console.log(' Seek manuel à:', newPosition);
  
  if (playerRef.current && isPlayerReady) {
    try {
      // 1. Activer le mode synchro AVANT de chercher
      isSyncingRef.current = true;
      
      // 2. Mettre à jour localement SANS passer par les événements YouTube
      playerRef.current.seekTo(newPosition, true);
      setPosition(newPosition);
      
      // 3. Envoyer le seek au serveur MAIS sans émettre de pause
      socketRef.current?.emit('seek', { 
        codeRoom: code, 
        positionSec: newPosition,
        wasPlaying: isPlaying // Informer si on était en lecture
      });
      
      // 4. Désactiver le mode synchro après un court délai
      setTimeout(() => {
        isSyncingRef.current = false;
        console.log(' Mode synchro désactivé après seek');
      }, 500); // Augmenter le délai
      
    } catch (error) {
      console.error(' Erreur handleSeek:', error);
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
      const youtubeRes = await fetch(`${API_URL}/rooms/youtube-info?videoId=${videoId}`);
      const youtubeData = await youtubeRes.json();
      
      if (playDirect) {
        // Jouer directement
        await fetch(`${API_URL}/rooms/play-direct`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            codeRoom: code,
            memberId,
            youtubeId: videoId,
            youtubeVTitle: youtubeData.title,
            youtubeVChannel: youtubeData.author,
            youtubeVDurationSec: youtubeData.durationSec || 180,
            youtubeVThumbnailUrl: youtubeData.thumbnail,
          })
        });
      } else {
        // Ajouter à playlist (si cette route existe)
        await fetch(`${API_URL}/playlist/add`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            codeRoom: code,
            memberId,
            youtubeId: videoId,
            youtubeVTitle: youtubeData.title,
            youtubeVChannel: youtubeData.author,
            youtubeVDurationSec: youtubeData.durationSec || 180,
            youtubeVThumbnailUrl: youtubeData.thumbnail,
          })
        });
        alert(' Vidéo ajoutée');
      }
      
      setSearchUrl('');
      await loadRoomData();
      
    } catch (err: any) {
      alert('Erreur: ' + err.message);
    }
  };

  const handlePlayVideo = async (index: number) => {
    try {
      await fetch(`${API_URL}/playlist/change-index`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codeRoom: code,
          memberId,
          newIndex: index,
        })
      });
      
      socketRef.current?.emit('video-change', { 
        codeRoom: code,
        videoId: playlist.entries[index]?.video?.youtubeId || ''
      });
      
      await loadRoomData();
    } catch (err: any) {
      alert('Erreur: ' + err.message);
    }
  };

  const handleDelete = async (entryId: number) => {
    if (!confirm('Supprimer ?')) return;
    try {
      await fetch(`${API_URL}/playlist/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codeRoom: code,
          memberId,
          entryId,
        })
      });
      await loadRoomData();
    } catch (err: any) {
      alert('Erreur: ' + err.message);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  if (loading) return <div className={styles.loading}>Chargement...</div>;

  return (
    <div className={styles.container}>
      <h1>Salon: {code}</h1>
      <p>Votre ID: {memberId}</p>
      <div className={`${styles.connectionStatus} ${socketRef.current?.connected ? styles.connected : styles.disconnected}`}>
        {socketRef.current?.connected ? ' Connecté en temps réel' : ' Déconnecté'}
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
          ▶️ Jouer
        </button>
        <button onClick={() => handleSearch(false)} className={`${styles.searchButton} ${styles.addButton}`}>
          ➕ Playlist
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
              {member.name} {member.id === memberId && '(Vous)'}
            </span>
          ))}
        </div>
      </div>
      
      {/* Vidéo en cours */}
      {currentVideo && (
        <div className={styles.videoSection}>
          <h3>🎬 {currentVideo.title}</h3>
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
                  <div className={styles.overlayText}>⏳ Chargement du player YouTube...</div>
                  <div className={styles.videoId}>Vidéo: {currentVideo.youtubeId}</div>
                </div>
              </div>
            )}
            
            {isYTReady && !isPlayerReady && (
              <div className={styles.playerOverlay}>
                <div className={styles.overlayContent}>
                  <div className={styles.overlayText}>🎬 Initialisation du player...</div>
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
                '✅ Player prêt - Synchronisation activée'
              ) : (
                '⏳ Player en cours d\'initialisation...'
              )
            ) : (
              '⏳ Chargement de l\'API YouTube...'
            )}
          </div>
          
          {/* Contrôles - MODIFIÉ */}
          <div className={styles.controlsSection}>
            <div className={styles.controlButtons}>
              {/* Bouton Précédent - SIMPLIFIÉ */}
              <button 
                onClick={handlePreviousVideo} 
                className={`${styles.controlButton} ${styles.previousButton}`}
                title="Vidéo précédente"
              >
                ⏮️ Précédent
              </button>
              
              {/* Bouton Play */}
              <button 
                onClick={handlePlay} 
                className={`${styles.controlButton} ${styles.playButton}`}
              >
                ▶️ Play
              </button>
              
              {/* Bouton Pause */}
              <button 
                onClick={handlePause} 
                className={`${styles.controlButton} ${styles.pauseButton}`}
              >
                ⏸️ Pause
              </button>
              
              {/* Bouton Suivant - SIMPLIFIÉ */}
              <button 
                onClick={handleNextVideo} 
                className={`${styles.controlButton} ${styles.nextButton}`}
                title="Vidéo suivante"
              >
                Suivant ⏭️
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
                <span><strong>État:</strong> {isPlaying ? '▶️ En lecture' : '⏸️ En pause'}</span>
                <span className={styles.positionInfo}>
                  <strong>Position:</strong> {formatTime(position)} / {currentVideo.durationSec ? formatTime(currentVideo.durationSec) : '??:??'}
                </span>
                
                {/* Info playlist si disponible */}
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
      
    </div>
  );
}