import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';

@WebSocketGateway({ cors: { origin: '*' } })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;

  constructor(private readonly chatService: ChatService) {}

  // --- Connexion d’un client ---
  async handleConnection(client: Socket) {
    const users = await this.chatService.getAllUsers();
    let user;

    if (users.length > 0) {
      // 👇 chaque client a maintenant un user unique pour éviter la confusion
      const userName = `Utilisateur${users.length + 1}`;
      user = await this.chatService.getOrCreateUser(userName);
    } else {
      user = await this.chatService.getOrCreateUser('Utilisateur1');
    }

    client.data.user = user;

    // Envoi de tout l’historique au nouveau client
    const messages = await this.chatService.getAllMessages();
    client.emit('loadMessages', messages);

    console.log(`Client connecté: ${client.id} -> ${user.name}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client déconnecté: ${client.id}`);
  }

  // --- Envoi d’un message ---
  @SubscribeMessage('sendMessage')
  async handleMessage(
    client: Socket,
    payload: { message?: string; gifUrl?: string },
  ) {
    const user = client.data.user;
    if (!user) return;

    // Sauvegarde en BDD
    const savedMessage = await this.chatService.saveMessage(
      user,
      payload.message,
      payload.gifUrl,
    );

    // Diffusion à tous les clients connectés
    this.server.emit('receiveMessage', {
      username: user.name,
      message: savedMessage.content,
      gifUrl: savedMessage.gifUrl,
      createdAt: savedMessage.createdAt,
    });
  }
}
