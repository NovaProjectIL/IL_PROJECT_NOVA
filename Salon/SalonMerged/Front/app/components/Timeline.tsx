'use client';

import { useEffect, useState } from 'react';
import { socketService } from '@/app/lib/socket';
import api from '@/app/lib/api';

// Couleurs des marqueurs selon la catégorie (définie par Wafa)
const categoryColors = {
  ERROR: '#ff4444',      // Rouge pour les erreurs
  COMMENT: '#ffaa00',    // Orange pour les commentaires
  HIGHLIGHT: '#00ff00',  // Vert pour les moments clés
  QUESTION: '#4444ff'    // Bleu pour les questions
};

interface TimelineProps {
  duration: number;        // Durée totale de la vidéo en secondes
  currentTime: number;      // Position actuelle de la vidéo en secondes
  onSeek: (time: number) => void;  // Fonction appelée quand on clique pour chercher
  roomCode: string;         // Code du salon pour récupérer les marqueurs
}

export default function Timeline({ 
  duration, 
  currentTime, 
  onSeek, 
  roomCode 
}: TimelineProps) {
  
  // State pour stocker tous les marqueurs de la room
  const [markers, setMarkers] = useState<any[]>([]);
  
  /**
   * TÂCHE 1: Chargement initial des marqueurs depuis l'API
   * Au chargement du composant, on récupère tous les marqueurs existants
   */
  useEffect(() => {
    async function loadMarkers() {
      try {
        // Appel API pour récupérer les marqueurs de cette room
        const response = await api.get('/markers', { 
          params: { roomCode } 
        });
        setMarkers(response.data);
        console.log('Marqueurs chargés:', response.data);
      } catch (error) {
        console.error('Erreur chargement marqueurs:', error);
      }
    }
    
    if (roomCode) {
      loadMarkers();
    }
  }, [roomCode]);
  
  /**
   * TÂCHE 1 (suite): Synchronisation temps réel des marqueurs
   * On écoute les événements socket pour mettre à jour l'affichage
   * Quand Wafa ajoute/modifie/supprime un marqueur, on le reçoit ici
   */
  useEffect(() => {
    // Quand un nouveau marqueur est créé par quelqu'un
    socketService.on('marker-added', (newMarker) => {
      setMarkers(prev => [...prev, newMarker]);
    });
    
    // Quand un marqueur existant est modifié
    socketService.on('marker-updated', (updatedMarker) => {
      setMarkers(prev => prev.map(m => 
        m.id === updatedMarker.id ? updatedMarker : m
      ));
    });
    
    // Quand un marqueur est supprimé
    socketService.on('marker-deleted', (deletedMarkerId) => {
      setMarkers(prev => prev.filter(m => m.id !== deletedMarkerId));
    });
    
  }, []);
  
  /**
   * TÂCHE 2: Formatage du temps pour l'affichage
   * Convertit les secondes en format MM:SS ou HH:MM:SS
   */
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };
  
  /**
   * TÂCHE 3: Clustering des marqueurs proches
   * Regroupe les marqueurs qui sont trop proches visuellement
   * pour éviter que la timeline soit surchargée
   */
  const getClusteredMarkers = () => {
    // Seuil de regroupement en pixels
    const threshold = 5;
    const clusters: any[] = [];
    const used = new Set();
    
    // Trier les marqueurs par timeSec pour faciliter le regroupement
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
      
      // Chercher d'autres marqueurs proches
      for (let j = index + 1; j < sorted.length; j++) {
        const other = sorted[j];
        if (used.has(other.id)) continue;
        
        // Calculer la distance en pixels entre les deux marqueurs
        const pos1 = (marker.timeSec / duration) * 100;
        const pos2 = (other.timeSec / duration) * 100;
        // Convertir le pourcentage en pixels (basé sur la largeur de la fenêtre)
        const distance = Math.abs(pos1 - pos2) * (window.innerWidth / 100);
        
        // Si les marqueurs sont plus proches que le seuil, on les regroupe
        if (distance < threshold) {
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
        TÂCHE 1 & 4: Barre de progression cliquable
        C'est le conteneur principal de la timeline
      */}
      <div style={{
        width: '100%',
        height: '40px',
        backgroundColor: '#e0e0e0',
        borderRadius: '20px',
        position: 'relative',
        cursor: 'pointer'
      }}
      onClick={(e) => {
        // TÂCHE 4: Navigation synchronisée
        // Calculer la position du clic en pourcentage
        const rect = e.currentTarget.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const percentage = clickX / rect.width;
        // Convertir le pourcentage en secondes
        const newTime = percentage * duration;
        // Appeler la fonction onSeek qui émettra l'événement socket
        onSeek(newTime);
      }}>
        
        {/* 
          TÂCHE 2: Barre de progression (partie colorée)
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
          TÂCHE 1 & 3: Affichage des marqueurs avec clustering
          On utilise getClusteredMarkers pour regrouper les marqueurs proches
        */}
        {getClusteredMarkers().map(cluster => {
          
          // CAS 1: Marqueur simple (pas de regroupement)
          if (cluster.markers.length === 1) {
            const marker = cluster.markers[0];
            // TÂCHE 2: Calcul de la position en pourcentage
            const position = (marker.timeSec / duration) * 100;
            
            return (
              <div
                key={marker.id}
                style={{
                  position: 'absolute',
                  left: `${position}%`,
                  top: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: '24px',
                  height: '24px',
                  // Utilise la catégorie pour déterminer la couleur
                  backgroundColor: categoryColors[marker.category] || '#ffaa00',
                  borderRadius: '50%',
                  border: '2px solid white',
                  cursor: 'pointer',
                  zIndex: 10
                }}
                onClick={(e) => {
                  // TÂCHE 4: Navigation synchronisée
                  e.stopPropagation(); // Empêche le clic de se propager à la barre
                  onSeek(marker.timeSec); // Va à la position du marqueur
                }}
                // Infobulle complète avec label, catégorie, temps et créateur
                title={`${marker.label} (${marker.category}) - ${formatTime(marker.timeSec)} par ${marker.createdBy?.name || 'Anonyme'}`}
              />
            );
          } 
          
          // CAS 2: Cluster (plusieurs marqueurs regroupés)
          else {
            // Calculer la position moyenne du cluster
            const avgPosition = cluster.markers.reduce((sum, m) => sum + m.timeSec, 0) / cluster.markers.length;
            const position = (avgPosition / duration) * 100;
            
            return (
              <div
                key={cluster.ids.join('-')}
                style={{
                  position: 'absolute',
                  left: `${position}%`,
                  top: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: '32px',
                  height: '32px',
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
                  fontSize: '12px'
                }}
                onClick={(e) => {
                  // TÂCHE 4: Navigation synchronisée
                  e.stopPropagation();
                  // Aller au premier marqueur du cluster
                  onSeek(cluster.markers[0].timeSec);
                }}
                title={`${cluster.markers.length} marqueurs: ${cluster.markers.map(m => m.label).join(', ')}`}
              >
                {cluster.markers.length}
              </div>
            );
          }
        })}
      </div>
      
      {/* 
        TÂCHE 2: Affichage du temps
        Montre la position actuelle et la durée totale
      */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        marginTop: '8px',
        fontSize: '14px'
      }}>
        <span>{formatTime(currentTime)}</span>
        <span>{formatTime(duration)}</span>
      </div>
      
    </div>
  );
}