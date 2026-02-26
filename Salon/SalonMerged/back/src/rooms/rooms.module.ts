import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoomsService } from './rooms.service';
import { RoomsController } from './rooms.controller';
import { RoomStateService } from './room-state.service';
import { Room } from '../entities/room.entity';
// ... (rest of imports)
import { RoomsGateway } from './rooms.gateway';
import { ChatModule } from '../chat/chat.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Room,
      User,
      Playlist,
      PlaylistEntry,
      PlaybackState,
      YouTubeVideo,
      ChatSession,
    ]),
    PlaylistModule,  
    ChatModule,                  
  ],
  controllers: [RoomsController],
  providers: [RoomsService, RoomsGateway, RoomStateService],
  exports: [RoomsService, RoomStateService],
})
export class RoomsModule {}