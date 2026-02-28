'use client';

import { useEffect, useState } from 'react';
import { useMarkers } from '@/app/hooks/useMarkers';
import { MARKER_COLORS, MARKER_LABELS } from '@/app/types/markers';
import type { Marker } from '@/app/types/markers';

interface TimelineProps {
  duration: number;        // Durée totale de la vidéo en secondes
  currentTime: number;     // Position actuelle de la vidéo en secondes
  onSeek: (time: number) => void;  // Fonction appelée quand on clique pour chercher
  roomCode: string;        // Code du salon pour récupérer les marqueurs
  roomId?: number;         // ID numérique (optionnel, sinon utilise roomCode)
}

export default function Timeline({ 
  duration, 
  currentTime, 
  onSeek, 
  roomCode,
  roomId
}: TimelineProps) {
  
  /**
   * Charger et synchroniser les marqueurs via le hook personnalisé
   * Le hook gère :
   * - Chargement initial depuis l'API
   * - Écoute des événements WebSocket (marker:created, marker:updated, marker:deleted)
   * - Mise en cache en mémoire
   * - Gestion du loading et des erreurs
   */
  const { markers, loading, error } = useMarkers({
    roomCode: roomId ? undefined : roomCode,
    roomId: roomId,
    enabled: !!roomCode || !!roomId,
    autoRefresh: 0  // Pas de rafraîchissement auto, seulement via websocket
  });

  /**
   * Formatage du temps pour l'affichage
   * Convertit les secondes en format MM:SS ou HH:MM:SS
   */
  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}:${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
    }
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  /**
   * Clustering des marqueurs proches
   * Regroupe les marqueurs qui sont trop proches visuellement sur la barre
   * pour éviter une surcharge visuelle
   */
  const getClusteredMarkers = () => {
    if (!markers || markers.length === 0) return [];

    // Seuil de regroupement en pixels
    const threshold = 5;
    const clusters: any[] = [];
    const used = new Set();
    
    // Trier les marqueurs par timeSec
    const sorted = [...markers].sort((a, b) => a.timeSec - b.timeSec);
    
    sorted.forEach((marker, index) => {
      // Ignorer les marqueurs déjà regroupés
      if (used.has(marker.id)) return;
      
      // Créer un nouveau cluster avec ce marqueur
      const cluster = {
        markers: [marker],
        position: marker.timeSec,
        ids: [marker.id]
      };
      
      // Chercher d'autres marqueurs proches à regrouper
      for (let j = index + 1; j < sorted.length; j++) {
        const other = sorted[j];
        if (used.has(other.id)) continue;
        
        // Calculer la distance visuelle entre les deux marqueurs
        const pos1 = (marker.timeSec / duration) * 100;
        const pos2 = (other.timeSec / duration) * 100;
        const percentDiff = Math.abs(pos1 - pos2);
        
        // Si les marqueurs sont plus proches que le seuil, les regrouper
        // Seuil : 2% de la largeur totale (adaptatif)
        if (percentDiff < 2) {
          cluster.markers.push(other);
          cluster.ids.push(other.id);
          used.add(other.id);
        }
      }
      
      clusters.push(cluster);
      used.add(marker.id);
    });
    
    return clusters;
  };

  const clusters = getClusteredMarkers();

  /**
   * RENDU VISUEL de la timeline
   */
  return (
    <div style={{ 
      width: '100%',
      padding: '20px 10px',
      position: 'relative'
    }}>
      
      {/* 
        Barre de progression cliquable
        C'est le conteneur principal de la timeline
      */}
      <div style={{
        width: '100%',
        height: '40px',
        backgroundColor: '#e0e0e0',
        borderRadius: '20px',
        position: 'relative',
        cursor: 'pointer',
        overflow: 'hidden'
      }}
      onClick={(e) => {
        // Navigation synchronisée
        // Calculer la position du clic en pourcentage
        const rect = e.currentTarget.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const percentage = clickX / rect.width;
        // Convertir le pourcentage en secondes
        const newTime = Math.max(0, Math.min(duration, percentage * duration));
        // Appeler la fonction onSeek qui émettra l'événement socket
        onSeek(newTime);
      }}>
        
        {/* 
          Barre de progression (partie colorée)
          Sa largeur représente la position actuelle de la vidéo
        */}
        <div style={{
          width: `${(currentTime / duration) * 100}%`,
          height: '100%',
          backgroundColor: '#ff0000',
          borderRadius: '20px',
          transition: 'width 0.1s linear'
        }} />
        
        {/* 
          Affichage des marqueurs avec clustering
          Chaque marqueur ou cluster de marqueurs est cliquable
          et navigue jusqu'à sa position
        */}
        {clusters.map(cluster => {
          
          // CAS 1: Marqueur simple (pas de regroupement)
          if (cluster.markers.length === 1) {
            const marker: Marker = cluster.markers[0];
            // Position en pourcentage
            const position = (marker.timeSec / duration) * 100;
            const color = MARKER_COLORS[marker.category];
            
            return (
              <div
                key={marker.id}
                style={{
                  position: 'absolute',
                  left: `${position}%`,
                  top: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: '20px',
                  height: '20px',
                  backgroundColor: color,
                  borderRadius: '50%',
                  border: '2px solid white',
                  cursor: 'pointer',
                  zIndex: 10,
                  boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                  transition: 'transform 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.transform = 'translate(-50%, -50%) scale(1.3)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.transform = 'translate(-50%, -50%) scale(1)';
                }}
                onClick={(e) => {
                  e.stopPropagation(); // Empêche le clic de se propager
                  onSeek(marker.timeSec); // Va à la position du marqueur
                }}
                title={`${MARKER_LABELS[marker.category]} • ${marker.label} • ${formatTime(marker.timeSec)}${marker.createdBy ? ` • par ${marker.createdBy.name}` : ''}`}
              />
            );
          } 
          
          // CAS 2: Cluster (plusieurs marqueurs regroupés)
          else {
            // Calculer la position moyenne du cluster
            const avgPosition = cluster.markers.reduce((sum: number, m: Marker) => sum + m.timeSec, 0) / cluster.markers.length;
            const position = (avgPosition / duration) * 100;
            
            return (
              <div
                key={cluster.ids.join('-')}
                style={{
                  position: 'absolute',
                  left: `${position}%`,
                  top: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: '28px',
                  height: '28px',
                  backgroundColor: '#666',
                  borderRadius: '50%',
                  border: '2px solid white',
                  cursor: 'pointer',
                  zIndex: 10,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontWeight: 'bold',
                  fontSize: '11px',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                  transition: 'transform 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.transform = 'translate(-50%, -50%) scale(1.3)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.transform = 'translate(-50%, -50%) scale(1)';
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  // Aller au premier marqueur du cluster
                  onSeek(cluster.markers[0].timeSec);
                }}
                title={`${cluster.markers.length} marqueurs • ${cluster.markers.map((m: Marker) => m.label).join(', ')}`}
              >
                {cluster.markers.length}
              </div>
            );
          }
        })}
      </div>
      
      {/* 
        Affichage du temps
        Montre la position actuelle et la durée totale
      */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        marginTop: '8px',
        fontSize: '12px',
        color: '#666'
      }}>
        <span>{formatTime(currentTime)}</span>
        {loading && <span style={{ fontSize: '11px', color: '#999' }}>Chargement marqueurs...</span>}
        {error && <span style={{ fontSize: '11px', color: '#f44' }}>Erreur marqueurs</span>}
        <span>{formatTime(duration)}</span>
      </div>
      
    </div>
  );
}