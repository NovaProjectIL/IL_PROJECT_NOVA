// app/lib/socket.ts
import { io, Socket } from 'socket.io-client';

const WS_URL = 'https://vulgarly-unforcible-loura.ngrok-free.dev';

class SocketService {
  private socket: Socket | null = null;

  // Connecter au WebSocket
  connect() {
    if (typeof window === 'undefined') return null;
    
    if (!this.socket) {
      this.socket = io(`${WS_URL}/sync`, {
        transports: ['websocket', 'polling'],
        // ✅ FIX : Ajouter le header pour ngrok
        extraHeaders: {
          'ngrok-skip-browser-warning': 'true',
        },
        // ✅ Options de reconnexion robustes
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5,
      });

      // ✅ FIX BONUS : Logger les événements de connexion
      this.socket.on('connect', () => {
        console.log('✅ Socket connecté:', this.socket?.id);
      });

      this.socket.on('disconnect', (reason) => {
        console.log('❌ Socket déconnecté:', reason);
      });

      this.socket.on('error', (error) => {
        console.error('❌ Socket error:', error);
      });

      this.socket.on('connect_error', (error) => {
        console.error('❌ Socket connection error:', error);
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