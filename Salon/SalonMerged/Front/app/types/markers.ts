/**
 * Types pour la gestion des marqueurs vidéo
 * Alignés avec le backend NestJS
 */

export type MarkerCategory = 'ERROR' | 'COMMENT' | 'HIGHLIGHT' | 'QUESTION';

/**
 * Structure d'un marqueur stocké en base
 */
export interface Marker {
  id: number;
  timeSec: number;           // Position en secondes
  label: string;             // Titre court (max 100 caractères)
  content?: string;          // Description optionnelle
  category: MarkerCategory;
  version: number;           // Pour optimistic locking
  createdBy?: {
    id: number;
    name: string;
  };
  createdAt?: string;        // ISO timestamp
  updatedAt?: string;        // ISO timestamp
}

/**
 * DTO pour créer un marqueur
 */
export interface CreateMarkerInput {
  timeSec: number;
  label: string;
  content?: string;
  category?: MarkerCategory;
  videoId: string;           // youtubeId
  createdById: number;       // userId
}

/**
 * DTO pour mettre à jour un marqueur
 */
export interface UpdateMarkerInput {
  timeSec?: number;
  label?: string;
  content?: string;
  category?: MarkerCategory;
  version: number;           // Obligatoire pour éviter conflits
}

/**
 * État global des marqueurs en mémoire
 */
export interface MarkersState {
  items: Map<number, Marker>;  // indexed by id
  loading: boolean;
  error: string | null;
  lastSyncTime: number;        // timestamp du dernier chargement
}

/**
 * Payload des événements WebSocket
 */
export interface MarkerSocketEvent {
  marker: Marker;
  roomCode: string;
  timestamp: string;
}

export interface MarkerDeletedEvent {
  markerId: number;
  roomCode: string;
  timestamp: string;
}

/**
 * Couleurs pour l'UI selon la catégorie
 */
export const MARKER_COLORS: Record<MarkerCategory, string> = {
  ERROR: '#ff4444',      // Rouge
  COMMENT: '#ffaa00',    // Orange
  HIGHLIGHT: '#00ff00',  // Vert
  QUESTION: '#4444ff',   // Bleu
};

/**
 * Labels en français pour chaque catégorie
 */
export const MARKER_LABELS: Record<MarkerCategory, string> = {
  ERROR: '❌ Erreur',
  COMMENT: '💬 Commentaire',
  HIGHLIGHT: '⭐ Moment clé',
  QUESTION: '❓ Question',
};
