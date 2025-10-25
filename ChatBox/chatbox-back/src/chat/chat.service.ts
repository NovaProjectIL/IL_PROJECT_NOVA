import { Injectable } from '@nestjs/common';

@Injectable()
export class ChatService {
  // key = socketId, value = username
  private users: Record<string, string> = {};

  // Attribuer un nom à un socket
  assignUsername(socketId: string, name: string) {
    this.users[socketId] = name;
  }

  // Récupérer le nom d'un socket
  getUsername(socketId: string) {
    return this.users[socketId] || 'Invité';
  }
}
