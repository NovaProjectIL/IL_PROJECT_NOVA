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

  // --- Connexion d’un client (Garantit qu'un utilisateur existe toujours) ---
  async handleConnection(client: Socket) {
    const users = await this.chatService.getAllUsers();
    let user;

    if (users.length > 0) {
      const userName = `Utilisateur${users.length + 1}`;
      user = await this.chatService.getOrCreateUser(userName);
    } else {
      user = await this.chatService.getOrCreateUser('Utilisateur1');
    }

    client.data.user = user;

    // Envoi de tout l’historique au nouveau client
    const messages = await this.chatService.getAllMessages();
    client.emit('loadMessages', messages);
    client.emit('identity', user.name);
    console.log(`Client connecté: ${client.id} -> ${user.name}`);
  }

  handleDisconnect(client: Socket) {
    const userName = client.data.user ? ` -> ${client.data.user.name}` : '';
    console.log(`Client déconnecté: ${client.id}${userName}`);
    
    // 💡 Signal d'arrêt de frappe si l'utilisateur quitte
    if (client.data.user) {
        this.server.emit('userTyping', { 
            username: client.data.user.name, 
            isTyping: false 
        });
    }
  }

  // --- NOUVEAU : Permet de définir/changer le Pseudo (Temporaire) ---
  @SubscribeMessage('setUser')
  async handleSetUser(client: Socket, payload: { username: string }) {
      if (!payload.username || typeof payload.username !== 'string') {
          client.emit('error', 'Pseudo invalide.');
          return;
      }
      
      const userName = payload.username.trim().substring(0, 50) || 'Anonymous';
      const user = await this.chatService.getOrCreateUser(userName);
      
      client.data.user = user;
      
      console.log(`Pseudo mis à jour pour ${client.id}: ${user.name}`);
      client.emit('userSet', { username: user.name });
      
      // La diffusion 'userJoined' est laissée en commentaire si vous décidez de l'utiliser plus tard
      // this.server.emit('userJoined', { username: user.name }); 
  }
  
  // --- NOUVEAU : Indicateur de frappe (Typing Indicator) ---
  @SubscribeMessage('typing')
  handleTyping(client: Socket, isTyping: boolean) {
    const user = client.data.user;
    if (!user) return;

    // Diffuse le statut de frappe à tous les AUTRES clients
    // (client.broadcast.emit garantit que l'émetteur ne reçoit pas son propre signal)
    client.broadcast.emit('userTyping', { 
      username: user.name, 
      isTyping: isTyping 
    });
  }

  // --- Envoi d’un message ---
  @SubscribeMessage('sendMessage')
  async handleMessage(
    client: Socket,
    payload: { message?: string; gifUrl?: string },
  ) {
    const user = client.data.user;
    if (!user) return;

    // 💡 AJOUT : Envoyer un signal d'arrêt de frappe à tout le monde
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