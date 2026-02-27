import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoomsService } from './rooms.service';
import { RoomsController } from './rooms.controller';
import { RoomStateService } from './room-state.service';
import { Room } from '../entities/room.entity';
import { User } from '../entities/user.entity';
import { Playlist } from '../entities/playlist.entity';
import { PlaylistEntry } from '../entities/playlist-entry.entity';
import { PlaybackState } from '../entities/playback-state.entity';
import { YouTubeVideo } from '../entities/youtube-video.entity';
import { ChatSession } from '../entities/chat-session.entity';
import { PlaylistModule } from '../playlist/playlist.module';
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