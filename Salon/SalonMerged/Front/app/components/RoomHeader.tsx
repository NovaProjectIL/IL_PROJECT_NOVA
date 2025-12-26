'use client';
import { useState } from 'react';


interface RoomHeaderProps {
  code: string;
  memberId: number;
  membersCount: number;
  socketConnected: boolean;
}

export default function RoomHeader({
  code,
  memberId,
  membersCount,
  socketConnected,
}: RoomHeaderProps) {
  const [copied, setCopied] = useState(false);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Erreur copie:', err);
    }
  };

  return (
    <header className="room-header">
      <div className="header-left">
        <div className="logo">
          <span className="logo-icon">🎬</span>
          <span className="logo-text">NOVA Stream</span>
        </div>
        <div className="room-info">
          <h1>Salon: <span className="room-code">{code}</span></h1>
          <div className="room-meta">
            <span className="member-count">👥 {membersCount} membres</span>
            <span className="member-id">Votre ID: {memberId}</span>
          </div>
        </div>
      </div>
      
      <div className="header-right">
        <div className={`connection-status ${socketConnected ? 'connected' : 'disconnected'}`}>
          <span className="status-dot"></span>
          {socketConnected ? 'Connecté' : 'Déconnecté'}
        </div>
        
        <button 
          onClick={copyCode} 
          className="copy-button"
          title="Copier le code d'invitation"
        >
          <span className="copy-icon">{copied ? '✓' : '📋'}</span>
          <span className="copy-text">
            {copied ? 'Copié!' : 'Copier le code'}
          </span>
        </button>
        
        <button className="invite-button">
          <span className="invite-icon">👥</span>
          <span className="invite-text">Inviter</span>
        </button>
      </div>
    </header>
  );
}