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
    const socketIdShort = client.id.substring(0, 4);
    const userName = `User_${socketIdShort}`;
    
    const user = await this.chatService.getOrCreateUser(userName);
    client.data.user = user;

    const messages = await this.chatService.getAllMessages();
    client.emit('loadMessages', messages);
    client.emit('identity', user.name);
    console.log(`Client connecté: ${client.id} -> ${user.name}`);
  }

  async handleDisconnect(client: Socket) {
    const userName = client.data.user ? ` -> ${client.data.user.name}` : '';
    console.log(`Client déconnecté: ${client.id}${userName}`);
    
    // Gestion de l'indicateur de frappe
    if (client.data.user) {
        this.server.emit('userTyping', { 
            username: client.data.user.name, 
            isTyping: false 
        });
    }

    // --- NOUVELLE LOGIQUE : Vérification du nombre d'utilisateurs restants ---
    // fetchSockets retourne les sockets actuellement connectées.
    // Lors de handleDisconnect, le socket actuel est généralement déjà considéré comme parti.
    const connectedSockets = await this.server.fetchSockets();
    
    if (connectedSockets.length === 0) {
      console.log('Dernier utilisateur parti. Suppression de tout l\'historique des messages...');
      await this.chatService.deleteAllMessages();
    }
  }
  
  // --- Indicateur de frappe ---
  @SubscribeMessage('typing')
  handleTyping(client: Socket, isTyping: boolean) {
    const user = client.data.user;
    if (!user) return;

    client.broadcast.emit('userTyping', { 
      username: user.name, 
      isTyping: isTyping 
    });
  }

  // --- Envoi de message ---
  @SubscribeMessage('sendMessage')
  async handleMessage(
    client: Socket,
    payload: { message?: string; gifUrl?: string },
  ) {
    const user = client.data.user;
    if (!user) return;

    client.broadcast.emit('userTyping', { 
      username: user.name, 
      isTyping: false 
    });

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