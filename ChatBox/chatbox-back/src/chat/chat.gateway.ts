import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';

@WebSocketGateway({
  cors: { origin: '*' },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private randomNames = ['Wafa', 'Ali', 'Bob', 'Sara', 'Lina', 'Tom'];

  constructor(private readonly chatService: ChatService) {}

  handleConnection(client: Socket) {
    // Attribuer un nom aléatoire au nouvel utilisateur
    const name = this.randomNames[Math.floor(Math.random() * this.randomNames.length)];
    this.chatService.assignUsername(client.id, name);
    console.log(`Client connecté : ${client.id} → ${name}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client déconnecté : ${client.id}`);
  }

  @SubscribeMessage('sendMessage')
  handleMessage(client: Socket, message: string) {
    const username = this.chatService.getUsername(client.id);

    const messageWithUsername = {
      username,
      message,
    };

    console.log(`${username} dit : ${message}`);

    // Envoyer le message à tous les clients
    this.server.emit('receiveMessage', messageWithUsername);
  }
}
