// ============================================
// app/rooms/page.tsx
// ============================================
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RoomsPage() {
  const router = useRouter();

  useEffect(() => {
    // Vérifier si l'utilisateur a un salon en cours
    const storedUser = localStorage.getItem('nova_user');
    
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        if (user.roomCode) {
          // Rediriger vers le salon en cours
          router.push(`/rooms/${user.roomCode}`);
          return;
        }
      } catch (e) {
        console.error('Erreur parsing user:', e);
      }
    }

    // Sinon, rediriger vers la homepage
    router.push('/');
  }, [router]);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <div style={{textAlign: 'center'}}>
        <div className="loading-spinner" style={{
          width: '64px',
          height: '64px',
          border: '3px solid transparent',
          borderTopColor: '#3b82f6',
          borderBottomColor: '#3b82f6',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          margin: '0 auto 16px'
        }}></div>
        <h2 style={{fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '8px'}}>
          Redirection en cours...
        </h2>
        <p style={{color: '#9ca3af', fontSize: '0.875rem'}}>
          Veuillez patienter
        </p>
      </div>
    </div>
  );
}