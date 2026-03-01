/**
 * Hook personnalisé pour gérer les marqueurs d'une room
 * 
 * Responsabilités :
 * - Charger les marqueurs depuis l'API
 * - Écouter les événements websocket (créer, met à jour, supprimer)
 * - Mettre en cache les marqueurs en mémoire
 * - Fournir des méthodes pour créer/mettre à jour/supprimer
 * - Gérer le loading et erreurs
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { Marker, CreateMarkerInput, UpdateMarkerInput } from '@/app/types/markers';
import { markersApi } from '@/app/lib/api';
import { socketService } from '@/app/lib/socket';

interface UseMarkersOptions {
  roomId?: number;
  roomCode?: string;
  enabled?: boolean;  // Pour contrôler si on charge automatiquement
  autoRefresh?: number;  // Intervalle de rafraîchissement en ms (0 = désactivé)
}

export function useMarkers(options: UseMarkersOptions) {
  const { roomId, roomCode, enabled = true, autoRefresh = 0 } = options;
  
  // ✅ Toujours déclarer les hooks en premier (avant tout conditionnel)
  const [markers, setMarkers] = useState<Map<number, Marker>>(new Map());
  const [loading, setLoading] = useState(() => enabled && (!!roomId || !!roomCode) ? true : false);
  const [error, setError] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<number>(0);
  
  const isMountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  const roomIdentifier = roomId || roomCode;
  
  // Maintenant on peut faire la logique conditionnelle

  /**
   * Charger tous les marqueurs depuis l'API
   */
  const loadMarkers = useCallback(async () => {
    if (!roomIdentifier || !enabled) return;

    try {
      setLoading(true);
      setError(null);

      const response = await markersApi.getMarkers(roomIdentifier);
      const data = response.data as Marker[];

      if (isMountedRef.current) {
        // Construire une Map pour accès rapide par id
        const markersMap = new Map(data.map((m) => [m.id, m]));
        setMarkers(markersMap);
        setLastSyncTime(Date.now());
        console.log(`✅ ${data.length} marqueurs chargés pour room ${roomIdentifier}`);
      }
    } catch (err: any) {
      const errorMsg = err?.response?.data?.message || err?.message || 'Erreur inconnue';
      if (isMountedRef.current) {
        setError(errorMsg);
        console.error('❌ Erreur chargement marqueurs:', errorMsg);
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [roomIdentifier, enabled]);

  /**
   * Charger les marqueurs au montage et configurer l'auto-refresh
   */
  useEffect(() => {
    if (!enabled || !roomIdentifier) return;

    loadMarkers();

    // Auto-refresh optionnel
    let interval: NodeJS.Timeout | null = null;
    if (autoRefresh > 0) {
      interval = setInterval(loadMarkers, autoRefresh);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [roomIdentifier, enabled, autoRefresh, loadMarkers]);

  /**
   * Écouter les événements WebSocket
   */
  useEffect(() => {
    if (!enabled || !roomIdentifier) return;

    // Événement : marqueur créé par quelqu'un d'autre
    socketService.onMarkerCreated((newMarker: Marker) => {
      if (isMountedRef.current) {
        setMarkers((prev) => {
          const updated = new Map(prev);
          updated.set(newMarker.id, newMarker);
          return updated;
        });
        console.log('➕ Marqueur créé via socket:', newMarker.label);
      }
    });

    // Événement : marqueur mis à jour par quelqu'un d'autre
    socketService.onMarkerUpdated((updatedMarker: Marker) => {
      if (isMountedRef.current) {
        setMarkers((prev) => {
          const updated = new Map(prev);
          updated.set(updatedMarker.id, updatedMarker);
          return updated;
        });
        console.log('✏️ Marqueur mis à jour via socket:', updatedMarker.label);
      }
    });

    // Événement : marqueur supprimé par quelqu'un d'autre
    socketService.onMarkerDeleted((markerId: number) => {
      if (isMountedRef.current) {
        setMarkers((prev) => {
          const updated = new Map(prev);
          updated.delete(markerId);
          return updated;
        });
        console.log('🗑️ Marqueur supprimé via socket, id:', markerId);
      }
    });

    // Nettoyage : désabonnement ne sera pas fait car socketService ne fournit
    // pas de méthode "off". C'est un pattern courant avec socket.io.
    // Dans une vraie production, ajouter des méthodes d'unsubscribe à socketService.
  }, [enabled, roomIdentifier]);

  /**
   * Créer un marqueur
   */
  const createMarker = useCallback(
    async (input: CreateMarkerInput) => {
      if (!roomIdentifier) throw new Error('roomIdentifier manquant');
      
      try {
        const response = await markersApi.createMarker(roomIdentifier, input);
        const newMarker = response.data as Marker;

        if (isMountedRef.current) {
          // Mettre à jour immédiatement en local (optimistic update)
          setMarkers((prev) => {
            const updated = new Map(prev);
            updated.set(newMarker.id, newMarker);
            return updated;
          });
        }

        console.log('✅ Marqueur créé:', newMarker.label);
        return newMarker;
      } catch (err: any) {
        const errorMsg = err?.response?.data?.message || 'Erreur création marqueur';
        setError(errorMsg);
        throw err;
      }
    },
    [roomIdentifier]
  );

  /**
   * Mettre à jour un marqueur
   */
  const updateMarker = useCallback(
    async (markerId: number, input: UpdateMarkerInput) => {
      if (!roomIdentifier) throw new Error('roomIdentifier manquant');
      
      try {
        const response = await markersApi.updateMarker(roomIdentifier, markerId, input);
        const updatedMarker = response.data as Marker;

        if (isMountedRef.current) {
          // Optimistic update local
          setMarkers((prev) => {
            const updated = new Map(prev);
            updated.set(markerId, updatedMarker);
            return updated;
          });
        }

        console.log('✅ Marqueur mis à jour:', updatedMarker.label);
        return updatedMarker;
      } catch (err: any) {
        const errorMsg = err?.response?.data?.message || 'Erreur mise à jour marqueur';
        setError(errorMsg);
        throw err;
      }
    },
    [roomIdentifier]
  );

  /**
   * Supprimer un marqueur
   */
  const deleteMarker = useCallback(
    async (markerId: number) => {
      if (!roomIdentifier) throw new Error('roomIdentifier manquant');
      
      try {
        await markersApi.deleteMarker(roomIdentifier, markerId);

        if (isMountedRef.current) {
          // Optimistic update local
          setMarkers((prev) => {
            const updated = new Map(prev);
            updated.delete(markerId);
            return updated;
          });
        }

        console.log('✅ Marqueur supprimé, id:', markerId);
      } catch (err: any) {
        const errorMsg = err?.response?.data?.message || 'Erreur suppression marqueur';
        setError(errorMsg);
        throw err;
      }
    },
    [roomIdentifier]
  );

  /**
   * Nettoyer à la destruction du composant
   */
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Convertir la Map en tableau pour les composants
  const markersList = Array.from(markers.values()).sort((a, b) => a.timeSec - b.timeSec);

  return {
    markers: markersList,
    markersMap: markers,  // Pour accès rapide par id
    loading,
    error,
    lastSyncTime,
    
    // Opérations
    createMarker,
    updateMarker,
    deleteMarker,
    loadMarkers,  // Rechargement manuel
    
    // Getters utiles
    getMarkerById: (id: number) => markers.get(id),
    getMarkersByTime: (startSec: number, endSec: number) =>
      markersList.filter((m) => m.timeSec >= startSec && m.timeSec <= endSec),
  };
}
