'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { socketService } from '@/app/lib/socket';
import { markersApi } from '@/app/lib/api';

interface Marker {
  id: number;
  timeSec: number;
  label: string;
  category: 'ERROR' | 'COMMENT' | 'HIGHLIGHT' | 'QUESTION';
  version: number;
  createdBy?: { id: number; name: string };
}

interface MarkerTimelineProps {
  roomCode: string;
  duration: number;
  currentTime: number;
  onSeek: (time: number) => void;
}

const MARKER_COLORS: Record<string, string> = {
  ERROR: '#ff3333',
  COMMENT: '#ff9500',
  HIGHLIGHT: '#33cc33',
  QUESTION: '#3366ff',
};

export default function MarkersTimeline({
  roomCode,
  duration,
  currentTime,
  onSeek,
}: MarkerTimelineProps) {
  const [markers, setMarkers] = useState<Map<number, Marker>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ✅ Charger les marqueurs au démarrage
  const loadMarkers = useCallback(async () => {
    try {
      setLoading(true);
      const response = await markersApi.getMarkers(roomCode);
      const data = response.data as Marker[];
      
      const markersMap = new Map(data.map((m) => [m.id, m]));
      setMarkers(markersMap);
      console.log(`✅ ${data.length} marqueurs chargés pour room ${roomCode}`);
    } catch (err: any) {
      console.error('❌ Erreur chargement marqueurs:', err.message);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [roomCode]);

  // ✅ Charger au montage
  useEffect(() => {
    loadMarkers();
  }, [loadMarkers]);

  // ✅ Écouter marker:created
  useEffect(() => {
    socketService.onMarkerCreated((marker: Marker) => {
      setMarkers((prev) => {
        const updated = new Map(prev);
        updated.set(marker.id, marker);
        return updated;
      });
      console.log('➕ Marqueur créé:', marker.label);
    });

    socketService.onMarkerUpdated((marker: Marker) => {
      setMarkers((prev) => {
        const updated = new Map(prev);
        updated.set(marker.id, marker);
        return updated;
      });
      console.log('✏️ Marqueur mis à jour:', marker.label);
    });

    socketService.onMarkerDeleted((markerId: number) => {
      setMarkers((prev) => {
        const updated = new Map(prev);
        updated.delete(markerId);
        return updated;
      });
      console.log('❌ Marqueur supprimé:', markerId);
    });
  }, []);

  const markersList = Array.from(markers.values()).sort((a, b) => a.timeSec - b.timeSec);

  if (!duration) return null;

  return (
    <div style={{ width: '100%', padding: '16px 0' }}>
      {/* Timeline Container */}
      <div
        style={{
          width: '100%',
          height: '40px',
          backgroundColor: '#e0e0e0',
          borderRadius: '8px',
          position: 'relative',
          cursor: 'pointer',
          overflow: 'hidden',
        }}
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const percent = (e.clientX - rect.left) / rect.width;
          const newTime = Math.max(0, Math.min(duration, percent * duration));
          onSeek(newTime);
        }}
      >
        {/* Progress Bar */}
        <div
          style={{
            width: `${(currentTime / duration) * 100}%`,
            height: '100%',
            backgroundColor: '#ff0000',
            borderRadius: '8px',
            transition: 'width 0.1s linear',
          }}
        />

        {/* Marqueurs */}
        {markersList.map((marker) => {
          const percent = (marker.timeSec / duration) * 100;
          return (
            <div
              key={marker.id}
              style={{
                position: 'absolute',
                left: `${percent}%`,
                top: '50%',
                transform: 'translate(-50%, -50%)',
                width: '16px',
                height: '16px',
                backgroundColor: MARKER_COLORS[marker.category],
                borderRadius: '50%',
                border: '2px solid white',
                cursor: 'pointer',
                zIndex: 10,
                boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
              }}
              onClick={(e) => {
                e.stopPropagation();
                onSeek(marker.timeSec);
              }}
              title={`${marker.label} @ ${Math.floor(marker.timeSec)}s`}
            />
          );
        })}
      </div>

      {/* Time Display */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#666', marginTop: '8px' }}>
        <span>{Math.floor(currentTime)}s</span>
        {loading && <span style={{color: '#999'}}>Chargement marqueurs...</span>}
        {error && <span style={{color: '#f44'}}>Erreur marqueurs</span>}
        <span>{Math.floor(duration)}s</span>
      </div>
    </div>
  );
}
