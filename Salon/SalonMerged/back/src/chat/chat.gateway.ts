 import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';

@WebSocketGateway('/rooms', {
  cors: {
<<<<<<< HEAD
    origin: '*',
=======
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);

      // Allow localhost on any port
      if (origin.match(/^http:\/\/localhost:\d+$/)) {
        return callback(null, true);
      }

      // Allow 127.0.0.1 on any port
      if (origin.match(/^http:\/\/127\.0\.0\.1:\d+$/)) {
        return callback(null, true);
      }

      // Allow any IP address on port 3000 (for network access)
      if (origin.match(/^http:\/\/\d+\.\d+\.\d+\.\d+:3000$/)) {
        return callback(null, true);
      }

      // Allow specific origins if needed
      const allowedOrigins = ['http://localhost:3000', 'http://127.0.0.1:3000'];
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error('Not allowed by CORS'));
    },
>>>>>>> 242179d658c20603fe9c8b0d6eaefcafb1827a93
    credentials: true
  }
})
export class ChatGateway {
  @WebSocketServer() server: Server;

  constructor(private readonly chatService: ChatService) {}

  // --- IDENTIFICATION ---
  @SubscribeMessage('setUsername')
  async handleSetUsername(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { username: string, userId?: number }
  ) {
      let user;
      // 1. On cherche par ID
      if (payload.userId) {
        user = await this.chatService.findUserById(payload.userId);
      }
      // 2. Sinon on cherche/crée par nom
      if (!user) {
        user = await this.chatService.getOrCreateUser(payload.username);
      }

      // 3. Assurer que le nom n'est pas vide
      if (!user.name || user.name.trim() === '') {
        user.name = 'Utilisateur';
        await this.chatService.updateUserName(user.id, 'Utilisateur');
      }

      client.data.user = user;
      console.log(`💬 Chat: ${user.name} (ID: ${user.id}) identifié sur socket ${client.id}`);
  }

  // --- TYPING ---
  @SubscribeMessage('typing')
  handleTyping(
    @ConnectedSocket() client: Socket, 
    @MessageBody() payload: { isTyping: boolean, codeRoom: string } // <-- Même nommage que RoomsGateway
  ) {
    if (!payload.codeRoom) return;

    const user = client.data.user;
    if (!user) return;

    // On convertit en MAJUSCULE comme dans RoomsGateway
    client.to(payload.codeRoom.toUpperCase()).emit('userTyping', { 
      username: user.name, 
      isTyping: payload.isTyping 
    });
  }

  // --- ENVOI DE MESSAGE ---
  @SubscribeMessage('sendMessage')
  async handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { 
        message?: string; 
        gifUrl?: string; 
        codeRoom: string; // <-- Même nommage
        userId?: number; 
        username?: string;
    },
  ) {
    // 1. SÉCURITÉ
    if (!payload.codeRoom) {
        console.error("⛔ Chat: 'codeRoom' manquant !");
        return;
    }

    let user = client.data.user;

    // 2. AUTO-RÉPARATION (Si le socket a oublié l'user)
    if (!user && payload.userId) {
        user = await this.chatService.findUserById(payload.userId);
    }
    if (!user && payload.username) {
        user = await this.chatService.getOrCreateUser(payload.username);
    }

    if (!user) {
        console.error("⛔ Chat: Utilisateur introuvable pour ce message.");
        return;
    }

    // Remise en mémoire
    client.data.user = user;

    // IMPORTANT : On normalise le codeRoom en MAJUSCULE pour matcher le client.join() du RoomsGateway
    const roomCode = payload.codeRoom.toUpperCase();

    // Arrêt du typing
    client.to(roomCode).emit('userTyping', { 
      username: user.name, 
      isTyping: false 
    });

    try {
        // 3. SAUVEGARDE EN BDD VIA VOS ENTITÉS
        const savedMessage = await this.chatService.saveMessage(
          user,
          payload.message,
          payload.gifUrl,
          roomCode
        );

        console.log(`✅ Chat: Message envoyé dans ${roomCode}`);

        // 4. DIFFUSION
        this.server.to(roomCode).emit('receiveMessage', {
          username: user.name,
          userId: user.id,
          message: savedMessage.content,
          gifUrl: savedMessage.gifUrl,
          createdAt: savedMessage.createdAt,
        });
    } catch (error) {
        console.error("❌ Chat Erreur BDD:", error.message);
    }
  }

  // --- REJOINDRE LA ROOM CHAT ---
  @SubscribeMessage('joinChatRoom')
  handleJoinChatRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { codeRoom: string }
  ) {
    if (!payload.codeRoom) return;

    const roomCode = payload.codeRoom.toUpperCase();
    client.join(roomCode);
    console.log(`💬 Chat: Client ${client.id} rejoint la room chat: ${roomCode}`);
  }

  // --- HISTORIQUE ---
  @SubscribeMessage('requestMessages')
  async handleRequestMessages(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { codeRoom: string }
  ) {
    if (!payload.codeRoom) return;

    const roomCode = payload.codeRoom.toUpperCase();

    // Assurer que le client est dans la room chat
    client.join(roomCode);
    console.log(`💬 Chat: Client ${client.id} rejoint automatiquement la room chat: ${roomCode}`);

    const messages = await this.chatService.getMessagesByRoom(roomCode);
    client.emit('loadMessages', messages);
  }
}