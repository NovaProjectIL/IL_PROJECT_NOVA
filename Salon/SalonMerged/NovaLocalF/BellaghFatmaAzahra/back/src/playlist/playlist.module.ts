import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlaylistService } from './playlist.service';
import { PlaylistController } from './playlist.controller';
import { Room } from '../entities/room.entity';
import { User } from '../entities/user.entity';
import { Playlist } from '../entities/playlist.entity';
import { PlaylistEntry } from '../entities/playlist-entry.entity';
import { PlaybackState } from '../entities/playback-state.entity';
import { YouTubeVideo } from '../entities/youtube-video.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Room,
      User,
      Playlist,
      PlaylistEntry,
      PlaybackState,
      YouTubeVideo,
    ]),
  ],
  controllers: [PlaylistController],
  providers: [PlaylistService],
  exports: [PlaylistService],
})
export class PlaylistModule {}