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
import { RoomStateService, RoomGlobalStatus } from './room-state.service';

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

  constructor(
    private readonly roomsService: RoomsService,
    private readonly roomStateService: RoomStateService,
  ) {}

  handleConnection(client: Socket) {
    this.logger.log(`Client connecté: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client déconnecté: ${client.id}`);
    const roomCode = this.roomStateService.removeClient(client.id);
    if (roomCode) {
      this.logger.log(`[SYNC] Removed ${client.id} from room ${roomCode}`);
      // If room was LOADING and this client leaving makes all remaining ready, resume
      this.checkAndResumeIfAllReady(roomCode);
    }
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
    
    // Register client in in-memory state machine
    this.roomStateService.addClient(roomCode, client.id, memberId);
    this.logger.log(`[SYNC] Socket ${client.id} (member ${memberId}) joined room ${roomCode}`);

    try {
      const roomState = await this.roomsService.stateRoom(roomCode);
      let currentPosition = roomState.playbackState?.positionSec || 0;
      
      if (roomState.playbackState?.status === PlayStatus.PLAYING && roomState.playbackState.serverTimeRef) {
        const elapsedMs = Date.now() - new Date(roomState.playbackState.serverTimeRef).getTime();
        currentPosition += elapsedMs / 1000;
      }

      // Sync the in-memory state with DB on first join
      const inMemState = this.roomStateService.getOrCreateRoomState(roomCode);
      if (inMemState.clients.size === 1) {
        // First client: seed in-memory state from DB
        const dbStatus = roomState.playbackState?.status === PlayStatus.PLAYING
          ? RoomGlobalStatus.PLAYING
          : RoomGlobalStatus.PAUSED;
        this.roomStateService.updateStatus(roomCode, dbStatus, currentPosition);
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
      
      this.server.to(roomCode).emit('user-joined', { memberId, timestamp: new Date() });
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
      this.roomStateService.updateStatus(roomCode, RoomGlobalStatus.PLAYING, playback.positionSec);
      
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
      this.roomStateService.updateStatus(roomCode, RoomGlobalStatus.PAUSED, playback.positionSec);
      
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
    @MessageBody() data: { codeRoom: string; positionSec: number; wasPlaying?: boolean }
  ) {
    const { codeRoom, positionSec } = data;
    if (!codeRoom) return;
    const roomCode = codeRoom.toUpperCase();
    this.logger.log(`[SYNC] Seek requested in ${roomCode} to ${positionSec}s`);
    
    try {
      // 1. Update DB
      const { playback } = await this.roomsService.seek(roomCode, positionSec);
      
      // 2. Enter LOADING state: all clients must re-buffer
      this.roomStateService.prepareForSeek(roomCode, positionSec);
      this.logger.log(`[SYNC] Room ${roomCode} -> LOADING, waiting for all clients to be ready`);
      
      // 3. Broadcast force-seek to ALL clients (including sender)
      this.server.to(roomCode).emit('force-seek', {
        timecode: positionSec,
        status: playback.status,
        serverTimeRef: playback.serverTimeRef,
        timestamp: new Date(),
      });
      
      // Also emit legacy playback-updated for backward compatibility
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

  @SubscribeMessage('client-ready')
  handleClientReady(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { codeRoom: string }
  ) {
    const { codeRoom } = data;
    if (!codeRoom) return;
    const roomCode = codeRoom.toUpperCase();
    
    this.roomStateService.setClientReady(roomCode, client.id, true);
    const state = this.roomStateService.getFullState(roomCode);
    this.logger.log(`[SYNC] Client ${client.id} ready in ${roomCode} (${state.readyCount}/${state.connectedCount})`);
    
    this.checkAndResumeIfAllReady(roomCode);
  }

  /**
   * If all clients in the room are ready and the room is in LOADING state,
   * transition to PLAYING and broadcast all-ready so everyone resumes together.
   */
  private async checkAndResumeIfAllReady(roomCode: string) {
    const state = this.roomStateService.getFullState(roomCode);
    
    if (state.status !== RoomGlobalStatus.LOADING) return;
    if (!state.allReady) return;
    
    this.logger.log(`[SYNC] All clients ready in ${roomCode}! Resuming playback at ${state.currentTimestamp}s`);
    
    // Transition to PLAYING
    this.roomStateService.updateStatus(roomCode, RoomGlobalStatus.PLAYING, state.currentTimestamp);
    
    // Update DB as well
    try {
      await this.roomsService.play(roomCode, state.currentTimestamp);
    } catch (error) {
      this.logger.error('Error updating DB on all-ready:', error);
    }
    
    // Broadcast to all clients: resume playback now
    this.server.to(roomCode).emit('all-ready', {
      positionSec: state.currentTimestamp,
      serverTimeRef: new Date(),
      timestamp: new Date(),
    });
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
    
    // Reset room state for new video
    this.roomStateService.resetRoomState(roomCode);
    
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
    const state = this.roomStateService.getFullState(roomCode);
    this.server.to(roomCode).emit('test-sync-receive', { from: client.id, roomState: state, timestamp: new Date() });
  }
}