'use client';

import React, { useState } from 'react';
import { Flag, X } from 'lucide-react';
import { markersApi } from '@/app/lib/api';

interface CreateMarkerModalProps {
  roomCode: string;
  currentTime: number;
  videoId: string;
  userId: number;
  onClose: () => void;
  onMarkerCreated?: (marker: any) => void;
}

export default function CreateMarkerModal({
  roomCode,
  currentTime,
  videoId,
  userId,
  onClose,
  onMarkerCreated,
}: CreateMarkerModalProps) {
  const [label, setLabel] = useState('');
  const [category, setCategory] = useState<'ERROR' | 'COMMENT' | 'HIGHLIGHT' | 'QUESTION'>('COMMENT');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) {
      setError('Le libellé est requis');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await markersApi.createMarker(roomCode, {
        timeSec: Math.floor(currentTime),
        label: label.trim(),
        content: content.trim(),
        category,
        videoId,
        createdById: userId,
      });

      console.log('✅ Marqueur créé:', response.data);
      onMarkerCreated?.(response.data);
      onClose();
    } catch (err: any) {
      console.error('❌ Erreur création marqueur:', err);
      setError(err.response?.data?.message || err.message || 'Erreur création marqueur');
    } finally {
      setLoading(false);
    }
  };

  const CATEGORY_COLORS: Record<string, { bg: string; text: string; icon: string }> = {
    ERROR: { bg: '#ffe0e0', text: '#c41e3a', icon: '❌' },
    COMMENT: { bg: '#fff4e0', text: '#d97706', icon: '💬' },
    HIGHLIGHT: { bg: '#e0f0ff', text: '#0369a1', icon: '⭐' },
    QUESTION: { bg: '#f0e0ff', text: '#7c3aed', icon: '❓' },
  };

  const colors = CATEGORY_COLORS[category];

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#fff',
          borderRadius: '12px',
          padding: '24px',
          maxWidth: '500px',
          width: '90%',
          boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
        }}
        onClick={(e) => e.stopPropagation()}
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
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>
            <Flag size={20} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'middle' }} />
            Nouveau Marqueur
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#999',
              fontSize: '24px',
            }}
          >
            <X size={24} />
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div
            style={{
              backgroundColor: '#fee2e2',
              color: '#c41e3a',
              padding: '12px',
              borderRadius: '6px',
              marginBottom: '16px',
              fontSize: '13px',
            }}
          >
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Time Display */}
          <div
            style={{
              padding: '12px',
              backgroundColor: '#f3f4f6',
              borderRadius: '6px',
              fontSize: '13px',
              textAlign: 'center',
            }}
          >
            <strong>Timecode actuel:</strong> {Math.floor(currentTime)}s
          </div>

          {/* Label Input */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
              Libellé *
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Ex: Bug à corriger, Idée intéressante..."
              maxLength={100}
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #ddd',
                borderRadius: '6px',
                fontSize: '13px',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Category Selector */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>
              Catégorie
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {Object.entries(CATEGORY_COLORS).map(([cat, style]) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat as any)}
                  style={{
                    padding: '12px',
                    backgroundColor: category === cat ? style.bg : '#f9fafb',
                    border: category === cat ? `2px solid ${style.text}` : '1px solid #e5e7eb',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: category === cat ? style.text : '#666',
                    transition: 'all 0.2s',
                  }}
                >
                  {style.icon} {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Content Textarea */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
              Détails (optionnel)
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Dé scrire plus de détails sur ce marqueur..."
              maxLength={500}
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #ddd',
                borderRadius: '6px',
                fontSize: '13px',
                fontFamily: 'inherit',
                resize: 'vertical',
                minHeight: '80px',
                boxSizing: 'border-box',
              }}
            />
            <div style={{ fontSize: '11px', color: '#999', marginTop: '4px' }}>
              {content.length}/500
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '10px 16px',
                backgroundColor: '#f3f4f6',
                color: '#374151',
                border: '1px solid #ddd',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading || !label.trim()}
              style={{
                padding: '10px 16px',
                backgroundColor: loading ? '#999' : '#1976d2',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              {loading ? '⏳ Création...' : '✅ Créer Marqueur'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
