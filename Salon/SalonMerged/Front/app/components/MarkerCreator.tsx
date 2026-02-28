/**
 * Composant pour créer un nouveau marqueur
 * 
 * Usage :
 * ```tsx
 * <MarkerCreator 
 *   roomCode={code}
 *   userId={userId}
 *   videoId={currentVideo.youtubeId}
 *   onMarkerCreated={() => console.log('Marqueur créé')}
 *   getCurrentTime={() => playerRef.current?.getCurrentTime() || 0}
 * />
 * ```
 */

'use client';

import { useState } from 'react';
import { useMarkers } from '@/app/hooks/useMarkers';
import { Marker, MarkerCategory, MARKER_COLORS, MARKER_LABELS } from '@/app/types/markers';
import { Plus, X } from 'lucide-react';

interface MarkerCreatorProps {
  roomCode: string;
  roomId?: number;
  userId: number;
  videoId: string;  // youtubeId actuelle
  getCurrentTime: () => number;  // Callback pour obtenir le temps actuel
  onMarkerCreated?: (marker: Marker) => void;  // Callback après création
}

const categories: MarkerCategory[] = ['ERROR', 'COMMENT', 'HIGHLIGHT', 'QUESTION'];

export default function MarkerCreator({
  roomCode,
  roomId,
  userId,
  videoId,
  getCurrentTime,
  onMarkerCreated,
}: MarkerCreatorProps) {
  
  // Hook pour gérer les marqueurs
  const { createMarker, error: hookError } = useMarkers({
    roomCode: roomId ? undefined : roomCode,
    roomId: roomId,
    enabled: false,  // Ne pas charger automatiquement, juste utiliser createMarker
  });

  // États locaux du formulaire
  const [isOpen, setIsOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [category, setCategory] = useState<MarkerCategory>('COMMENT');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Soumettre le formulaire et créer le marqueur
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!label.trim()) {
      setError('Le label est obligatoire');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const timeSec = getCurrentTime();

      // Créer le marqueur via le hook
      const newMarker = await createMarker({
        timeSec,
        label: label.trim(),
        content: content.trim() || undefined,
        category,
        videoId,
        createdById: userId,
      });

      console.log('✅ Marqueur créé:', newMarker);

      // Callback optionnel
      if (onMarkerCreated) {
        onMarkerCreated(newMarker);
      }

      // Réinitialiser le formulaire
      setLabel('');
      setContent('');
      setCategory('COMMENT');
      setIsOpen(false);
    } catch (err: any) {
      const errorMsg = err?.response?.data?.message || err?.message || 'Erreur création marqueur';
      setError(errorMsg);
      console.error('❌ Erreur création marqueur:', err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Bouton compact (à ajouter à la barre de contrôle vidéo)
   */
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '8px 14px',
          backgroundColor: '#ff6b6b',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          fontSize: '13px',
          fontWeight: 600,
          transition: 'background-color 0.2s ease',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#ff5252';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#ff6b6b';
        }}
        title="Ajouter un marqueur à ce moment"
      >
        <Plus size={16} />
        Marqueur
      </button>
    );
  }

  /**
   * Modal / Formulaire
   */
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={() => setIsOpen(false)}  // Fermer au clic sur le fond
    >
      <div
        style={{
          backgroundColor: '#1a1a1a',
          borderRadius: '12px',
          padding: '24px',
          maxWidth: '500px',
          width: '90%',
          boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
          border: '1px solid #333',
        }}
        onClick={(e) => e.stopPropagation()}  // Empêcher la fermeture au clic sur le modal
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '20px',
          }}
        >
          <h3
            style={{
              margin: 0,
              color: 'white',
              fontSize: '18px',
              fontWeight: 600,
            }}
          >
            Ajouter un marqueur
          </h3>
          <button
            onClick={() => setIsOpen(false)}
            style={{
              background: 'none',
              border: 'none',
              color: '#aaa',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Infos */}
        <div
          style={{
            marginBottom: '16px',
            padding: '12px',
            backgroundColor: '#2a2a2a',
            borderRadius: '6px',
            fontSize: '12px',
            color: '#aaa',
          }}
        >
          📌 Temps actuel: <strong style={{ color: '#fff' }}>{getCurrentTime().toFixed(1)}s</strong>
        </div>

        {/* Formulaire */}
        <form onSubmit={handleSubmit}>
          {/* Label */}
          <div style={{ marginBottom: '16px' }}>
            <label
              style={{
                display: 'block',
                color: '#aaa',
                fontSize: '12px',
                fontWeight: 600,
                marginBottom: '6px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              Titre du marqueur *
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Ex: Bug de synchronisation"
              maxLength={100}
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #333',
                borderRadius: '6px',
                backgroundColor: '#2a2a2a',
                color: '#fff',
                fontSize: '13px',
                boxSizing: 'border-box',
              }}
              autoFocus
              disabled={loading}
            />
            <div style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>
              {label.length}/100
            </div>
          </div>

          {/* Catégorie */}
          <div style={{ marginBottom: '16px' }}>
            <label
              style={{
                display: 'block',
                color: '#aaa',
                fontSize: '12px',
                fontWeight: 600,
                marginBottom: '6px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              Catégorie
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  style={{
                    padding: '10px',
                    border: `2px solid ${category === cat ? MARKER_COLORS[cat] : '#333'}`,
                    borderRadius: '6px',
                    backgroundColor: category === cat ? MARKER_COLORS[cat] + '20' : '#2a2a2a',
                    color: category === cat ? MARKER_COLORS[cat] : '#aaa',
                    cursor: 'pointer',
                    fontSize: '11px',
                    fontWeight: 600,
                    transition: 'all 0.2s ease',
                    backgroundClip: 'padding-box',
                  }}
                >
                  {MARKER_LABELS[cat]}
                </button>
              ))}
            </div>
          </div>

          {/* Description optionnelle */}
          <div style={{ marginBottom: '16px' }}>
            <label
              style={{
                display: 'block',
                color: '#aaa',
                fontSize: '12px',
                fontWeight: 600,
                marginBottom: '6px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              Description (optionnel)
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Détails supplémentaires..."
              maxLength={500}
              rows={3}
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #333',
                borderRadius: '6px',
                backgroundColor: '#2a2a2a',
                color: '#fff',
                fontSize: '13px',
                boxSizing: 'border-box',
                fontFamily: 'inherit',
                resize: 'vertical',
              }}
              disabled={loading}
            />
            <div style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>
              {content.length}/500
            </div>
          </div>

          {/* Erreur */}
          {(error || hookError) && (
            <div
              style={{
                marginBottom: '16px',
                padding: '10px',
                backgroundColor: '#ff4444' + '20',
                border: '1px solid #ff4444',
                borderRadius: '6px',
                color: '#ff8888',
                fontSize: '12px',
              }}
            >
              ⚠️ {error || hookError}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              style={{
                flex: 1,
                padding: '10px',
                border: '1px solid #333',
                borderRadius: '6px',
                backgroundColor: 'transparent',
                color: '#aaa',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 600,
                transition: 'all 0.2s ease',
              }}
              disabled={loading}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#333';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
              }}
            >
              Annuler
            </button>
            <button
              type="submit"
              style={{
                flex: 1,
                padding: '10px',
                border: 'none',
                borderRadius: '6px',
                backgroundColor: '#ff6b6b',
                color: 'white',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '13px',
                fontWeight: 600,
                opacity: loading ? 0.7 : 1,
                transition: 'all 0.2s ease',
              }}
              disabled={loading}
              onMouseEnter={(e) => {
                if (!loading) (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#ff5252';
              }}
              onMouseLeave={(e) => {
                if (!loading) (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#ff6b6b';
              }}
            >
              {loading ? '⏳ Création...' : '➕ Créer marqueur'}
            </button>
          </div>
        </form>

        {/* Conseils */}
        <div
          style={{
            marginTop: '16px',
            padding: '12px',
            backgroundColor: '#2a2a2a',
            borderRadius: '6px',
            fontSize: '11px',
            color: '#888',
            lineHeight: '1.6',
          }}
        >
          💡 <strong>Conseil :</strong> Ajouter le marqueur au moment de l'erreur ou du moment clé
          pour que les autres puissent naviguer rapidement.
        </div>
      </div>
    </div>
  );
}
