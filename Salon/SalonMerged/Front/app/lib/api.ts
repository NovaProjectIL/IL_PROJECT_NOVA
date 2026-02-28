// app/lib/api.ts
import axios from 'axios';

const API_URL = 'https://vulgarly-unforcible-loura.ngrok-free.dev';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
    // ✅ FIX PRINCIPAL : Contourner l'avertissement ngrok
    'ngrok-skip-browser-warning': 'true',
  },
  timeout: 10000,
});

// Intercepteur pour logging des erreurs
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('❌ API Error:', {
      url: error.config?.url,
      method: error.config?.method,
      status: error.response?.status,
      message: error.message,
      data: error.response?.data, // ✅ Afficher les données d'erreur
    });
    return Promise.reject(error);
  }
);

// ✅ FIX BONUS : Intercepteur pour vérifier les réponses HTML
api.interceptors.response.use(
  (response) => {
    // Vérifier si on a reçu du HTML au lieu de JSON
    if (typeof response.data === 'string' && response.data.startsWith('<!DOCTYPE')) {
      console.error('⚠️ Réponse HTML détectée au lieu de JSON !');
      console.error('URL:', response.config.url);
      console.error('Headers:', response.config.headers);
      throw new Error('Réponse HTML reçue - vérifier la configuration ngrok');
    }
    return response;
  },
  (error) => {
    console.error('❌ API Error:', {
      url: error.config?.url,
      method: error.config?.method,
      status: error.response?.status,
      message: error.message,
    });
    return Promise.reject(error);
  }
);

// ==================== ROOMS API ====================
export const roomsApi = {
  // === Salles ===
  createRoom: (displayName: string) => 
   api.post('/rooms', { displayName }),
  
  joinRoom: (displayName: string, codeRoom: string) => 
    api.post('/rooms/join', { displayName, codeRoom }),
  
  inviteRoom: (codeRoom: string) =>
    api.post('/rooms/invite', { codeRoom }),
  
  leaveRoom: (memberId: number, codeRoom: string) => 
    api.post('/rooms/leave', { memberId, codeRoom }),
  
  endRoom: (memberId: number, codeRoom: string) =>
    api.post('/rooms/End', { memberId, codeRoom }),
  
  // === Playback (pour WebSocket) ===
  play: (codeRoom: string, positionSec?: number) => 
    api.post('/rooms/play', { codeRoom, positionSec }),
  
  pause: (codeRoom: string, positionSec?: number) => 
    api.post('/rooms/pause', { codeRoom, positionSec }),
  
  seek: (codeRoom: string, positionSec: number) =>
    api.post('/rooms/seek', { codeRoom, positionSec }),
  
  // === Vidéo directe ===
  playDirectVideo: (data: {
    codeRoom: string;
    memberId: number;
    youtubeId: string;
    youtubeVTitle: string;
    youtubeVChannel: string;
    youtubeVDurationSec: number;
    youtubeVThumbnailUrl: string;
  }) => api.post('/rooms/play-direct', data),
  
  videoEnded: (codeRoom: string) =>
    api.post('/rooms/video-ended', { codeRoom }),
  
  // === GET Endpoints ===
  getRoomMembers: (codeRoom: string) =>
    api.get('/rooms/members', { params: { codeRoom } }),
  
  getRoomState: (codeRoom: string) => 
    api.get('/rooms/state', { params: { codeRoom } }),
  
  getPlayback: (codeRoom: string) =>
    api.get('/rooms/playback', { params: { codeRoom } }),
  
  getYouTubeInfo: (videoId: string) =>
    api.get('/rooms/youtube-info', { params: { videoId } }),
  
  healthCheck: () => api.get('/rooms/health'),
};

// ==================== PLAYLIST API ====================
export const playlistApi = {
  // === GET ===
  getPlaylist: (codeRoom: string) => 
    api.get('/playlist', { params: { codeRoom } }),
  
  // === POST ===
  addToPlaylist: (data: {
    memberId: number;
    codeRoom: string;
    youtubeId: string;
    youtubeVTitle: string;
    youtubeVChannel: string;
    youtubeVDurationSec: number;
    youtubeVThumbnailUrl: string;
  }) => api.post('/playlist/add', data),
  
  deleteFromPlaylist: (memberId: number, codeRoom: string, entryId: number) => 
    api.post('/playlist/delete', { memberId, codeRoom, entryId }),
  
  changeIndex: (memberId: number, codeRoom: string, newIndex: number) =>
    api.post('/playlist/change-index', { memberId, codeRoom, newIndex }),
  
  reorderPlaylist: (data: {
    memberId: number;
    codeRoom: string;
    entryId: number;
    oldPosition: number;
    newPosition: number;
  }) => api.post('/playlist/reorder', data),
  
  nextVideo: (codeRoom: string) =>
    api.post('/playlist/next', { codeRoom }),
  
  previousVideo: (codeRoom: string) =>
    api.post('/playlist/previous', { codeRoom }),
};

// ==================== MARKERS API ====================
export const markersApi = {
  // === GET : Récupérer tous les marqueurs d'une room ===
  // Support BOTH roomId (numero) AND roomCode (string)
  getMarkers: (roomIdentifier: number | string) => {
    // Si c'est un nombre, c'est un roomId (chemin)
    // Si c'est un string, c'est un roomCode (paramètre query)
    if (typeof roomIdentifier === 'number') {
      return api.get(`/rooms/${roomIdentifier}/markers`);
    } else {
      // Pour roomCode, on utilise l'ancienne route avec paramètre query
      // À long terme, le backend devrait supporter /rooms/:code/markers
      return api.get('/rooms/markers', { params: { codeRoom: roomIdentifier } });
    }
  },
  
  // === POST : Créer un nouveau marqueur ===
  createMarker: (roomIdentifier: number | string, data: {
    timeSec: number;
    label: string;
    content?: string;
    category?: 'ERROR' | 'COMMENT' | 'HIGHLIGHT' | 'QUESTION';
    videoId: string;       // youtubeId
    createdById: number;   // userId
  }) => {
    if (typeof roomIdentifier === 'number') {
      return api.post(`/rooms/${roomIdentifier}/markers`, data);
    } else {
      return api.post('/rooms/markers', { ...data, codeRoom: roomIdentifier });
    }
  },
  
  // === PATCH : Mettre à jour un marqueur ===
  updateMarker: (roomIdentifier: number | string, markerId: number, data: {
    timeSec?: number;
    label?: string;
    content?: string;
    category?: 'ERROR' | 'COMMENT' | 'HIGHLIGHT' | 'QUESTION';
    version: number;  // Obligatoire pour optimistic locking
  }) => {
    if (typeof roomIdentifier === 'number') {
      return api.patch(`/rooms/${roomIdentifier}/markers/${markerId}`, data);
    } else {
      return api.patch(`/rooms/markers/${markerId}`, { ...data, codeRoom: roomIdentifier });
    }
  },
  
  // === DELETE : Supprimer un marqueur ===
  deleteMarker: (roomIdentifier: number | string, markerId: number) => {
    if (typeof roomIdentifier === 'number') {
      return api.delete(`/rooms/${roomIdentifier}/markers/${markerId}`);
    } else {
      return api.delete(`/rooms/markers/${markerId}`, { params: { codeRoom: roomIdentifier } });
    }
  },
};

export default api;