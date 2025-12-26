import { Module } from '@nestjs/common';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../entities/user.entity';
import { Message } from '../entities/message.entity';
import { Room } from '../entities/room.entity';
import { ChatSession } from '../entities/chat-session.entity';

@Module({
  imports: [
  
    TypeOrmModule.forFeature([
      User, 
      Message, 
      Room, 
      ChatSession
    ])
  ],
  providers: [ChatGateway, ChatService],
})
export class ChatModule {}