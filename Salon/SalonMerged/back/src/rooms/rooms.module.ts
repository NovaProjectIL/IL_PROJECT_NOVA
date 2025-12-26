import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoomsService } from './rooms.service';
import { RoomsController } from './rooms.controller';
import { Room } from '../entities/room.entity';
import { User } from '../entities/user.entity';
import { Playlist } from '../entities/playlist.entity';
import { PlaylistEntry } from '../entities/playlist-entry.entity';
import { PlaybackState } from '../entities/playback-state.entity';
import { YouTubeVideo } from '../entities/youtube-video.entity';
import { PlaylistModule } from '../playlist/playlist.module';
import { ChatSession } from '../entities/chat-session.entity';
import { RoomsGateway } from './rooms.gateway';

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
  ],
  controllers: [RoomsController],
  providers: [RoomsService, RoomsGateway],
  exports: [RoomsService],
})
export class RoomsModule {}