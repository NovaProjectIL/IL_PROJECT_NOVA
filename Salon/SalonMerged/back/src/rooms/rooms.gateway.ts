import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { RoomsService } from './rooms.service';
import { PlayStatus } from '../entities/playback-state.entity';

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
    this.logger.log(`Client connecté: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client déconnecté: ${client.id}`);
  }

  @SubscribeMessage('join-room')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { codeRoom: string; memberId: number }
  ) {
    const { codeRoom, memberId } = data;
    if (!codeRoom) return;
    
    const roomCode = codeRoom.toUpperCase();
    await client.join(roomCode);
    this.logger.log(`[SYNC] Socket ${client.id} joined room ${roomCode}`);

    try {
      const roomState = await this.roomsService.stateRoom(roomCode);
      let currentPosition = roomState.playbackState?.positionSec || 0;
      
      if (roomState.playbackState?.status === PlayStatus.PLAYING && roomState.playbackState.serverTimeRef) {
        const elapsedMs = Date.now() - new Date(roomState.playbackState.serverTimeRef).getTime();
        currentPosition += elapsedMs / 1000;
      }
      
      client.emit('room-initial-state', {
        playback: {
          status: roomState.playbackState?.status || PlayStatus.PAUSED,
          positionSec: currentPosition,
          playbackRate: roomState.playbackState?.playbackRate || 1.0,
          serverTimeRef: new Date(),
          video: roomState.playbackState?.video ? {
            youtubeId: roomState.playbackState.video.youtubeId,
            title: roomState.playbackState.video.title,
            durationSec: roomState.playbackState.video.durationSec,
          } : null,
        },
        users: roomState.users?.map(user => ({
          id: user.id,
          name: user.name,
          role: user.role,
        })) || [],
        timestamp: new Date(),
      });
      
      // Notify everyone including sender
      this.server.to(roomCode).emit('user-joined', { memberId, timestamp: new Date() });
      
      // Confirm to sender
      client.emit('room-joined-confirm', { room: roomCode, socketId: client.id });
      
    } catch (error) {
      this.logger.error(`Error handleJoinRoom:`, error);
    }
  }

  @SubscribeMessage('play')
  async handlePlay(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { codeRoom: string; positionSec?: number }
  ) {
    const { codeRoom, positionSec } = data;
    if (!codeRoom) return;
    const roomCode = codeRoom.toUpperCase();
    this.logger.log(`[SYNC] Play requested in ${roomCode} at ${positionSec}s`);
    
    try {
      const { playback } = await this.roomsService.play(roomCode, positionSec);
      this.server.to(roomCode).emit('playback-updated', {
        action: 'play',
        playback: { 
          status: playback.status,
          positionSec: playback.positionSec,
          serverTimeRef: playback.serverTimeRef,
        },
        timestamp: new Date(),
      });
    } catch (error) {
      this.logger.error('Error handlePlay:', error);
    }
  }

  @SubscribeMessage('pause')
  async handlePause(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { codeRoom: string; positionSec?: number }
  ) {
    const { codeRoom, positionSec } = data;
    if (!codeRoom) return;
    const roomCode = codeRoom.toUpperCase();
    this.logger.log(`[SYNC] Pause requested in ${roomCode} at ${positionSec}s`);
    
    try {
      const { playback } = await this.roomsService.pause(roomCode, positionSec);
      this.server.to(roomCode).emit('playback-updated', {
        action: 'pause',
        playback: { 
          status: playback.status,
          positionSec: playback.positionSec,
          serverTimeRef: playback.serverTimeRef,
        },
        timestamp: new Date(),
      });
    } catch (error) {
      this.logger.error('Error handlePause:', error);
    }
  }

  @SubscribeMessage('seek')
  async handleSeek(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { codeRoom: string; positionSec: number }
  ) {
    const { codeRoom, positionSec } = data;
    if (!codeRoom) return;
    const roomCode = codeRoom.toUpperCase();
    this.logger.log(`[SYNC] Seek requested in ${roomCode} to ${positionSec}s`);
    
    try {
      const { playback } = await this.roomsService.seek(roomCode, positionSec);
      this.server.to(roomCode).emit('playback-updated', {
        action: 'seek',
        playback: { 
          status: playback.status,
          positionSec: playback.positionSec,
          serverTimeRef: playback.serverTimeRef,
        },
        timestamp: new Date(),
      });
    } catch (error) {
      this.logger.error('Error handleSeek:', error);
    }
  }

  @SubscribeMessage('video-change')
  handleVideoChange(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { codeRoom: string; videoId: string }
  ) {
    const { codeRoom, videoId } = data;
    if (!codeRoom) return;
    const roomCode = codeRoom.toUpperCase();
    this.logger.log(`[SYNC] Video change in ${roomCode} to ${videoId}`);
    
    this.server.to(roomCode).emit('video-changed', {
      videoId,
      timestamp: new Date(),
    });
  }

  @SubscribeMessage('test-sync')
  handleTestSync(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { codeRoom: string }
  ) {
    const { codeRoom } = data;
    const roomCode = codeRoom?.toUpperCase();
    this.logger.log(`[SYNC] Test sync requested in ${roomCode}`);
    this.server.to(roomCode).emit('test-sync-receive', { from: client.id, timestamp: new Date() });
  }
}