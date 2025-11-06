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
  @WebSocketServer()
  server: Server;

  private randomNames = ['Wafa', 'Ali', 'Bob', 'Sara', 'Lina', 'Tom'];

  constructor(private readonly chatService: ChatService) {}

  async handleConnection(client: Socket) {
    const name = this.randomNames[Math.floor(Math.random() * this.randomNames.length)];
    const user = await this.chatService.getOrCreateUser(name);

    client.data.user = user;

    const messages = await this.chatService.getAllMessages();
    client.emit('loadMessages', messages);

    console.log(`Client connecté: ${client.id} -> ${user.name}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client déconnecté: ${client.id}`);
  }

  @SubscribeMessage('sendMessage')
  async handleMessage(client: Socket, message: string) {
    const user = client.data.user;

    await this.chatService.saveMessage(user, message);

    this.server.emit('receiveMessage', { username: user.name, message });
  }
}
