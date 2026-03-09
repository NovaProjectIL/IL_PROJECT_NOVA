// app/lib/youtube.ts
import { roomsApi } from './api';

/**
 * Extrait l'ID YouTube d'une URL ou d'un texte
 * @param input URL YouTube ou ID vidéo (11 caractères)
 * @returns ID YouTube ou null si invalide
 */
export function extractYouTubeId(input: string): string | null {
  if (!input || typeof input !== 'string') return null;
  
  const trimmed = input.trim();
  
  // Patterns pour extraire l'ID
  const patterns = [
    // youtube.com/watch?v=XXXXXXXXXXX
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    // ID seul (11 caractères)
    /^([a-zA-Z0-9_-]{11})$/
  ];
  
  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  return null;
}

/**
 * Vérifie si une chaîne est un ID YouTube valide
 * @param id Chaîne à vérifier
 * @returns boolean
 */
export function isValidYouTubeId(id: string | null): boolean {
  if (!id) return false;
  return /^[a-zA-Z0-9_-]{11}$/.test(id);
}

/**
 * Récupère les informations d'une vidéo YouTube
 * UTILISE VOTRE BACKEND NESTJS qui est déjà excellent
 * @param videoId ID de la vidéo YouTube
 * @returns Promise avec les infos ou null
 */
export async function getYouTubeVideoInfo(videoId: string): Promise<{
  success: boolean;
  title: string;
  author: string;
  thumbnail: string;
  durationSec: number;
} | null> {
  if (!isValidYouTubeId(videoId)) {
    console.error(' ID YouTube invalide:', videoId);
    return null;
  }
  
  try {
    console.log('📡 Récupération infos YouTube pour:', videoId);
    
    // ⬇️ UTILISEZ VOTRE BACKEND QUI EST DÉJÀ EXCELLENT
    const response = await roomsApi.getYouTubeInfo(videoId);
    const data = response.data;
    
    return {
      success: data.success,
      title: data.title || `Vidéo ${videoId}`,
      author: data.author || 'YouTube',
      thumbnail: data.thumbnail || `https://img.youtube.com/vi/${videoId}/0.jpg`,
      durationSec: data.durationSec || 180,
    };
    
  } catch (error: any) {
    console.error('Erreur récupération YouTube:', {
      videoId,
      message: error.message,
      status: error.response?.status
    });
    
    // Fallback minimal
    return {
      success: false,
      title: `Vidéo ${videoId}`,
      author: 'YouTube',
      thumbnail: `https://img.youtube.com/vi/${videoId}/0.jpg`,
      durationSec: 180,
    };
  }
}

/**
 * Génère l'URL de la miniature YouTube
 * @param videoId ID de la vidéo
 * @param quality Qualité ('default' | 'medium' | 'high' | 'maxres')
 * @returns URL de la miniature
 */
export function getYouTubeThumbnail(videoId: string, quality: 'default' | 'medium' | 'high' | 'maxres' = 'medium'): string {
  const qualities = {
    default: `https://img.youtube.com/vi/${videoId}/default.jpg`,
    medium: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
    high: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
    maxres: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
  };
  
  return qualities[quality];
}

/**
 * Formate la durée en secondes vers HH:MM:SS ou MM:SS
 * @param seconds Durée en secondes
 * @returns Chaîne formatée
 */
export function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '0:00';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  } else {
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }
}

/**
 * Vérifie si une URL est une URL YouTube valide
 * @param url URL à vérifier
 * @returns boolean
 */
export function isYouTubeUrl(url: string): boolean {
  if (!url) return false;
  
  const patterns = [
    /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/,
    /^[a-zA-Z0-9_-]{11}$/
  ];
  
  return patterns.some(pattern => pattern.test(url.trim()));
}

