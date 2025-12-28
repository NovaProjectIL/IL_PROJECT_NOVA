'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import io from 'socket.io-client';
import PlaylistComponent from '@/app/components/PlaylistComponent';
import styles from './RoomPage.module.css';

// --- IMPORTS DU CHAT ---
import EmojiPicker, { Theme } from "emoji-picker-react";
import { GiphyFetch } from "@giphy/js-fetch-api";
import { Grid } from "@giphy/react-components";

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
  Send 
} from 'lucide-react';

// ============================================================================
// PARTIE 1 : COMPOSANTS CHAT (Intégrés directement)
// ============================================================================

// Configuration Giphy
const giphyApiKey = "TVQlPggmgsUzg4lyGiR2btZLfpyfw6Z1"; 
const gf = new GiphyFetch(giphyApiKey);

// Types pour le Chat
type Message = {
  username: string;
  message: string | null;
  gifUrl: string | null;
  createdAt: string;
};

type ChatProps = {
  onClose: () => void;
  pseudo: string;
  userId?: number; // ✅ Ajouté pour l'identification
  onMessageReceived?: () => void;
  socket: any;
  roomCode: string;
};

// --- Composant Chat ---
function Chat({ onClose, pseudo, userId, onMessageReceived, socket, roomCode }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [pickerMode, setPickerMode] = useState<'none' | 'emoji' | 'gif'>('none');
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [gifSearch, setGifSearch] = useState("");

  const listRef = useRef<HTMLDivElement | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!socket) return;

    // ✅ Identification automatique à la connexion (Fix "Utilisateur introuvable")
    const identifyAndLoad = () => {
        socket.emit('setUsername', { username: pseudo, userId: userId || 0 });
        if (roomCode) {
            socket.emit('requestMessages', { codeRoom: roomCode });
        }
    };

    if (socket.connected) identifyAndLoad();
    socket.on('connect', identifyAndLoad);

    const handleReceiveMessage = (msg: Message) => {
      setMessages((prev) => [...prev, msg]);
      setTypingUsers((prev) => prev.filter((name) => name !== msg.username));
      if (onMessageReceived) onMessageReceived();
      scrollToBottom();
    };

    const handleUserTyping = (data: { username: string; isTyping: boolean }) => {
      if (data.isTyping) {
        setTypingUsers((prev) => [...new Set([...prev, data.username])]);
      } else {
        setTypingUsers((prev) => prev.filter((name) => name !== data.username));
      }
      scrollToBottom();
    };

    const handleLoadMessages = (histMessages: any[]) => {
        const formatted = histMessages.map(m => ({
            username: m.username,
            message: m.message,
            gifUrl: m.gifUrl,
            createdAt: m.createdAt
        }));
        setMessages(formatted);
        scrollToBottom();
    };

    socket.on("receiveMessage", handleReceiveMessage);
    socket.on("loadMessages", handleLoadMessages);
    socket.on("userTyping", handleUserTyping);

    return () => {
      socket.off("connect", identifyAndLoad);
      socket.off("receiveMessage", handleReceiveMessage);
      socket.off("loadMessages", handleLoadMessages);
      socket.off("userTyping", handleUserTyping);
    };
  }, [socket, onMessageReceived, roomCode, pseudo, userId]);

  const scrollToBottom = () => {
    setTimeout(() => {
      if (listRef.current) {
        listRef.current.scrollTop = listRef.current.scrollHeight;
      }
    }, 100);
  };

  const sendMessage = () => {
    if (!text.trim()) return;
    
    // ✅ CORRECTION CRITIQUE : On envoie 'codeRoom' (attendu par le back) au lieu de 'roomCode'
    // ✅ AJOUT : On envoie userId et username pour l'auto-réparation
    socket?.emit("sendMessage", { 
        codeRoom: roomCode, 
        message: text.trim(), 
        username: pseudo,
        userId: userId
    });
    
    // ✅ Correction ici aussi
    socket?.emit("typing", { codeRoom: roomCode, isTyping: false, username: pseudo });
    
    setText("");
    setPickerMode('none');
  };

  const sendGif = (gifUrl: string) => {
    // ✅ Correction codeRoom + userId
    socket?.emit("sendMessage", { 
        codeRoom: roomCode, 
        gifUrl: gifUrl, 
        username: pseudo,
        userId: userId
    });
    setPickerMode('none');
  };

  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setText(e.target.value);
    
    // ✅ Correction codeRoom
    socket?.emit("typing", { codeRoom: roomCode, isTyping: true, username: pseudo });
    
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      // ✅ Correction codeRoom
      socket?.emit("typing", { codeRoom: roomCode, isTyping: false, username: pseudo });
    }, 2000);
  };

  const fetchGifs = (offset: number) => {
    return gifSearch.trim() === "" 
      ? gf.trending({ offset, limit: 10 })
      : gf.search(gifSearch, { offset, limit: 10 });
  };

  const formatTime = (dateString: string) => {
    if (!dateString) return "";
    return new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <>
      <div className="chat-header-rave">
        <h4 className="m-0 fw-bold text-white" style={{ letterSpacing: '1px', fontSize: '1.2rem' }}>CHAT ROOM</h4>
        <button onClick={onClose} className="btn-icon-rave" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      <div className="chat-body-rave" ref={listRef}>
        {messages.length === 0 && (
          <div className="h-100 d-flex flex-column justify-content-center align-items-center text-white-50 opacity-50">
            <div style={{ marginBottom: '1rem' }}>
              <MessageCircle size={48} strokeWidth={1.5} />
            </div>
            <p className="fw-light ls-1 text-uppercase small">La conversation commence ici</p>
          </div>
        )}

        {messages.map((m, i) => {
          const isMe = m.username === pseudo;
          return (
            <div key={i} className={`chat-message-row ${isMe ? "me" : "other"}`}>
              {!isMe && <span className="username-label">{m.username}</span>}
              {m.message && <div className={`message-bubble ${isMe ? "message-me" : "message-other"}`}>{m.message}</div>}
              {m.gifUrl && (
                <div className={`mt-2 ${isMe ? 'text-end' : 'text-start'}`}>
                    <img src={m.gifUrl} alt="GIF" className="gif-image" style={{maxHeight: '150px', maxWidth: '100%'}} />
                </div>
              )}
              <span className="message-time">{formatTime(m.createdAt)}</span>
            </div>
          );
        })}

        {typingUsers.length > 0 && (
          <div className="text-white-50 ms-3 fst-italic small mt-2">
            <span className="spinner-grow spinner-grow-sm me-2" role="status" aria-hidden="true"></span>
            {typingUsers.length > 2 ? "Plusieurs personnes écrivent..." : typingUsers.join(", ") + " écrit..."}
          </div>
        )}
      </div>

      <div className="chat-input-rave position-relative">
        {pickerMode !== 'none' && (
            <div className="picker-overlay">
                <div className="picker-tabs">
                    <button className={`picker-tab ${pickerMode === 'emoji' ? 'active' : ''}`} onClick={() => setPickerMode('emoji')}>Emojis</button>
                    <button className={`picker-tab ${pickerMode === 'gif' ? 'active' : ''}`} onClick={() => setPickerMode('gif')}>GIFs</button>
                    <button className="btn-close-custom" onClick={() => setPickerMode('none')}>X</button>
                </div>
                <div className="flex-grow-1 position-relative overflow-hidden h-100">
                  {pickerMode === 'emoji' && (
                      <EmojiPicker 
                          onEmojiClick={(e) => setText((prev) => prev + e.emoji)} 
                          width="100%" height="100%" theme={Theme.DARK}
                          previewConfig={{ showPreview: false }}
                          style={{background: 'transparent', border: 'none'}}
                      />
                  )}
                  {pickerMode === 'gif' && (
                      <div className="h-100 d-flex flex-column">
                          <div className="px-3 pb-2">
                             <input type="text" className="form-control bg-dark text-white border-secondary form-control-sm rounded-pill" placeholder="Rechercher un GIF..." value={gifSearch} onChange={(e) => setGifSearch(e.target.value)} autoFocus />
                          </div>
                          <div className="flex-grow-1 overflow-auto px-2 pb-2 d-flex justify-content-center">
                              <Grid fetchGifs={fetchGifs} width={340} columns={3} gutter={6} noLink={true} key={gifSearch} onGifClick={(gif, e) => { e.preventDefault(); sendGif(gif.images.original.url); }} />
                          </div>
                      </div>
                  )}
                </div>
            </div>
        )}

        <div className="input-group-rave">
            <button className={`btn-icon-rave ${pickerMode !== 'none' ? 'text-white' : ''}`} onClick={() => setPickerMode(pickerMode === 'none' ? 'emoji' : 'none')}>
              <Plus size={20} />
            </button>
            <input type="text" className="form-control-rave" placeholder="Envoyer un message..." value={text} onChange={handleTyping} onKeyDown={(e) => e.key === "Enter" && sendMessage()} onFocus={() => setPickerMode('none')} />
            <button className="btn-send-rave" onClick={sendMessage} disabled={!text.trim()}>
              <Send size={20} />
            </button>
        </div>
      </div>
    </>
  );
}

// --- Composant ChatWidget ---
interface ChatWidgetProps {
  pseudo?: string;
  socket: any;
  roomCode: string;
  userId?: number; // ✅ Ajouté ici aussi
}

function ChatWidget({ pseudo = "Invité", userId, socket, roomCode }: ChatWidgetProps) {
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

  // Si on n'a pas de code de room, on n'affiche rien pour éviter les erreurs
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
            userId={userId} // ✅ On transmet l'ID au Chat
            onMessageReceived={handleMessageReceived} 
            socket={socket} 
            roomCode={roomCode} 
          />
        </div>
      </div>
    </>
  );
}

// ============================================================================
// PARTIE 2 : PAGE PRINCIPALE (RoomPage) - LOGIQUE INCHANGÉE
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

  // Trouver le pseudo du membre actuel pour le chat
  const currentMemberName = members.find(m => m.id === memberId)?.name || "Invité";

  if (loading) return <div className={styles.loading}>Chargement...</div>;

  return (
    <div className={styles.container}>
      <div className={styles.roomHeader}>
        <h1 className={styles.roomTitle}>Salon: {code}</h1>
        <div className={`${styles.connectionBadge} ${socketRef.current?.connected ? styles.connected : styles.disconnected}`}>
          {socketRef.current?.connected ? '🟢 Connecté' : '🔴 Déconnecté'}
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
              {member.name} {member.id === memberId && '(Vous)'}
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
          
          {/* Contrôles - MODIFIÉ */}
          <div className={styles.controlsSection}>
            <div className={styles.controlButtons}>
              {/* Bouton Précédent */}
              <button 
                onClick={handlePreviousVideo} 
                className={`${styles.controlButton} ${styles.previousButton}`}
                title="Vidéo précédente"
                style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}
              >
                <SkipBack size={18} />
                Précédent
              </button>
              
              {/* Bouton Play */}
              <button 
                onClick={handlePlay} 
                className={`${styles.controlButton} ${styles.playButton}`}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}
              >
                <Play size={18} />
                Play
              </button>
              
              {/* Bouton Pause */}
              <button 
                onClick={handlePause} 
                className={`${styles.controlButton} ${styles.pauseButton}`}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}
              >
                <Pause size={18} />
                Pause
              </button>
              
              {/* Bouton Suivant */}
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
      
      {/* 🟢 INTÉGRATION DU CHAT */}
      <ChatWidget 
        socket={socketRef.current} 
        roomCode={code} 
        pseudo={currentMemberName} 
        userId={memberId} // ✅ LA PIÈCE MANQUANTE
      />
      
    </div>
  );
}