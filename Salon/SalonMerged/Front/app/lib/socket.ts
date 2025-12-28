// app/lib/socket.ts
import { io, Socket } from 'socket.io-client';

<<<<<<< HEAD
const WS_URL = 'http://localhost:3001';
=======
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3000';
>>>>>>> 242179d658c20603fe9c8b0d6eaefcafb1827a93

class SocketService {
  private socket: Socket | null = null;

  // Connecter au WebSocket
  connect() {
    if (typeof window === 'undefined') return null;

    if (!this.socket) {
      this.socket = io(`${WS_URL}/rooms`, {
        transports: ['websocket', 'polling'],
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