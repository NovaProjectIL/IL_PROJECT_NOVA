import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';

// 🚨 IMPORTANT : Pas de namespace ici pour partager la connexion avec la vidéo
@WebSocketGateway({ 
  cors: { origin: '*' } 
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;

  constructor(private readonly chatService: ChatService) {}

  handleConnection(client: Socket) {
    // La connexion est gérée principalement par RoomsGateway
  }

  handleDisconnect(client: Socket) {
  }

  // --- GESTION DU "TRAIN D'ÉCRIRE..." ---
  @SubscribeMessage('typing')
  handleTyping(
    @ConnectedSocket() client: Socket, 
    @MessageBody() payload: { isTyping: boolean, roomCode?: string, codeRoom?: string, username?: string } 
  ) {
    const targetRoom = payload.roomCode || payload.codeRoom;
    if (!targetRoom) return;

    // Diffuser aux autres sauf à l'expéditeur
    client.to(targetRoom).emit('userTyping', { 
      username: payload.username || 'Quelqu\'un', 
      isTyping: payload.isTyping 
    });
  }

  // --- ENVOI ET RÉCEPTION DU MESSAGE ---
  @SubscribeMessage('sendMessage')
  async handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { 
      message?: string; 
      gifUrl?: string; 
      roomCode: string; 
      username: string; 
    },
  ) {
    // 1. Validation basique
    if (!payload.roomCode || !payload.username) {
      console.log('⚠️ Chat: Données manquantes', payload);
      return;
    }

    // 2. Récupérer l'utilisateur (ou le créer s'il n'existe pas encore en base)
    const user = await this.chatService.getOrCreateUser(payload.username);

    // 3. Arrêter l'animation "écrit..."
    client.to(payload.roomCode).emit('userTyping', { 
      username: user.name, 
      isTyping: false 
    });

    // 4. Sauvegarder dans la BDD
    // Note: Le service attend "codeRoom", on lui passe payload.roomCode
    const savedMessage = await this.chatService.saveMessage(
      user,
      payload.message,
      payload.gifUrl,
      payload.roomCode 
    );

    // 5. 🚀 DIFFUSION (C'est ici que la réception se joue)
    // On utilise "this.server.to" pour envoyer à TOUT LE MONDE dans la room (y compris toi)
    this.server.to(payload.roomCode).emit('receiveMessage', {
      username: user.name, 
      message: savedMessage.content,
      gifUrl: savedMessage.gifUrl,
      createdAt: savedMessage.createdAt,
    });
  }
}