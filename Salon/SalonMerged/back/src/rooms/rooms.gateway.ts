import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { UseGuards, UsePipes, ValidationPipe, Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { RoomsService } from './rooms.service';
import { RoomStateService, RoomGlobalStatus } from './room-state.service';
import { PlayStatus } from '../entities/playback-state.entity';
import { WsRoomMemberGuard } from './guards/ws-room-member.guard';
import { 
  JoinRoomDto, 
  PlaybackControlDto, 
  SeekDto, 
  BaseRoomDto 
} from './dto/ws-events.dto';

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
})
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class RoomsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;
  
  private logger = new Logger('RoomsGateway');
  private loadingTimers = new Map<string, NodeJS.Timeout>();
  private readonly LOADING_TIMEOUT_MS = 8000;

  constructor(
    private readonly roomsService: RoomsService,
    private readonly roomStateService: RoomStateService,
  ) {}

  handleConnection(client: Socket) {
    this.logger.log(`Client connecté: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    const roomCode = this.roomStateService.removeClient(client.id);
    if (roomCode) {
      this.logger.log(`Client ${client.id} déconnecté de la room ${roomCode}`);
      this.checkAndResumeIfAllReady(roomCode);
    }
  }

  @SubscribeMessage('join-room')
  async handleJoinRoom(client: Socket, data: JoinRoomDto) {
    const { codeRoom, memberId } = data;
    const roomCode = codeRoom.toUpperCase();
    
    client.join(roomCode);
    this.roomStateService.addClient(roomCode, client.id, memberId);
    
    this.logger.log(`${client.id} (membre ${memberId}) rejoint room: ${roomCode}`);

    try {
      const roomState = await this.roomsService.stateRoom(roomCode);
      const currentPosition = this.roomStateService.getAdjustedTimestamp(roomCode) || roomState.playbackState?.positionSec || 0;
      
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
        playlist: roomState.playlist ? {
          currentIndex: roomState.playlist.currentIndex,
          entries: roomState.entries?.map(entry => ({
            id: entry.id,
            video: entry.video,
          })) || [],
        } : null,
        users: roomState.users?.map(user => ({ id: user.id, name: user.name })) || [],
      });
    } catch (error) {
      this.logger.error(`Erreur join-room:`, error);
    }

    return { success: true };
  }

  @UseGuards(WsRoomMemberGuard)
  @SubscribeMessage('loading-video')
  async handleLoadingVideo(client: Socket, data: BaseRoomDto) {
    const roomCode = data.codeRoom.toUpperCase();
    this.logger.log(`Room ${roomCode} entre en phase de CHARGEMENT (via ${client.id})`);

    this.roomStateService.updateStatus(roomCode, RoomGlobalStatus.LOADING);
    this.roomStateService.setClientReady(roomCode, client.id, false);
    
    this.startLoadingTimeout(roomCode);

    this.server.to(roomCode).emit('playback-updated', {
      action: 'pause',
      playback: { status: PlayStatus.PAUSED },
      loading: true,
      message: 'Attente des autres participants...'
    });

    return { success: true };
  }

  @UseGuards(WsRoomMemberGuard)
  @SubscribeMessage('client-ready')
  async handleClientReady(client: Socket, data: BaseRoomDto) {
    const roomCode = data.codeRoom.toUpperCase();
    this.roomStateService.setClientReady(roomCode, client.id, true);
    
    this.logger.log(`Client ${client.id} est PRÊT dans ${roomCode}`);

    this.checkAndResumeIfAllReady(roomCode);
    
    return { success: true };
  }

  private async checkAndResumeIfAllReady(roomCode: string) {
    if (this.roomStateService.areAllClientsReady(roomCode)) {
      this.clearLoadingTimeout(roomCode);
      this.logger.log(`TOUS les clients sont prêts dans ${roomCode}. Reprise de la lecture.`);

      const adjustedPos = this.roomStateService.getAdjustedTimestamp(roomCode);
      
      await this.roomsService.play(roomCode, adjustedPos);
      this.roomStateService.updateStatus(roomCode, RoomGlobalStatus.PLAYING, adjustedPos);

      this.server.to(roomCode).emit('playback-updated', {
        action: 'play',
        playback: {
          status: PlayStatus.PLAYING,
          positionSec: adjustedPos,
          serverTimeRef: new Date(),
        },
        loading: false,
        message: 'Tout le monde est prêt !'
      });
    }
  }

  @UseGuards(WsRoomMemberGuard)
  @SubscribeMessage('play')
  async handlePlay(client: Socket, data: PlaybackControlDto) {
    const roomCode = data.codeRoom.toUpperCase();
    this.clearLoadingTimeout(roomCode);
    const pos = data.positionSec || this.roomStateService.getAdjustedTimestamp(roomCode);
    
    await this.roomsService.play(roomCode, pos);
    this.roomStateService.updateStatus(roomCode, RoomGlobalStatus.PLAYING, pos);

    this.server.to(roomCode).emit('playback-updated', {
      action: 'play',
      playback: { status: PlayStatus.PLAYING, positionSec: pos, serverTimeRef: new Date() },
    });
  }

  @UseGuards(WsRoomMemberGuard)
  @SubscribeMessage('pause')
  async handlePause(client: Socket, data: PlaybackControlDto) {
    const roomCode = data.codeRoom.toUpperCase();
    this.clearLoadingTimeout(roomCode);
    const pos = data.positionSec || this.roomStateService.getAdjustedTimestamp(roomCode);
    
    await this.roomsService.pause(roomCode, pos);
    this.roomStateService.updateStatus(roomCode, RoomGlobalStatus.PAUSED, pos);

    this.server.to(roomCode).emit('playback-updated', {
      action: 'pause',
      playback: { status: PlayStatus.PAUSED, positionSec: pos },
    });
  }

  @UseGuards(WsRoomMemberGuard)
  @SubscribeMessage('seek')
  async handleSeek(client: Socket, data: SeekDto) {
    const roomCode = data.codeRoom.toUpperCase();
    this.logger.log(`Seek validé dans ${roomCode} à ${data.positionSec}s. Réinitialisation des états.`);

    try {
      this.roomStateService.prepareForSeek(roomCode, data.positionSec);
      await this.roomsService.seek(roomCode, data.positionSec);
      
      this.startLoadingTimeout(roomCode);

      this.server.to(roomCode).emit('playback-updated', {
        action: 'seek',
        playback: { 
          positionSec: data.positionSec, 
          serverTimeRef: new Date(),
          status: PlayStatus.PAUSED
        },
        loading: true,
        message: 'Saut temporel... Synchronisation en cours.'
      });

      return { success: true };
    } catch (error) {
      this.logger.error(`Erreur lors du seek dans ${roomCode}:`, error);
      return { success: false, error: 'Erreur interne lors du saut temporel' };
    }
  }

  private startLoadingTimeout(roomCode: string) {
    this.clearLoadingTimeout(roomCode);

    const timer = setTimeout(() => {
      this.handleLoadingTimeout(roomCode);
    }, this.LOADING_TIMEOUT_MS);

    this.loadingTimers.set(roomCode, timer);
  }

  private clearLoadingTimeout(roomCode: string) {
    if (this.loadingTimers.has(roomCode)) {
      clearTimeout(this.loadingTimers.get(roomCode));
      this.loadingTimers.delete(roomCode);
    }
  }

  private async handleLoadingTimeout(roomCode: string) {
    this.logger.warn(`TIMEOUT de chargement dans ${roomCode} (8s écoulées). Abandon de l'attente.`);
    this.loadingTimers.delete(roomCode);

    const roomState = this.roomStateService.getOrCreateRoomState(roomCode);
    if (roomState.status === RoomGlobalStatus.LOADING) {
      const adjustedPos = this.roomStateService.getAdjustedTimestamp(roomCode);
      
      await this.roomsService.play(roomCode, adjustedPos);
      this.roomStateService.updateStatus(roomCode, RoomGlobalStatus.PLAYING, adjustedPos);

      this.server.to(roomCode).emit('playback-updated', {
        action: 'play',
        playback: {
          status: PlayStatus.PLAYING,
          positionSec: adjustedPos,
          serverTimeRef: new Date(),
        },
        loading: false,
        message: 'Délai d\'attente dépassé. Reprise forcée.'
      });
    }
  }
}