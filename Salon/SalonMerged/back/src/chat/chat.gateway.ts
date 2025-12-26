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

// J'ajoute le namespace pour être au même endroit du salon 
@WebSocketGateway({ 
  namespace: '/rooms', 
  cors: { origin: '*' } 
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;

  constructor(private readonly chatService: ChatService) {}

  // Gestion de la connexion
  async handleConnection(client: Socket) {
    client.once('setUsername', async (payload: { username: string, userId?: number }) => {
      let user;
      if (payload.userId) {
        user = await this.chatService.findUserById(payload.userId);
      }
      if (!user) {
        user = await this.chatService.getOrCreateUser(payload.username);
      }
      client.data.user = user;
      
      client.emit('identity', {
        username: user.name,
        userId: user.id
      });
    });
  }

  handleDisconnect(client: Socket) {
    if (client.data.user) {

    }
  }

  // --- TYPING ---
  @SubscribeMessage('typing')
  handleTyping(
    @ConnectedSocket() client: Socket, 
    @MessageBody() payload: { isTyping: boolean, codeRoom: string } // <-- On passe de roomId à codeRoom (string)
  ) {
    const user = client.data.user;
    if (!user) return;

    client.to(payload.codeRoom).emit('userTyping', { 
      username: user.name, 
      isTyping: payload.isTyping 
    });
  }

  // --- SEND MESSAGE ---
  @SubscribeMessage('sendMessage')
  async handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { message?: string; gifUrl?: string; codeRoom: string },
  ) {
    const user = client.data.user;
    if (!user) return;

    client.to(payload.codeRoom).emit('userTyping', { 
      username: user.name, 
      isTyping: false 
    });
    const savedMessage = await this.chatService.saveMessage(
      user,
      payload.message,
      payload.gifUrl,
      payload.codeRoom
    );

    this.server.to(payload.codeRoom).emit('receiveMessage', {
      username: user.name, 
      message: savedMessage.content,
      gifUrl: savedMessage.gifUrl,
      createdAt: savedMessage.createdAt,
    });
  }
}