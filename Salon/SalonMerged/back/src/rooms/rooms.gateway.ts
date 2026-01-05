import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { RoomsService } from './rooms.service';
import { PlayStatus } from '../entities/playback-state.entity';
import { ChatModule } from '../chat/chat.module';

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
})
export class RoomsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;
  
  private logger = new Logger('RoomsGateway');

  constructor(private readonly roomsService: RoomsService) {}

  handleConnection(client: Socket) {
    this.logger.log(`✅ Client connecté: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`❌ Client déconnecté: ${client.id}`);
  }

  @SubscribeMessage('join-room')
  async handleJoinRoom(client: Socket, data: { codeRoom: string; memberId: number }) {
    const { codeRoom, memberId } = data;
    const roomCode = codeRoom.toUpperCase();
    
    // Quitter toutes les rooms précédentes
    const rooms = Array.from(client.rooms);
    rooms.forEach(room => {
      if (room !== client.id) {
        client.leave(room);
      }
    });
    
    // Rejoindre la nouvelle room
    client.join(roomCode);
    
    this.logger.log(`👤 ${client.id} (membre ${memberId}) rejoint room: ${roomCode}`);

    let roomState: any;
    try {
      // Récupérer l'état complet de la room
      roomState = await this.roomsService.stateRoom(roomCode);
      
      // IMPORTANT: Calculer la position actuelle si en lecture
      let currentPosition = roomState.playbackState?.positionSec || 0;
      
      if (roomState.playbackState?.status === PlayStatus.PLAYING && roomState.playbackState.serverTimeRef) {
        const elapsedMs = Date.now() - new Date(roomState.playbackState.serverTimeRef).getTime();
        const elapsedSec = elapsedMs / 1000;
        currentPosition = (roomState.playbackState.positionSec || 0) + elapsedSec;
        
        this.logger.log(`⏱️ Position calculée pour nouveau membre: ${currentPosition.toFixed(2)}s (élapsed: ${elapsedSec.toFixed(2)}s)`);
      }
      
      // Envoyer l'état EXACT au nouveau client
      client.emit('room-initial-state', {
        playback: {
          status: roomState.playbackState?.status || PlayStatus.PAUSED,
          positionSec: currentPosition,
          playbackRate: roomState.playbackState?.playbackRate || 1.0,
          serverTimeRef: new Date(),
          video: roomState.playbackState?.video ? {
            youtubeId: roomState.playbackState.video.youtubeId,
            title: roomState.playbackState.video.title,
            channelTitle: roomState.playbackState.video.channelTitle,
            durationSec: roomState.playbackState.video.durationSec,
            thumbnailUrl: roomState.playbackState.video.thumbnailUrl,
          } : null,
        },
        playlist: roomState.playlist ? {
          currentIndex: roomState.playlist.currentIndex,
          entries: roomState.entries?.map(entry => ({
            id: entry.id,
            position: entry.position,
            video: entry.video ? {
              youtubeId: entry.video.youtubeId,
              title: entry.video.title,
              channelTitle: entry.video.channelTitle,
              durationSec: entry.video.durationSec,
              thumbnailUrl: entry.video.thumbnailUrl,
            } : null,
          })) || [],
        } : null,
        users: roomState.users?.map(user => ({
          id: user.id,
          name: user.name,
          role: user.role,
        })) || [],
        timestamp: new Date(),
        message: 'État initial de la room reçu'
      });
      
      this.logger.log(`📊 État initial envoyé à ${memberId}:`, {
        status: roomState.playbackState?.status,
        position: currentPosition.toFixed(2),
        video: roomState.playbackState?.video?.youtubeId || 'aucune'
      });
      
    } catch (error) {
      this.logger.error(`❌ Erreur envoi état initial à ${memberId}:`, error);
      client.emit('room-initial-state', {
        playback: {
          status: PlayStatus.PAUSED,
          positionSec: 0,
          playbackRate: 1.0,
          serverTimeRef: new Date(),
          video: null,
        },
        timestamp: new Date(),
        message: 'État par défaut (erreur récupération)'
      });
    }
    
    // Informer les autres utilisateurs du nouvel arrivant
    client.to(roomCode).emit('user-joined', {
      memberId,
      timestamp: new Date(),
    });

    // Envoyer une notification dans le chat
    if (roomState) {
      const user = roomState.users.find(u => u.id === memberId);
      if (user) {
        this.server.to(roomCode).emit('receiveMessage', {
          username: 'System',
          userId: null, // Indique un message système
          message: `${user.name} has joined the room`,
          gifUrl: null,
          createdAt: new Date(),
        });
      }
    }

    return { success: true, room: roomCode };
  }

 // 🎯 DANS rooms.gateway.ts

@SubscribeMessage('play')
async handlePlay(client: Socket, data: { codeRoom: string; positionSec?: number }) {
  const { codeRoom, positionSec } = data;
  const roomCode = codeRoom.toUpperCase();
  
  this.logger.log(`▶️ Play demandé dans ${roomCode} avec position: ${positionSec}`);
  
  try {
    // 1️⃣ RÉCUPÉRER LE PLAYBACK ACTUEL DEPUIS LA DB
    const room = await this.roomsService.getRoomByCode(roomCode);
    const currentPlayback = await this.roomsService.getPlaybackState(room.id);
    
    // 2️⃣ CALCULER LA VRAIE POSITION ACTUELLE
    let actualPosition = positionSec; // Position envoyée par le client
    
    // Si le client n'a pas envoyé de position, calculer depuis le dernier état
    if (actualPosition === undefined || actualPosition === null) {
      actualPosition = currentPlayback.positionSec || 0;
      
      // Si c'était déjà en PLAYING, calculer le temps écoulé
      if (currentPlayback.status === PlayStatus.PLAYING && currentPlayback.serverTimeRef) {
        const elapsedMs = Date.now() - new Date(currentPlayback.serverTimeRef).getTime();
        const elapsedSec = elapsedMs / 1000;
        actualPosition = (currentPlayback.positionSec || 0) + elapsedSec;
        
        this.logger.log(`⏱️ Position recalculée: ${actualPosition.toFixed(2)}s (élapsed: ${elapsedSec.toFixed(2)}s)`);
      }
    }
    
    // 3️⃣ METTRE À JOUR EN BASE DE DONNÉES
    await this.roomsService.play(roomCode, actualPosition);
    
    // 4️⃣ BROADCAST LA VRAIE POSITION À TOUS LES CLIENTS
    this.server.to(roomCode).emit('playback-updated', {
      action: 'play',
      playback: { 
        status: PlayStatus.PLAYING,
        positionSec: actualPosition,
        serverTimeRef: new Date(),
      },
      timestamp: new Date(),
    });
    
    this.logger.log(`✅ Play broadcast à tous les clients: position ${actualPosition.toFixed(2)}s`);
    
  } catch (error) {
    this.logger.error('❌ Erreur mise à jour état play:', error);
    
    // En cas d'erreur, utiliser la position fournie ou 0
    this.server.to(roomCode).emit('playback-updated', {
      action: 'play',
      playback: { 
        status: PlayStatus.PLAYING,
        positionSec: positionSec || 0,
        serverTimeRef: new Date(),
      },
      timestamp: new Date(),
    });
  }
  
  return { success: true };
}

@SubscribeMessage('pause')
async handlePause(client: Socket, data: { codeRoom: string; positionSec?: number }) {
  const { codeRoom, positionSec } = data;
  const roomCode = codeRoom.toUpperCase();
  
  this.logger.log(`⏸️ Pause demandée dans ${roomCode} avec position: ${positionSec}`);
  
  try {
    // 1️⃣ RÉCUPÉRER LE PLAYBACK ACTUEL
    const room = await this.roomsService.getRoomByCode(roomCode);
    const currentPlayback = await this.roomsService.getPlaybackState(room.id);
    
    // 2️⃣ CALCULER LA VRAIE POSITION ACTUELLE
    let actualPosition = positionSec;
    
    if (actualPosition === undefined || actualPosition === null) {
      actualPosition = currentPlayback.positionSec || 0;
      
      // Si c'était en PLAYING, calculer où on en est maintenant
      if (currentPlayback.status === PlayStatus.PLAYING && currentPlayback.serverTimeRef) {
        const elapsedMs = Date.now() - new Date(currentPlayback.serverTimeRef).getTime();
        const elapsedSec = elapsedMs / 1000;
        actualPosition = (currentPlayback.positionSec || 0) + elapsedSec;
        
        this.logger.log(`⏱️ Position recalculée pour pause: ${actualPosition.toFixed(2)}s`);
      }
    }
    
    // 3️⃣ METTRE À JOUR EN BASE
    await this.roomsService.pause(roomCode, actualPosition);
    
    // 4️⃣ BROADCAST À TOUS
    this.server.to(roomCode).emit('playback-updated', {
      action: 'pause',
      playback: { 
        status: PlayStatus.PAUSED,
        positionSec: actualPosition,
        serverTimeRef: new Date(),
      },
      timestamp: new Date(),
    });
    
    this.logger.log(`✅ Pause broadcast: position ${actualPosition.toFixed(2)}s`);
    
  } catch (error) {
    this.logger.error('❌ Erreur mise à jour état pause:', error);
    
    this.server.to(roomCode).emit('playback-updated', {
      action: 'pause',
      playback: { 
        status: PlayStatus.PAUSED,
        positionSec: positionSec || 0,
        serverTimeRef: new Date(),
      },
      timestamp: new Date(),
    });
  }
  
  return { success: true };
}

  @SubscribeMessage('seek')
  async handleSeek(client: Socket, data: { codeRoom: string; positionSec: number; wasPlaying?: boolean }) {
    const { codeRoom, positionSec, wasPlaying } = data;
    const roomCode = codeRoom.toUpperCase();
    
    this.logger.log(`🎯 Seek dans ${roomCode} à ${positionSec}s (wasPlaying: ${wasPlaying})`);
    
    try {
      await this.roomsService.seek(roomCode, positionSec);
    } catch (error) {
      this.logger.error('❌ Erreur mise à jour état seek:', error);
    }
    
    // IMPORTANT: Ne pas changer l'état play/pause lors du seek
    this.server.to(roomCode).emit('playback-updated', {
      action: 'seek',
      playback: { 
        positionSec,
        serverTimeRef: new Date(),
        // Ne pas envoyer le status pour ne pas changer play/pause
      },
      timestamp: new Date(),
    });
    
    return { success: true };
  }

  @SubscribeMessage('video-change')
  handleVideoChange(client: Socket, data: { codeRoom: string; videoId: string }) {
    const { codeRoom, videoId } = data;
    const roomCode = codeRoom.toUpperCase();
    
    this.logger.log(`🎬 Changement vidéo dans ${roomCode} -> ${videoId}`);
    
    this.server.to(roomCode).emit('video-changed', {
      videoId,
      timestamp: new Date(),
    });
    
    return { success: true };
  }

  @SubscribeMessage('request-sync')
  async handleRequestSync(client: Socket, data: { codeRoom: string }) {
    const { codeRoom } = data;
    const roomCode = codeRoom.toUpperCase();
    
    this.logger.log(`🔄 Demande de synchronisation de ${client.id} dans ${roomCode}`);
    
    try {
      const roomState = await this.roomsService.stateRoom(roomCode);
      
      let currentPosition = roomState.playbackState?.positionSec || 0;
      
      if (roomState.playbackState?.status === PlayStatus.PLAYING && roomState.playbackState.serverTimeRef) {
        const elapsedMs = Date.now() - new Date(roomState.playbackState.serverTimeRef).getTime();
        const elapsedSec = elapsedMs / 1000;
        currentPosition = (roomState.playbackState.positionSec || 0) + elapsedSec;
      }
      
      client.emit('room-sync', {
        playback: {
          status: roomState.playbackState?.status || PlayStatus.PAUSED,
          positionSec: currentPosition,
          serverTimeRef: new Date(),
          video: roomState.playbackState?.video ? {
            youtubeId: roomState.playbackState.video.youtubeId,
            title: roomState.playbackState.video.title,
          } : null,
        },
        timestamp: new Date(),
      });
      
      this.logger.log(`📤 État actuel envoyé à ${client.id}`);
    } catch (error) {
      this.logger.error(`❌ Erreur envoi état actuel:`, error);
    }
    
    return { success: true };
  }
}