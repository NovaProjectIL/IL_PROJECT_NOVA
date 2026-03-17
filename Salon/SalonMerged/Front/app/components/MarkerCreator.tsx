'use client';
import { useState } from 'react';

interface MarkerCreatorProps {
  onCreer: (timecode: number, label: string, categorie: string) => void;
  getCurrentTime: () => number;
  disabled?: boolean;
}

const CATEGORIES = [
  { value: 'ERROR', label: 'Erreur', color: '#ff4444' },
  { value: 'COMMENT', label: 'Commentaire', color: '#ffaa00' },
  { value: 'HIGHLIGHT', label: 'Point clé', color: '#00ff00' },
  { value: 'QUESTION', label: 'Question', color: '#4444ff' },
];

export default function MarkerCreator({ onCreer, getCurrentTime, disabled }: MarkerCreatorProps) {
  const [label, setLabel] = useState('');
  const [categorie, setCategorie] = useState('COMMENT');
  const [open, setOpen] = useState(false);

  const handleCreer = () => {
    const t = getCurrentTime();
    const l = label.trim() || `Marqueur à ${Math.floor(t)}s`;
    onCreer(t, l, categorie);
    setLabel('');
    setOpen(false);
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setOpen(!open)}
        disabled={disabled}
        style={{
          padding: '8px 16px',
          background: 'linear-gradient(135deg, #C52233, #74121D)',
          border: 'none',
          borderRadius: '10px',
          color: 'white',
          fontWeight: 700,
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : 1,
          fontSize: '14px',
          transition: 'all 0.2s',
        }}
      >
        + Marqueur
      </button>
      {open && (
        <div style={{
          position: 'absolute',
          bottom: '110%',
          left: 0,
          background: 'rgba(20, 5, 15, 0.98)',
          border: '1px solid rgba(197, 34, 51, 0.4)',
          borderRadius: '14px',
          padding: '16px',
          minWidth: '260px',
          zIndex: 100,
          boxShadow: '0 16px 40px rgba(0,0,0,0.6)',
        }}>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px', marginBottom: '8px' }}>
            Timecode : {formatTime(getCurrentTime())}
          </p>
          <input
            type="text"
            value={label}
            onChange={e => setLabel(e.target.value)}
            placeholder="Description (optionnel)"
            style={{
              width: '100%',
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: '8px',
              color: 'white',
              padding: '8px 12px',
              fontSize: '14px',
              marginBottom: '10px',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', flexWrap: 'wrap' }}>
            {CATEGORIES.map(c => (
              <button
                key={c.value}
                onClick={() => setCategorie(c.value)}
                style={{
                  padding: '4px 10px',
                  border: `2px solid ${categorie === c.value ? c.color : 'transparent'}`,
                  borderRadius: '6px',
                  background: categorie === c.value ? `${c.color}22` : 'rgba(255,255,255,0.06)',
                  color: categorie === c.value ? c.color : 'rgba(255,255,255,0.6)',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {c.label}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setOpen(false)}
              style={{
                flex: 1,
                padding: '8px',
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: '8px',
                color: 'rgba(255,255,255,0.7)',
                cursor: 'pointer',
                fontSize: '13px',
              }}
            >
              Annuler
            </button>
            <button
              onClick={handleCreer}
              style={{
                flex: 2,
                padding: '8px',
                background: 'linear-gradient(135deg, #C52233, #74121D)',
                border: 'none',
                borderRadius: '8px',
                color: 'white',
                fontWeight: 700,
                cursor: 'pointer',
                fontSize: '13px',
                boxShadow: '0 4px 12px rgba(197,34,51,0.4)',
              }}
            >
              Créer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
