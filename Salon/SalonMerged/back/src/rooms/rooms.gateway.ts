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
    const roomCode = codeRoom.toUpperCase();
    this.logger.log(`Pause demandée dans ${roomCode} à ${positionSec}s`);
    
    try {
      const room = await this.roomsService.getRoomByCode(roomCode);
      const currentPlayback = await this.roomsService.getPlaybackState(room.id);

      let actualPosition = positionSec;
      if (actualPosition === undefined || actualPosition === null) {
        actualPosition = currentPlayback.positionSec || 0;
      }

      await this.roomsService.pause(roomCode, actualPosition);

      this.server.to(roomCode).emit('playback-updated', {
        action: 'pause',
        playback: {
          status: 'PAUSED',
          positionSec: actualPosition,
          serverTimeRef: new Date(),
        },
        timestamp: new Date(),
      });
      
      this.logger.log(`Pause broadcast à tous : position ${actualPosition}s`);
    } catch (error) {
      this.logger.error('Erreur pause:', error);
      this.server.to(roomCode).emit('playback-updated', {
        action: 'pause',
        playback: {
          status: 'PAUSED',
          positionSec: positionSec || 0,
          serverTimeRef: new Date(),
        },
        timestamp: new Date(),
      });
    }

    return { success: true };
  }

  @SubscribeMessage('seek')
  async handleSeek(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { codeRoom: string; positionSec: number; wasPlaying?: boolean }
  ) {
    const { codeRoom, positionSec } = data ?? {};

    // --- Validation stricte de l'identifiant de room ---
    if (!codeRoom || typeof codeRoom !== 'string' || codeRoom.trim() === '') {
      this.logger.warn(`[SYNC] Seek rejeté (${client.id}): identifiant de room invalide`);
      client.emit('seek-error', { message: 'Identifiant de room invalide' });
      return;
    }

    // --- Validation stricte du timecode (doit être un nombre fini strictement positif) ---
    if (typeof positionSec !== 'number' || !Number.isFinite(positionSec) || positionSec <= 0) {
      this.logger.warn(`[SYNC] Seek rejeté (${client.id}): timecode invalide (${positionSec})`);
      client.emit('seek-error', { message: 'Le timecode doit être un nombre strictement positif' });
      return;
    }

    const roomCode = codeRoom.toUpperCase();

    // --- Validation : le client doit appartenir à cette room ---
    if (!this.roomStateService.isClientInRoom(roomCode, client.id)) {
      this.logger.warn(`[SYNC] Seek rejeté (${client.id}): pas membre de la room ${roomCode}`);
      client.emit('seek-error', { message: 'Vous n\'êtes pas membre de cette room' });
      return;
    }

    this.logger.log(`[SYNC] Seek validé dans ${roomCode} vers ${positionSec}s`);
    
    try {
      // 1. Update DB
      const { playback } = await this.roomsService.seek(roomCode, positionSec);
      
      // 2. Enter LOADING state: all clients must re-buffer
      // prepareForSeek saves the current status (PLAYING/PAUSED) before switching to LOADING
      this.roomStateService.prepareForSeek(roomCode, positionSec);
      const wasPlaying = this.roomStateService.getStatusBeforeLoading(roomCode) === RoomGlobalStatus.PLAYING;
      this.logger.log(`[SYNC] Room ${roomCode} -> LOADING (wasPlaying=${wasPlaying}), waiting for all clients`);
      
      // 3. Broadcast force-seek to ALL clients (including sender)
      this.server.to(roomCode).emit('force-seek', {
        timecode: positionSec,
        wasPlaying,
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

  @SubscribeMessage('client-buffering')
  handleClientBuffering(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { codeRoom: string; positionSec?: number }
  ) {
    const { codeRoom, positionSec } = data;
    if (!codeRoom) return;
    const roomCode = codeRoom.toUpperCase();
    
    const state = this.roomStateService.getOrCreateRoomState(roomCode);
    // Only trigger LOADING if the room was PLAYING (avoid re-triggering during existing LOADING)
    if (state.status !== RoomGlobalStatus.PLAYING) {
      this.logger.log(`[SYNC] client-buffering ignored in ${roomCode} (status=${state.status})`);
      return;
    }
    
    // Anti-cascade: ignore buffering events within 3s of a recent all-ready
    const timeSinceAllReady = Date.now() - this.roomStateService.getLastAllReadyTime(roomCode);
    if (timeSinceAllReady < 3000) {
      this.logger.log(`[SYNC] client-buffering ignored in ${roomCode} (${timeSinceAllReady}ms since all-ready, cooldown)`);
      return;
    }
    
    // Anti-cascade: ignore transient buffering right after a play/pause/seek transition
    const timeSinceChange = Date.now() - state.lastUpdateServerTime;
    if (timeSinceChange < 2000) {
      this.logger.log(`[SYNC] client-buffering ignored in ${roomCode} (${timeSinceChange}ms since last status change, too soon)`);
      return;
    }
    
    const currentPos = positionSec ?? this.roomStateService.getAdjustedTimestamp(roomCode);
    this.logger.log(`[SYNC] Client ${client.id} buffering in ${roomCode} at ${currentPos}s -> LOADING`);
    
    // Switch room to LOADING, reset all ready flags
    this.roomStateService.prepareForSeek(roomCode, currentPos);
    
    // Order every OTHER client to pause (the buffering client is already paused/buffering)
    client.to(roomCode).emit('force-pause', {
      reason: 'client-buffering',
      positionSec: currentPos,
      timestamp: new Date(),
    });
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
    
    const resumeTo = state.statusBeforeLoading;
    this.logger.log(`[SYNC] All clients ready in ${roomCode}! Resuming to ${resumeTo} at ${state.currentTimestamp}s`);
    
    // Record the time to prevent buffering cascade
    this.roomStateService.setLastAllReadyTime(roomCode);
    
    // Transition to the state we were in before LOADING
    this.roomStateService.updateStatus(roomCode, resumeTo, state.currentTimestamp);
    
    // Update DB
    try {
      if (resumeTo === RoomGlobalStatus.PLAYING) {
        await this.roomsService.play(roomCode, state.currentTimestamp);
      } else {
        await this.roomsService.pause(roomCode, state.currentTimestamp);
      }
    } catch (error) {
      this.logger.error('Error updating DB on all-ready:', error);
    }
    
    // Broadcast to all clients
    this.server.to(roomCode).emit('all-ready', {
      positionSec: state.currentTimestamp,
      shouldPlay: resumeTo === RoomGlobalStatus.PLAYING,
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

  @SubscribeMessage('marker-created')
  handleMarkerCreated(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { codeRoom: string; marker: any }
  ) {
    const { codeRoom, marker } = data;
    if (!codeRoom || !marker) return;
    const roomCode = codeRoom.toUpperCase();
    client.to(roomCode).emit('nouveau_marqueur', marker);
    this.logger.log(`Marqueur broadcast dans ${roomCode}: ${marker.label}`);
  }

}
