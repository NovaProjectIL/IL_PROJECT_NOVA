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
  namespace: '/sync',
  cors: { origin: '*', credentials: true },
})
// On active la validation automatique pour tous les messages arrivant ici.
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class RoomsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;
  
  private logger = new Logger('RoomsGateway');
  // On garde une liste des "chronomètres" de chargement pour chaque salon.
  private loadingTimers = new Map<string, NodeJS.Timeout>();
  // On attend maximum 8 secondes que les gens chargent la vidéo.
  private readonly LOADING_TIMEOUT_MS = 8000;

  constructor(
    private readonly roomsService: RoomsService,
    private readonly roomStateService: RoomStateService,
  ) {}

  handleConnection(client: Socket) {
    this.logger.log(`Nouvelle connexion : ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    // Si quelqu'un part, on le retire de la liste en mémoire.
    const roomCode = this.roomStateService.removeClient(client.id);
    if (roomCode) {
      this.logger.log(`L'utilisateur ${client.id} a quitté le salon ${roomCode}`);
      // On vérifie si son départ permet aux autres de reprendre la vidéo (s'il était le dernier à bloquer).
      this.checkAndResumeIfAllReady(roomCode);
    }
  }

  @SubscribeMessage('join-room')
  async handleJoinRoom(client: Socket, data: JoinRoomDto) {
    const { codeRoom, memberId } = data;
    const roomCode = codeRoom.toUpperCase();
    
    // On fait entrer l'utilisateur dans le canal socket du salon.
    client.join(roomCode);
    // On l'ajoute aussi dans notre gestionnaire de mémoire.
    this.roomStateService.addClient(roomCode, client.id, memberId);
    
    this.logger.log(`[JOIN] ${client.id} est entré dans ${roomCode}`);

    try {
      // On récupère l'état actuel du salon pour lui envoyer.
      const roomState = await this.roomsService.stateRoom(roomCode);
      // On calcule à quelle seconde il doit se caler pour être synchro.
      const currentPosition = this.roomStateService.getAdjustedTimestamp(roomCode) || roomState.playbackState?.positionSec || 0;
      
      // On lui envoie toutes les infos pour qu'il puisse afficher la vidéo.
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
      this.logger.error(`Erreur lors de l'entrée dans le salon :`, error);
    }

    return { success: true };
  }

  @UseGuards(WsRoomMemberGuard) // SEULS LES MEMBRES peuvent faire ça !
  @SubscribeMessage('loading-video')
  async handleLoadingVideo(client: Socket, data: BaseRoomDto) {
    const roomCode = data.codeRoom.toUpperCase();
    this.logger.log(`[LOAD] Le salon ${roomCode} attend un chargement...`);

    // On passe le salon en mode "Chargement" et on dit que ce client n'est pas prêt.
    this.roomStateService.updateStatus(roomCode, RoomGlobalStatus.LOADING);
    this.roomStateService.setClientReady(roomCode, client.id, false);
    
    // On lance le chrono des 8 secondes de sécurité.
    this.startLoadingTimeout(roomCode);

    // On dit à tout le monde de mettre pause en attendant.
    this.server.to(roomCode).emit('playback-updated', {
      action: 'pause',
      playback: { status: PlayStatus.PAUSED },
      loading: true,
      message: 'On attend que tout le monde ait chargé la vidéo...'
    });

    return { success: true };
  }

  @UseGuards(WsRoomMemberGuard)
  @SubscribeMessage('client-ready')
  async handleClientReady(client: Socket, data: BaseRoomDto) {
    const roomCode = data.codeRoom.toUpperCase();
    // Le client nous dit qu'il a fini de charger.
    this.roomStateService.setClientReady(roomCode, client.id, true);
    
    this.logger.log(`[READY] ${client.id} est prêt dans ${roomCode}`);

    // On vérifie si on peut relancer la vidéo pour tout le groupe.
    this.checkAndResumeIfAllReady(roomCode);
    
    return { success: true };
  }

  /**
   * Fonction interne : si tout le monde est prêt, on relance !
   */
  private async checkAndResumeIfAllReady(roomCode: string) {
    if (this.roomStateService.areAllClientsReady(roomCode)) {
      // Tout le monde est prêt ! On arrête le chrono de sécurité.
      this.clearLoadingTimeout(roomCode);
      this.logger.log(`[SYNC] Tout le monde est prêt dans ${roomCode}. On relance !`);

      const adjustedPos = this.roomStateService.getAdjustedTimestamp(roomCode);
      
      // On met à jour la BDD et la mémoire.
      await this.roomsService.play(roomCode, adjustedPos);
      this.roomStateService.updateStatus(roomCode, RoomGlobalStatus.PLAYING, adjustedPos);

      // On envoie le signal "PLAY" à tout le monde.
      this.server.to(roomCode).emit('playback-updated', {
        action: 'play',
        playback: {
          status: PlayStatus.PLAYING,
          positionSec: adjustedPos,
          serverTimeRef: new Date(),
        },
        loading: false,
        message: 'Tout le monde est prêt, bon visionnage !'
      });
    }
  }

  @UseGuards(WsRoomMemberGuard)
  @SubscribeMessage('play')
  async handlePlay(client: Socket, data: PlaybackControlDto) {
    const roomCode = data.codeRoom.toUpperCase();
    this.clearLoadingTimeout(roomCode); // Si quelqu'un appuie sur Play, on arrête d'attendre.
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
    this.logger.log(`[SEEK] Nouveau saut à ${data.positionSec}s dans le salon ${roomCode}`);

    try {
      // On prépare tout le monde pour le nouveau moment de la vidéo.
      this.roomStateService.prepareForSeek(roomCode, data.positionSec);
      await this.roomsService.seek(roomCode, data.positionSec);
      
      // On lance le chrono de sécurité car un saut demande souvent un re-chargement.
      this.startLoadingTimeout(roomCode);

      // On force la pause et on affiche le message de chargement.
      this.server.to(roomCode).emit('playback-updated', {
        action: 'seek',
        playback: { 
          positionSec: data.positionSec, 
          serverTimeRef: new Date(),
          status: PlayStatus.PAUSED
        },
        loading: true,
        message: 'Synchronisation en cours après le saut...'
      });

      return { success: true };
    } catch (error) {
      this.logger.error(`Erreur lors du saut temporel :`, error);
      return { success: false, error: 'Erreur interne.' };
    }
  }

  // --- GESTION DU CHRONO DE SÉCURITÉ ---

  private startLoadingTimeout(roomCode: string) {
    this.clearLoadingTimeout(roomCode);
    // On déclenche la reprise forcée dans 8 secondes.
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
    this.logger.warn(`[TIMEOUT] Trop d'attente pour ${roomCode}. On force la reprise !`);
    this.loadingTimers.delete(roomCode);

    const roomState = this.roomStateService.getOrCreateRoomState(roomCode);
    if (roomState.status === RoomGlobalStatus.LOADING) {
      const adjustedPos = this.roomStateService.getAdjustedTimestamp(roomCode);
      
      await this.roomsService.play(roomCode, adjustedPos);
      this.roomStateService.updateStatus(roomCode, RoomGlobalStatus.PLAYING, adjustedPos);

      // On force tout le monde à lire, même ceux qui n'ont pas fini de charger.
      this.server.to(roomCode).emit('playback-updated', {
        action: 'play',
        playback: {
          status: PlayStatus.PLAYING,
          positionSec: adjustedPos,
          serverTimeRef: new Date(),
        },
        loading: false,
        message: 'Délai d\'attente dépassé (certains rament). Reprise forcée !'
      });
    }
  }
}
