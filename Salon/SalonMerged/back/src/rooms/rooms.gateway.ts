import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
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
  pingInterval: 5000,
  pingTimeout: 10000,
})
export class RoomsGateway implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit {
  @WebSocketServer()
  server: Server;
  
  private logger = new Logger('RoomsGateway');
  private syncCheckTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly roomsService: RoomsService,
    private readonly roomStateService: RoomStateService,
  ) {}

  afterInit() {
    // Task 4 : enregistrer le callback de timeout LOADING (8s)
    this.roomStateService.onLoadingTimeout(async (roomCode: string) => {
      await this.forceResumeFromTimeout(roomCode);
    });

    // Periodic sync-check: every 5s, verify all clients are at the same position
    this.startPeriodicSyncCheck();
  }

  /**
   * Task 4 : Quand une room reste bloquée en LOADING pendant plus de 8 secondes,
   * le serveur abandonne l'attente, log l'incident, repasse en PLAYING
   * et force tous les clients actifs à reprendre la vidéo.
   */
  private async forceResumeFromTimeout(roomCode: string) {
    const state = this.roomStateService.getFullState(roomCode);
    if (state.status !== RoomGlobalStatus.LOADING) return;

    this.logger.warn(
      `[TIMEOUT] Room ${roomCode} : LOADING timeout expiré (>8s). ` +
      `${state.readyCount}/${state.connectedCount} clients prêts. Reprise forcée en PLAYING.`,
    );

    // Forcer la transition vers PLAYING
    this.roomStateService.setLastAllReadyTime(roomCode);
    this.roomStateService.updateStatus(roomCode, RoomGlobalStatus.PLAYING, state.currentTimestamp);

    // Mettre à jour la base de données
    try {
      await this.roomsService.play(roomCode, state.currentTimestamp);
    } catch (error) {
      this.logger.error('[TIMEOUT] Erreur DB lors de la reprise forcée:', error);
    }

    // Notifier tous les clients de reprendre
    this.server.to(roomCode).emit('all-ready', {
      positionSec: state.currentTimestamp,
      shouldPlay: true,
      serverTimeRef: new Date(),
      timestamp: new Date(),
      reason: 'loading-timeout',
    });
  }

  // ── Periodic position sync-check ──────────────────────────────────

  /**
   * Every 5 seconds, for each PLAYING room with >1 client,
   * ask all clients for their actual YouTube player position.
   * After a 1.5s collection window, compare positions.
   * If max drift > 2s, enter LOADING and force-seek everyone to the server reference.
   */
  private startPeriodicSyncCheck() {
    this.syncCheckTimer = setInterval(() => {
      const playingRooms = this.roomStateService.getPlayingRooms();
      for (const roomCode of playingRooms) {
        // Skip rooms that just finished a sync cycle
        const timeSinceAllReady = Date.now() - this.roomStateService.getLastAllReadyTime(roomCode);
        if (timeSinceAllReady < 5000) continue;

        this.server.to(roomCode).emit('sync-check', { timestamp: Date.now() });

        // Evaluate after 1.5s collection window
        setTimeout(() => this.evaluateSyncCheck(roomCode), 1500);
      }
    }, 5000);
  }

  private async evaluateSyncCheck(roomCode: string) {
    const state = this.roomStateService.getOrCreateRoomState(roomCode);
    // Only act if still PLAYING
    if (state.status !== RoomGlobalStatus.PLAYING) return;
    // Double-check cooldown (another sync may have happened during the collection window)
    const timeSinceAllReady = Date.now() - this.roomStateService.getLastAllReadyTime(roomCode);
    if (timeSinceAllReady < 5000) return;

    const { drifted, maxDrift, positions } = this.roomStateService.getPositionDrift(roomCode);
    if (!drifted) return;

    const referencePos = this.roomStateService.getAdjustedTimestamp(roomCode);
    this.logger.warn(
      `[SYNC-CHECK] Drift détecté dans ${roomCode} : ${maxDrift.toFixed(1)}s ` +
      `(positions : [${positions.map(p => p.toFixed(1)).join(', ')}], ` +
      `référence : ${referencePos.toFixed(1)}s) → re-sync`,
    );

    // Reuse existing LOADING → all-ready flow
    this.roomStateService.prepareForSeek(roomCode, referencePos);
    this.server.to(roomCode).emit('force-seek', {
      timecode: referencePos,
      wasPlaying: true,
      serverTimeRef: new Date(),
      timestamp: new Date(),
      reason: 'periodic-sync-check',
    });
  }

  // ── Helpers de validation (Task 5) ──────────────────────────────────

  /** Valide qu'un codeRoom est une chaîne non-vide et retourne la version normalisée. */
  private validateRoomCode(codeRoom: unknown, clientId: string, event: string): string | null {
    if (!codeRoom || typeof codeRoom !== 'string' || (codeRoom as string).trim() === '') {
      this.logger.warn(`[SECURITY] ${event} rejeté (${clientId}): identifiant de room invalide`);
      return null;
    }
    return (codeRoom as string).toUpperCase();
  }

  /** Vérifie que le client appartient bien à la room. */
  private validateMembership(roomCode: string, client: Socket, event: string): boolean {
    if (!this.roomStateService.isClientInRoom(roomCode, client.id)) {
      this.logger.warn(`[SECURITY] ${event} rejeté (${client.id}): pas membre de la room ${roomCode}`);
      client.emit('error', { message: `Action non autorisée : vous n'êtes pas membre de cette room` });
      return false;
    }
    return true;
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connecté: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client déconnecté: ${client.id}`);
    const removed = this.roomStateService.removeClient(client.id);
    if (removed) {
      const { roomCode, memberId } = removed;
      this.logger.log(`[SYNC] Removed ${client.id} from room ${roomCode}`);
      if (memberId !== undefined) {
        this.server.to(roomCode).emit('user-left', { memberId, timestamp: new Date() });
      }
      const state = this.roomStateService.getOrCreateRoomState(roomCode);

      if (state.clients.size === 0) return;

      if (state.status === RoomGlobalStatus.LOADING) {
        // Room was loading — removing this client might make everyone ready
        this.checkAndResumeIfAllReady(roomCode);
      } else if (state.status === RoomGlobalStatus.PLAYING) {
        // Client dropped during playback -> briefly pause to resync.
        // Remaining clients will auto-ready within ~500ms and resume.
        const pos = this.roomStateService.getAdjustedTimestamp(roomCode);
        this.logger.log(`[SYNC] Client disconnected from ${roomCode} during PLAYING -> LOADING at ${pos}s`);
        this.roomStateService.prepareForSeek(roomCode, pos);
        this.server.to(roomCode).emit('force-pause', {
          reason: 'client-disconnect',
          positionSec: pos,
          timestamp: new Date(),
        });
      }
    }
  }

  @SubscribeMessage('join-room')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { codeRoom: string; memberId: number }
  ) {
    // Validation du payload (pas de check membership car le client rejoint)
    const roomCode = this.validateRoomCode(data?.codeRoom, client.id, 'join-room');
    if (!roomCode) return;

    const memberId = data.memberId;
    if (typeof memberId !== 'number' || !Number.isFinite(memberId)) {
      this.logger.warn(`[SECURITY] join-room rejeté (${client.id}): memberId invalide (${memberId})`);
      return;
    }

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
    const roomCode = this.validateRoomCode(data?.codeRoom, client.id, 'play');
    if (!roomCode) return;
    if (!this.validateMembership(roomCode, client, 'play')) return;

    // Block play during LOADING — all-ready will handle resume
    const currentState = this.roomStateService.getOrCreateRoomState(roomCode);
    if (currentState.status === RoomGlobalStatus.LOADING) {
      this.logger.log(`[SYNC] play ignored in ${roomCode} (LOADING)`);
      return;
    }

    const positionSec = data.positionSec;
    // Valider positionSec si fourni
    if (positionSec !== undefined && positionSec !== null) {
      if (typeof positionSec !== 'number' || !Number.isFinite(positionSec) || positionSec < 0) {
        this.logger.warn(`[SECURITY] play rejeté (${client.id}): positionSec invalide (${positionSec})`);
        return;
      }
    }

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
    const roomCode = this.validateRoomCode(data?.codeRoom, client.id, 'pause');
    if (!roomCode) return;
    if (!this.validateMembership(roomCode, client, 'pause')) return;

    // Block pause during LOADING — the room is already paused for sync
    const currentState = this.roomStateService.getOrCreateRoomState(roomCode);
    if (currentState.status === RoomGlobalStatus.LOADING) {
      this.logger.log(`[SYNC] pause ignored in ${roomCode} (LOADING)`);
      return;
    }

    const positionSec = data.positionSec;
    // Valider positionSec si fourni
    if (positionSec !== undefined && positionSec !== null) {
      if (typeof positionSec !== 'number' || !Number.isFinite(positionSec) || positionSec < 0) {
        this.logger.warn(`[SECURITY] pause rejeté (${client.id}): positionSec invalide (${positionSec})`);
        return;
      }
    }

    this.logger.log(`Pause demandée dans ${roomCode} à ${positionSec}s`);
    
    try {
      const room = await this.roomsService.getRoomByCode(roomCode);
      const currentPlayback = await this.roomsService.getPlaybackState(room.id);

      let actualPosition = positionSec;
      if (actualPosition === undefined || actualPosition === null) {
        actualPosition = currentPlayback.positionSec || 0;
      }

      await this.roomsService.pause(roomCode, actualPosition);
      this.roomStateService.updateStatus(roomCode, RoomGlobalStatus.PAUSED, actualPosition);

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

    // --- Validation stricte du timecode (doit être un nombre fini positif ou zéro) ---
    if (typeof positionSec !== 'number' || !Number.isFinite(positionSec) || positionSec < 0) {
      this.logger.warn(`[SYNC] Seek rejeté (${client.id}): timecode invalide (${positionSec})`);
      client.emit('seek-error', { message: 'Le timecode doit être un nombre positif' });
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
      // Note: we do NOT emit playback-updated for seek anymore — force-seek + all-ready
      // handle the full seek flow. Emitting both caused duplicate state transitions.
    } catch (error) {
      this.logger.error('Error handleSeek:', error);
    }
  }

  @SubscribeMessage('client-buffering')
  handleClientBuffering(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { codeRoom: string; positionSec?: number }
  ) {
    const roomCode = this.validateRoomCode(data?.codeRoom, client.id, 'client-buffering');
    if (!roomCode) return;
    if (!this.validateMembership(roomCode, client, 'client-buffering')) return;

    // Valider positionSec si fourni
    const positionSec = data.positionSec;
    if (positionSec !== undefined && positionSec !== null) {
      if (typeof positionSec !== 'number' || !Number.isFinite(positionSec) || positionSec < 0) {
        this.logger.warn(`[SECURITY] client-buffering rejeté (${client.id}): positionSec invalide`);
        return;
      }
    }
    
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
    if (timeSinceChange < 1000) {
      this.logger.log(`[SYNC] client-buffering ignored in ${roomCode} (${timeSinceChange}ms since last status change, too soon)`);
      return;
    }
    
    const currentPos = positionSec ?? this.roomStateService.getAdjustedTimestamp(roomCode);
    this.logger.log(`[SYNC] Client ${client.id} buffering in ${roomCode} at ${currentPos}s -> LOADING`);
    
    // Switch room to LOADING, reset all ready flags
    this.roomStateService.prepareForSeek(roomCode, currentPos);
    
    // Notify ALL clients (including the buffering one) to pause and enter LOADING.
    // Include the buffering client's ID so it can skip pausing its YouTube player
    // (YouTube stops buffering when paused, which would cause a premature client-ready).
    this.server.to(roomCode).emit('force-pause', {
      reason: 'client-buffering',
      bufferingClientId: client.id,
      positionSec: currentPos,
      timestamp: new Date(),
    });
  }

  @SubscribeMessage('client-ready')
  handleClientReady(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { codeRoom: string }
  ) {
    const roomCode = this.validateRoomCode(data?.codeRoom, client.id, 'client-ready');
    if (!roomCode) return;
    if (!this.validateMembership(roomCode, client, 'client-ready')) return;
    
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

  @SubscribeMessage('position-report')
  handlePositionReport(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { codeRoom: string; positionSec: number }
  ) {
    const roomCode = this.validateRoomCode(data?.codeRoom, client.id, 'position-report');
    if (!roomCode) return;
    if (!this.validateMembership(roomCode, client, 'position-report')) return;

    const positionSec = data.positionSec;
    if (typeof positionSec !== 'number' || !Number.isFinite(positionSec) || positionSec < 0) return;

    this.roomStateService.updateClientPosition(roomCode, client.id, positionSec);
  }

  @SubscribeMessage('video-change')
  handleVideoChange(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { codeRoom: string; videoId: string }
  ) {
    const roomCode = this.validateRoomCode(data?.codeRoom, client.id, 'video-change');
    if (!roomCode) return;
    if (!this.validateMembership(roomCode, client, 'video-change')) return;

    const videoId = data.videoId;
    if (!videoId || typeof videoId !== 'string' || videoId.trim() === '') {
      this.logger.warn(`[SECURITY] video-change rejeté (${client.id}): videoId invalide`);
      return;
    }

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
    const roomCode = this.validateRoomCode(data?.codeRoom, client.id, 'marker-created');
    if (!roomCode) return;
    if (!this.validateMembership(roomCode, client, 'marker-created')) return;

    const marker = data.marker;
    if (!marker || typeof marker !== 'object') {
      this.logger.warn(`[SECURITY] marker-created rejeté (${client.id}): marker invalide`);
      return;
    }

    client.to(roomCode).emit('nouveau_marqueur', marker);
    this.logger.log(`Marqueur broadcast dans ${roomCode}: ${marker.label}`);
  }

  @SubscribeMessage('marker-updated')
  handleMarkerUpdated(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { codeRoom: string; marker: any }
  ) {
    const roomCode = this.validateRoomCode(data?.codeRoom, client.id, 'marker-updated');
    if (!roomCode) return;
    if (!this.validateMembership(roomCode, client, 'marker-updated')) return;

    const marker = data.marker;
    if (!marker || typeof marker !== 'object') {
      this.logger.warn(`[SECURITY] marker-updated rejetÃ© (${client.id}): marker invalide`);
      return;
    }

    client.to(roomCode).emit('marker-updated', marker);
    this.logger.log(`Marqueur modifiÃ© broadcast dans ${roomCode}: ${marker.label}`);
  }

}
