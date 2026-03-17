import { useState, useEffect, useCallback } from 'react';
import { marqueursApi } from '@/app/lib/api';
import { Marqueur } from '@/app/types/types';

const normaliser = (raw: any): Marqueur => ({
  id: String(raw.id),
  timecode: Number(raw.timeSec ?? raw.timecode ?? 0),
  label: raw.label ?? 'Marqueur',
  categorie: raw.category ?? raw.categorie ?? 'COMMENT',
  roomId: String(raw.room?.id ?? ''),
  auteurId: String(raw.createdBy?.id ?? ''),
  auteurNom: raw.createdBy?.name ?? 'Utilisateur',
});

export function useMarkers(roomInternalId: number | null, socket: any, roomCode: string) {
  const [marqueurs, setMarqueurs] = useState<Marqueur[]>([]);
  const [loading, setLoading] = useState(false);

  const charger = useCallback(async () => {
    if (!roomInternalId) return;
    setLoading(true);
    try {
      const res = await marqueursApi.getMarqueurs(roomInternalId);
      const liste = Array.isArray(res.data) ? res.data.map(normaliser) : [];
      setMarqueurs(liste);
    } catch (e) {
      console.error('[useMarkers] Erreur chargement', e);
    } finally {
      setLoading(false);
    }
  }, [roomInternalId]);

  useEffect(() => {
    charger();
  }, [charger]);

  useEffect(() => {
    if (!socket) return;
    const handler = (raw: any) => {
      const m = normaliser(raw);
      setMarqueurs(prev => prev.find(x => x.id === m.id) ? prev : [...prev, m]);
    };
    socket.on('nouveau_marqueur', handler);
    return () => socket.off('nouveau_marqueur', handler);
  }, [socket]);

  const creer = useCallback(async (
    roomId: number,
    memberId: number,
    timecode: number,
    youtubeId: string,
    socketRef?: any,
    codeRoom?: string
  ) => {
    try {
      const res = await marqueursApi.creerMarqueur(roomId, {
        timeSec: timecode,
        label: `Marqueur à ${Math.floor(timecode)}s`,
        category: 'COMMENT',
        videoId: youtubeId,
        createdById: memberId,
      });
      const nouveau = normaliser(res.data);
      setMarqueurs(prev => [...prev, nouveau]);
      socketRef?.emit('marker-created', { codeRoom, marker: nouveau });
      return nouveau;
    } catch (e) {
      console.error('[useMarkers] Erreur création', e);
    }
  }, []);

  return { marqueurs, setMarqueurs, loading, charger, creer };
}
