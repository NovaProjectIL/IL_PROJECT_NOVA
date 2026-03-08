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

  async handleConnection(client: Socket) {
    // Attendre que le client envoie son nom réel
    client.once('setUsername', async (payload: { username: string, userId?: number }) => {
      let user;
      
      // Si userId est fourni, chercher l'utilisateur existant
      if (payload.userId) {
        user = await this.chatService.findUserById(payload.userId);
      }
      
      // Si pas trouvé, créer avec le username fourni
      if (!user) {
        user = await this.chatService.getOrCreateUser(payload.username);
      }
      
      // Attacher l'utilisateur à la socket
      client.data.user = user;
      
      // Envoyer l'historique
      const messages = await this.chatService.getAllMessages();
      client.emit('loadMessages', messages);
      
      // Confirmer l'identité
      client.emit('identity', {
        username: user.name,
        userId: user.id
      });
    });
  }

  handleDisconnect(client: Socket) {
    // Arrêter l'indicateur de frappe si l'utilisateur part
    if (client.data.user) {
      this.server.emit('userTyping', { 
        username: client.data.user.name, 
        isTyping: false 
      });
    }
  }
  
  @SubscribeMessage('typing')
  handleTyping(client: Socket, isTyping: boolean) {
    const user = client.data.user;
    if (!user) return;

    client.broadcast.emit('userTyping', { 
      username: user.name, 
      isTyping: isTyping 
    });
  }

  @SubscribeMessage('sendMessage')
  async handleMessage(
    client: Socket,
    payload: { message?: string; gifUrl?: string },
  ) {
    const user = client.data.user;
    if (!user) return;

    // Arrêter l'indicateur de frappe
    client.broadcast.emit('userTyping', { 
      username: user.name, 
      isTyping: false 
    });

    // Sauvegarder le message
    const savedMessage = await this.chatService.saveMessage(
      user,
      payload.message,
      payload.gifUrl,
    );

    // Envoyer à tous les clients
    this.server.emit('receiveMessage', {
      username: user.name, 
      message: savedMessage.content,
      gifUrl: savedMessage.gifUrl,
      createdAt: savedMessage.createdAt,
    });
  }
}