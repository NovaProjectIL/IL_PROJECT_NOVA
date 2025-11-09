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

  // --- Connexion d’un client (Reste la version initiale) ---
  async handleConnection(client: Socket) {
    const users = await this.chatService.getAllUsers();
    let user;

    if (users.length > 0) {
      // 🟢 CONSERVÉ : Attribution d'un user unique pour que le chat marche tout de suite
      const userName = `Utilisateur${users.length + 1}`;
      user = await this.chatService.getOrCreateUser(userName);
    } else {
      user = await this.chatService.getOrCreateUser('Utilisateur1');
    }

    client.data.user = user; // ⬅️ Ceci garantit que 'sendMessage' ne plante pas

    // Envoi de tout l’historique au nouveau client
    const messages = await this.chatService.getAllMessages();
    client.emit('loadMessages', messages);
    client.emit('identity', user.name);
    console.log(`Client connecté: ${client.id} -> ${user.name}`);
  }

  handleDisconnect(client: Socket) {
    // Utilise le pseudo attribué ou choisi pour le log
    const userName = client.data.user ? ` -> ${client.data.user.name}` : '';
    console.log(`Client déconnecté: ${client.id}${userName}`);
  }

  // ------------------------------------------------------------------
  // --- NOUVEAU : Permet de définir/changer le Pseudo (Temporaire) ---
  // ------------------------------------------------------------------
  @SubscribeMessage('setUser')
  async handleSetUser(client: Socket, payload: { username: string }) {
      if (!payload.username || typeof payload.username !== 'string') {
          client.emit('error', 'Pseudo invalide.');
          return;
      }
      
      // 1. Cherche ou crée l'utilisateur en BDD avec le nouveau nom
      const userName = payload.username.trim().substring(0, 50) || 'Anonymous';
      const user = await this.chatService.getOrCreateUser(userName);
      
      // 2. ÉCRASE l'utilisateur temporaire existant avec le nouveau (ESSENTIEL)
      client.data.user = user;
      
      // 3. Confirmation et log
      console.log(`Pseudo mis à jour pour ${client.id}: ${user.name}`);
      client.emit('userSet', { username: user.name });
      
      // 4. Informe les autres (optionnel)
      this.server.emit('userJoined', { username: user.name });
  }

  // --- Envoi d’un message (Reste la version initiale) ---
  @SubscribeMessage('sendMessage')
  async handleMessage(
    client: Socket,
    payload: { message?: string; gifUrl?: string },
  ) {
    const user = client.data.user;
    if (!user) return; // 🟢 CONSERVÉ : Ne retourne rien, mais ne plantera pas grâce à handleConnection

    // Sauvegarde en BDD
    const savedMessage = await this.chatService.saveMessage(
      user,
      payload.message,
      payload.gifUrl,
    );

    // Diffusion à tous les clients connectés
    this.server.emit('receiveMessage', {
      username: user.name, // ⬅️ RÉCUPÈRE LE NOM DU user DANS client.data.user (qui a été mis à jour par handleSetUser)
      message: savedMessage.content,
      gifUrl: savedMessage.gifUrl,
      createdAt: savedMessage.createdAt,
    });
  }
}