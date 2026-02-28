/**
 * Types globaux pour l'application
 */

/**
 * Utilisateur
 */
export interface User {
  id: number;
  name: string;
  email?: string;
  createdAt?: string;
}

/**
 * État de lecture
 */
export type PlayStatus = 'PLAYING' | 'PAUSED' | 'BUFFERING';

/**
 * État de synchronisation temps réel
 */
export interface PlaybackState {
  status: PlayStatus;
  positionSec: number;
  playbackRate: number;
  serverTimeRef: string;  // ISO timestamp du serveur
  video?: {
    youtubeId: string;
    title: string;
    durationSec: number;
  };
}

/**
 * Entrée de playlist
 */
export interface PlaylistEntry {
  id: number;
  video: {
    youtubeId: string;
    title: string;
    channel: string;
    durationSec: number;
    thumbnailUrl: string;
  };
}

/**
 * État global d'une room
 */
export interface RoomState {
  code: string;
  playback: PlaybackState;
  playlist: {
    currentIndex: number;
    entries: PlaylistEntry[];
  };
  users: User[];
  markers?: any[];  // Sera typé avec Marker
}
