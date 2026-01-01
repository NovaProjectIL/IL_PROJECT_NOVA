// app/lib/socket.ts
import { io, Socket } from 'socket.io-client';

// CORRECTION : Utiliser la variable d'env, sinon ça ne marchera jamais sur Vercel
const WS_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

class SocketService {
  private socket: Socket | null = null;

  connect() {
    if (typeof window === 'undefined') return null;
    
    if (!this.socket) {
      // On se connecte à l'URL dynamique (Ngrok ou Localhost selon l'env)
      this.socket = io(WS_URL, { // Note: j'ai retiré le /rooms ici, socket.io gère ça mieux via les namespaces si besoin, sinon laisse juste l'URL de base
        transports: ['websocket', 'polling'],
        withCredentials: true,
        // C'EST ICI LA CLÉ POUR NGROK 👇
        extraHeaders: {
          "ngrok-skip-browser-warning": "true"
        }
      });
    }
    return this.socket;
  }

  // Rejoindre une room
  joinRoom(codeRoom: string, memberId: number) {
    this.socket?.emit('join-room', { codeRoom, memberId });
  }

  // Émettre des événements (compatible avec backend)
  play(codeRoom: string, positionSec?: number) {
    this.socket?.emit('play', { codeRoom, positionSec });
  }

  pause(codeRoom: string, positionSec?: number) {
    this.socket?.emit('pause', { codeRoom, positionSec });
  }

  seek(codeRoom: string, positionSec: number) {
    this.socket?.emit('seek', { codeRoom, positionSec });
  }

  // ÉCOUTER les événements (correction ici)
  // Méthode générique pour écouter n'importe quel événement
  on(event: string, callback: (data: any) => void) {
    this.socket?.on(event, callback);
  }

  // Méthodes spécifiques pour plus de clarté
  onPlaybackState(callback: (data: any) => void) {
    this.socket?.on('playback-state', callback);
  }

  onPlay(callback: (data: any) => void) {
    this.socket?.on('play', callback);
  }

  onPause(callback: (data: any) => void) {
    this.socket?.on('pause', callback);
  }

  onSeek(callback: (data: any) => void) {
    this.socket?.on('seek', callback);
  }

  // Déconnecter
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

export const socketService = new SocketService();