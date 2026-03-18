import { useState, useEffect, useCallback } from 'react';
import { marqueursApi } from '@/app/lib/api';
import { Marqueur } from '@/app/types/types';

const normaliser = (raw: any): Marqueur => ({
  id: String(raw.id),
  version: typeof raw.version === 'number' ? raw.version : undefined,
  videoId: raw.video?.youtubeId ?? raw.videoId ?? raw.video?.id ?? undefined,
  timecode: Number(raw.timeSec ?? raw.timecode ?? 0),
  label: raw.label ?? 'Marqueur',
  categorie: raw.category ?? raw.categorie ?? 'COMMENT',
  roomId: String(raw.room?.id ?? ''),
  auteurId: String(raw.createdBy?.id ?? ''),
  auteurNom: raw.createdBy?.name ?? 'Utilisateur',
});

export function useMarkers(roomInternalId: number | null, socket: any, roomCode: string, currentVideoId?: string | null) {
  const [marqueurs, setMarqueurs] = useState<Marqueur[]>([]);
  const [loading, setLoading] = useState(false);
  const videoId = currentVideoId ?? null;

  const charger = useCallback(async () => {
    if (!roomInternalId) return;
    setLoading(true);
    try {
      const res = await marqueursApi.getMarqueurs(roomInternalId);
      const liste = Array.isArray(res.data) ? res.data.map(normaliser) : [];
      const filtres = videoId ? liste.filter(m => m.videoId === videoId) : liste;
      setMarqueurs(filtres);
    } catch (e) {
      console.error('[useMarkers] Erreur chargement', e);
    } finally {
      setLoading(false);
    }
  }, [roomInternalId, videoId]);

  useEffect(() => {
    charger();
  }, [charger]);

  useEffect(() => {
    setMarqueurs([]);
  }, [videoId]);

  useEffect(() => {
    if (!socket) return;
    const handler = (raw: any) => {
      const m = normaliser(raw);
      if (videoId && m.videoId !== videoId) return;
      setMarqueurs(prev => prev.find(x => x.id === m.id) ? prev : [...prev, m]);
    };
    socket.on('nouveau_marqueur', handler);
    return () => socket.off('nouveau_marqueur', handler);
  }, [socket, videoId]);

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

  const modifier = useCallback(async (
    roomId: number,
    markerId: number,
    data: { version: number; timeSec?: number; label?: string; category?: Marqueur['categorie'] }
  ) => {
    try {
      const res = await marqueursApi.modifierMarqueur(roomId, markerId, data);
      const updated = normaliser(res.data);
      setMarqueurs(prev => prev.map(m => m.id === updated.id ? updated : m));
      return updated;
    } catch (e) {
      console.error('[useMarkers] Erreur modification', e);
      throw e;
    }
  }, []);

  const supprimer = useCallback(async (roomId: number, markerId: number) => {
    try {
      await marqueursApi.supprimerMarqueur(roomId, markerId);
      setMarqueurs(prev => prev.filter(m => m.id !== String(markerId)));
    } catch (e) {
      console.error('[useMarkers] Erreur suppression', e);
      throw e;
    }
  }, []);

  return { marqueurs, setMarqueurs, loading, charger, creer, modifier, supprimer };
}
