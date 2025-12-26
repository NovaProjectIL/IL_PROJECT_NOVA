// src/app.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
// ... tes autres imports ...
import { RoomsModule } from './rooms/rooms.module';
import { PlaylistModule } from './playlist/playlist.module';

// ✅ Import du module qu'on vient de créer ci-dessus
import { ChatModule } from './chat/chat.module'; 
import { ChatSession } from './entities/chat-session.entity';
// (Ajoute aussi les autres entités si elles manquent dans forRoot)
import { Room } from './entities/room.entity';
import { User } from './entities/user.entity';
import { Message } from './entities/message.entity';
import { Playlist } from './entities/playlist.entity';
import { PlaylistEntry } from './entities/playlist-entry.entity';
import { PlaybackState } from './entities/playback-state.entity';
import { YouTubeVideo } from './entities/youtube-video.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST,          
      port: Number(process.env.DB_PORT) || 5432,
      username: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME,
      entities: [
        Room,
        User,
        Message,
        Playlist,
        PlaylistEntry,
        PlaybackState,
        YouTubeVideo,
        ChatSession,
      ],
      synchronize: process.env.DB_SYNC === 'true',
    }),
    RoomsModule,
    PlaylistModule,
    ChatModule, // 👈 C'est ici qu'on active le Chat
  ],
})
export class AppModule {}