// app/lib/api.ts
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true',
  },
  timeout: 10000, // Timeout de 10 secondes
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

export default api;