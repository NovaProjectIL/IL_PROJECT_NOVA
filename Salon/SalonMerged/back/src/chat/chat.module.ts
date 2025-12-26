// src/chat/chat.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { User } from '../entities/user.entity';
import { Message } from '../entities/message.entity';
import { Room } from '../entities/room.entity';
import { ChatSession } from '../entities/chat-session.entity';

@Module({
  imports: [
    // On rend les entités disponibles pour le ChatService
    TypeOrmModule.forFeature([User, Message, Room, ChatSession])
  ],
  providers: [ChatGateway, ChatService],
  exports: [ChatService] // Optionnel, mais utile
})
export class ChatModule {}