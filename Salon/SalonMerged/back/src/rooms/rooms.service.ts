import { Injectable, NotFoundException, ConflictException, ForbiddenException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Room } from '../entities/room.entity';
import { User } from '../entities/user.entity';
import { Playlist } from '../entities/playlist.entity';
import { PlaybackState, PlayStatus, PlaybackSourceType } from '../entities/playback-state.entity';
import { YouTubeVideo } from '../entities/youtube-video.entity';
import { PlaylistService } from '../playlist/playlist.service';
import { ChatSession } from '../entities/chat-session.entity';
import * as QRCode from 'qrcode';
import { PlaylistEntry } from '../entities/playlist-entry.entity';
import { Message } from '../entities/message.entity';

@Injectable()
export class RoomsService {
  private readonly logger = new Logger(RoomsService.name);

  constructor(
    @InjectRepository(Room)
    private readonly roomsRepo: Repository<Room>,

    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,

    @InjectRepository(Playlist)
    private readonly playlistsRepo: Repository<Playlist>,

    @InjectRepository(PlaybackState)
    private readonly playbackRepo: Repository<PlaybackState>,

    @InjectRepository(YouTubeVideo)
    private readonly youTubeVideoRepo: Repository<YouTubeVideo>,

    @InjectRepository(ChatSession)
    private readonly chatSessionRepo: Repository<ChatSession>,

    private readonly playlistService: PlaylistService,
  ) {}

  private generateCode(): string {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  private async generateUniqueDisplayNameInRoom(room: Room): Promise<string> {
    while (true) {
      const candidate = this.generateCode();

      const count = await this.usersRepo.count({
        where: { 
          room: { id: room.id }, 
          name: candidate 
        },
      });

      if (count === 0) return candidate;
    }
  }

  private async getOrCreatePlaybackState(room: Room) {
    let state = await this.playbackRepo.findOne({
      where: { room: { id: room.id } },
      relations: ['video'],
    });

    if (!state) {
      state = this.playbackRepo.create({
        room,
        status: PlayStatus.PAUSED,
        positionSec: 0,
        playbackRate: 1.0,
        serverTimeRef: null,
        video: null,
        sourceType: null,
      });
      state = await this.playbackRepo.save(state);
    }

    return state;
  }

  async createRoom(creatorDisplayName?: string) {
    this.logger.log(`Création d'une nouvelle salle pour: ${creatorDisplayName}`);
    
    const code = this.generateCode();
    const baseUrl = process.env.FRONTEND_BASE_URL ?? 'http://localhost:4200';
    const link = `${baseUrl}/rooms/join/${code}`;
    const QRCodeRoom = await QRCode.toDataURL(link);

    const room = this.roomsRepo.create({
      code,
      link,
      QRcode: QRCodeRoom,
    });
    await this.roomsRepo.save(room);

    // Create playlist
    const playlist = this.playlistsRepo.create({
      room,
      currentIndex: -1,
    });
    await this.playlistsRepo.save(playlist);

    // Create playback state
    const playback = this.playbackRepo.create({
      room,
      status: PlayStatus.PAUSED,
      positionSec: 0,
      playbackRate: 1.0,
    });
    await this.playbackRepo.save(playback);

    // Create chat session
    const chatSession = this.chatSessionRepo.create({
      room: room,
    });
    await this.chatSessionRepo.save(chatSession);

    // Create room creator
    let finalName = creatorDisplayName?.trim() ?? '';
    if (!finalName) {
      finalName = await this.generateUniqueDisplayNameInRoom(room);
    }

    const creator = this.usersRepo.create({
      room,
      name: finalName,
      role: 'CREATOR',
    });
    await this.usersRepo.save(creator);

    this.logger.log(` Salle créée: ${code} (ID: ${room.id})`);
    
    
    return {
      room,
      creator,
      chatSession,
      qrCode: QRCodeRoom,
      inviteLink: link,
    };
  }

  // MÉTHODE POUR METTRE À JOUR LE PSEUDO D'UN MEMBRE
  async updateMemberName(memberId: number, codeRoom: string, newName: string) {
    this.logger.log(`Mise à jour du pseudo du membre ${memberId} dans ${codeRoom} vers "${newName}"`);

    const room = await this.roomsRepo.findOne({
      where: { code: codeRoom },
      relations: ['users'],
    });

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    const user = room.users.find((m) => m.id === memberId);

    if (!user) {
      throw new NotFoundException('Member not found in this room');
    }

    // Vérifier si le nouveau nom est déjà pris
    const nameExists = room.users.some((m) => m.id !== memberId && m.name === newName.trim());
    if (nameExists) {
      throw new ConflictException('Display name already used in this room');
    }

    const oldName = user.name;
    user.name = newName.trim();

    await this.usersRepo.save(user);

    this.logger.log(`Pseudo mis à jour: ${oldName} -> ${user.name}`);

    return {
      memberId: user.id,
      oldName,
      newName: user.name,
      roomCode: room.code,
    };
  }

  async updateMemberRole(
    codeRoom: string,
    requesterId: number,
    targetMemberId: number,
    role: 'ANALYST' | 'OBSERVER',
  ) {
    this.logger.log(`Mise à jour du rôle ${role} pour ${targetMemberId} dans ${codeRoom}`);

    const room = await this.roomsRepo.findOne({
      where: { code: codeRoom },
      relations: ['users'],
    });

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    const requester = room.users.find((m) => m.id === requesterId);
    if (!requester) {
      throw new NotFoundException('Requester not found in this room');
    }

    if (requester.role !== 'CREATOR') {
      throw new ForbiddenException('Only the room creator can update roles');
    }

    const target = room.users.find((m) => m.id === targetMemberId);
    if (!target) {
      throw new NotFoundException('Target member not found in this room');
    }

    target.role = role;
    await this.usersRepo.save(target);

    this.logger.log(`Rôle mis à jour: ${target.name} -> ${role}`);

    return {
      roomCode: room.code,
      memberId: target.id,
      memberName: target.name,
      role: target.role,
    };
  }

  async joinRoom(memberDisplayName: string | undefined, codeRoom: string) {
    this.logger.log(`Tentative de rejoindre la salle: ${codeRoom}`);
    
    const room = await this.roomsRepo.findOne({ where: { code: codeRoom } });

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    let finalName = memberDisplayName?.trim() ?? '';
    if (!finalName) {
      finalName = await this.generateUniqueDisplayNameInRoom(room);
    }

    const count = await this.usersRepo.count({
      where: { 
        room: { id: room.id }, 
        name: finalName 
      },
    });

    if (count !== 0) throw new ConflictException('Display name already used in this room');

    const user = this.usersRepo.create({
      room,
      name: finalName,
      role: 'OBSERVER',
    });
    await this.usersRepo.save(user);

    this.logger.log(` ${finalName} a rejoint la salle ${codeRoom}`);
    
    return { room, user };
  }

  async inviteToRoom(codeRoom: string){
    const room = await this.roomsRepo.findOne({ where: { code: codeRoom } });

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    return { room };
  }

  async getRoomMembers(codeRoom: string) {
    const room = await this.roomsRepo.findOne({
      where: { code: codeRoom },
      relations: ['users'],
    });

    if (!room) throw new NotFoundException('Room not found');

    return room.users;
  }

  async stateRoom(codeRoom: string) {
    this.logger.log(`Chargement de l'état de la salle: ${codeRoom}`);
    
    const room = await this.roomsRepo.findOne({
      where: { code: codeRoom },
      relations: [
        'users',
        'playlist',
        'playlist.entries',
        'playlist.entries.video',
        'playlist.entries.addedBy',
        'playbackState',
        'playbackState.video',
        'chatSession',
        'chatSession.messages',
        'chatSession.messages.user',
      ],
    });

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    // Triez simplement
    const sortedEntries = [...(room.playlist?.entries ?? [])].sort((a, b) => a.position - b.position);
    const sortedMessages = [...(room.chatSession?.messages ?? [])].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
    );

    return {
      room,
      playlist: room.playlist,
      playbackState: room.playbackState,
      users: room.users ?? [],
      entries: sortedEntries,
      chatSession: room.chatSession,
      messages: sortedMessages,
    };
  }

  async leaveRoom(memberId: number, codeRoom: string) {
    this.logger.log(`Membre ${memberId} quitte la salle ${codeRoom}`);
    
    const room = await this.roomsRepo.findOne({ 
      where: { code: codeRoom },
      relations: ['users'],
    });

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    const user = room.users.find((m) => m.id === memberId);

    if (!user) {
      throw new NotFoundException('Member not found in this room');
    }

    if (user.role === 'CREATOR') {
      await this.roomsRepo.remove(room);
      this.logger.log(`Salle ${codeRoom} supprimÃ©e car le CREATOR a quittÃ©.`);
      return {
        roomDeleted: true,
        roomId: room.id,
        removedMemberId: user.id,
        removedMemberName: user.name,
      };
    }

    await this.usersRepo.remove(user);

    const remainingCount = await this.usersRepo.count({
      where: { room: { id: room.id } }
    });

    if (remainingCount === 0) {
      this.logger.log(` Suppression de la salle ${codeRoom} (plus de membres)`);
      await this.roomsRepo.remove(room);
      return {
        roomDeleted: true,
        roomId: room.id,
        removedMemberId: user.id,
        removedMemberName: user.name,
      };
    }

    room.lastActivityAt = new Date();
    await this.roomsRepo.save(room);

    this.logger.log(` ${user.name} a quitté la salle ${codeRoom}`);
    
    return {
      roomDeleted: false,
      roomId: room.id,
      removedMemberId: user.id,
      removedMemberName: user.name,
    };
  }

  async endRoom(memberId: number, codeRoom: string) {
    this.logger.log(`Tentative de suppression de la salle ${codeRoom} par le membre ${memberId}`);
    
    const room = await this.roomsRepo.findOne({ 
      where: { code: codeRoom },
      relations: ['users'],
    });

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    const user = room.users.find((m) => m.id === memberId);

    if (!user) {
      throw new NotFoundException('Member not found in this room');
    }

    if (user.role !== "CREATOR") {
      throw new ForbiddenException('Member not privileged to delete room, not CREATOR!');
    }

    // Cascade will remove all related entities
    await this.roomsRepo.remove(room);

    this.logger.log(` Salle ${codeRoom} supprimée par ${user.name}`);
    
    return {
      roomDeleted: true,
      roomId: room.id,
    };
  }

  async playDirectVideo(
    codeRoom: string,
    userId: number,
    youtubeId: string,
    title: string,
    channel: string,
    durationSec: number,
    thumbnailUrl: string,
  ) {
    this.logger.log(`Lecture directe de ${youtubeId} dans la salle ${codeRoom}`);
    
    const room = await this.roomsRepo.findOne({
      where: { code: codeRoom },
      relations: ['users'],
    });
    
    if (!room) throw new NotFoundException('Room not found');

    const user = room.users.find(u => u.id === userId);
    if (!user) throw new NotFoundException('User not in this room');

    let video = await this.youTubeVideoRepo.findOne({ where: { youtubeId } });
    if (!video) {
      video = this.youTubeVideoRepo.create({
        youtubeId,
        title,
        channelTitle: channel,
        durationSec,
        thumbnailUrl,
      });
      video = await this.youTubeVideoRepo.save(video);
    }

    const playback = await this.getOrCreatePlaybackState(room);
    playback.status = PlayStatus.PLAYING;
    playback.video = video;
    playback.sourceType = PlaybackSourceType.DIRECT;
    playback.positionSec = 0;
    playback.serverTimeRef = new Date();
    
    await this.playbackRepo.save(playback);

    this.logger.log(` Vidéo directe lancée: ${title}`);
    
    return { room, user, video, playback };
  }

  async play(codeRoom: string, positionSec?: number) {
    this.logger.log(` Lecture dans ${codeRoom} à ${positionSec || 0}s`);
    
    const room = await this.roomsRepo.findOne({
      where: { code: codeRoom },
      relations: ['playbackState', 'playbackState.video'],
    });

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    const playback = await this.getOrCreatePlaybackState(room);

    if (positionSec !== undefined) {
      playback.positionSec = positionSec;
    }

    playback.status = PlayStatus.PLAYING;
    playback.serverTimeRef = new Date();

    await this.playbackRepo.save(playback);

    return { room, playback };
  }

  async pause(codeRoom: string, positionSec?: number) {
    this.logger.log(` Pause dans ${codeRoom} à ${positionSec || 0}s`);
    
    const room = await this.roomsRepo.findOne({
      where: { code: codeRoom },
      relations: ['playbackState', 'playbackState.video'],
    });

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    const playback = await this.getOrCreatePlaybackState(room);

    if (positionSec !== undefined) {
      playback.positionSec = positionSec;
    }
    
    playback.status = PlayStatus.PAUSED;
    playback.serverTimeRef = new Date();
    
    await this.playbackRepo.save(playback);

    return { room, playback };
  }

  async seek(codeRoom: string, positionSec: number) {
    this.logger.log(` Seek dans ${codeRoom} à ${positionSec}s`);
    
    const room = await this.roomsRepo.findOne({
      where: { code: codeRoom },
      relations: ['playbackState', 'playbackState.video'],
    });

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    const playback = await this.getOrCreatePlaybackState(room);

    playback.positionSec = positionSec;
    playback.serverTimeRef = new Date();  
    
    await this.playbackRepo.save(playback);

    return { room, playback };
  }

  async handleVideoEnded(codeRoom: string) {
    this.logger.log(` Fin de vidéo détectée dans ${codeRoom}`);
    
    const room = await this.roomsRepo.findOne({
      where: { code: codeRoom },
      relations: [
        'playlist',
        'playbackState'
      ]
    });

    if (!room) throw new NotFoundException("Room not found");

    const playlist = room.playlist;
    const playback = room.playbackState;

    if (!playlist) throw new NotFoundException("Playlist not found");

    // Chargez les entries séparément
    const playlistWithEntries = await this.playlistsRepo.findOne({
      where: { id: playlist.id },
      relations: ['entries'],
    });
    
    const entries = (playlistWithEntries?.entries ?? []).sort((a,b) => a.position - b.position);

    // Si on était en vidéo directe
    if (playback.sourceType === PlaybackSourceType.DIRECT) {
      if (entries.length === 0) {
        // Pas de playlist -> arrêt complet
        playback.status = PlayStatus.ENDED;
        playback.video = null;
        playback.sourceType = null;
        playback.positionSec = 0;
        playback.serverTimeRef = null;
        await this.playbackRepo.save(playback);

        return { room, playlist, playback };
      }

      // Retour à l'entrée courante de la playlist
      await this.playlistService.setPlaybackFromPlaylist(room, playlist, true);

      return { room, playlist, playback: room.playbackState };
    }

    // La vidéo qui s'est terminée est déjà dans la playlist
    const currentIndex = playlist.currentIndex;

    if (currentIndex < 0 || currentIndex >= entries.length) {
      // Index invalide -> marqué comme terminé
      playback.status = PlayStatus.ENDED;
      playback.video = null;
      playback.sourceType = null;
      await this.playbackRepo.save(playback);
      return { room, playlist, playback };
    }

    const isLast = currentIndex === entries.length - 1;

    if (isLast) {
      // Dernière vidéo -> arrêt
      playback.status = PlayStatus.ENDED;
      playback.positionSec = 0;
      playback.video = null;
      playback.sourceType = PlaybackSourceType.PLAYLIST;
      await this.playbackRepo.save(playback);

      return { room, playlist, playback };
    }

    // Passe à la suivante
    playlist.currentIndex = currentIndex + 1;
    await this.playlistsRepo.save(playlist);

    await this.playlistService.setPlaybackFromPlaylist(room, playlist, true);

    return { room, playlist, playback: room.playbackState };
  }

  async getPlayback(codeRoom: string) {
    this.logger.log(`Récupération du playback pour ${codeRoom}`);
    
    const room = await this.roomsRepo.findOne({
      where: { code: codeRoom },
      relations: [
        'playlist',
        'playbackState',
        'playbackState.video',
      ],
    });

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    let entries: PlaylistEntry[] = [];
    if (room.playlist) {
      const playlistWithEntries = await this.playlistsRepo.findOne({
        where: { id: room.playlist.id },
        relations: ['entries', 'entries.video', 'entries.addedBy'],
      });
      if (playlistWithEntries) {
        entries = playlistWithEntries.entries ?? [];
      }
    }

    const sortedEntries = [...entries].sort((a, b) => a.position - b.position);

    let currentEntry: PlaylistEntry | null = null;
    if (room.playlist && room.playlist.currentIndex >= 0 && room.playlist.currentIndex < sortedEntries.length) {
      currentEntry = sortedEntries[room.playlist.currentIndex];
    }

    return {
      room,
      playlist: room.playlist,
      playback: room.playbackState,
      currentEntry,
      totalEntries: sortedEntries.length,
    };
  }

  async getRoomByCode(codeRoom: string) {
    const room = await this.roomsRepo.findOne({
      where: { code: codeRoom },
      relations: ['playbackState', 'playbackState.video'],
    });
    
    if (!room) {
      throw new NotFoundException('Room not found');
    }
    
    return room;
  }

  // MÉTHODE POUR RÉCUPÉRER L'ÉTAT DE PLAYBACK (pour WebSocket)
  async getPlaybackState(roomId: number) {
    this.logger.log(`Récupération état playback pour room ${roomId}`);
    
    const playbackState = await this.playbackRepo.findOne({
      where: { room: { id: roomId } },
      relations: ['video'],
    });
    
    if (!playbackState) {
      throw new NotFoundException('Playback state not found');
    }
    
    // Retourner un objet formaté pour le WebSocket
    return {
      id: playbackState.id,
      status: playbackState.status,
      positionSec: playbackState.positionSec,
      playbackRate: playbackState.playbackRate,
      serverTimeRef: playbackState.serverTimeRef,
      sourceType: playbackState.sourceType,
      video: playbackState.video ? {
        youtubeId: playbackState.video.youtubeId,
        title: playbackState.video.title,
        channelTitle: playbackState.video.channelTitle,
        durationSec: playbackState.video.durationSec,
        thumbnailUrl: playbackState.video.thumbnailUrl,
      } : null,
    };
  }

  // MÉTHODE POUR METTRE À JOUR L'ÉTAT DE PLAYBACK
  async updatePlaybackState(
    roomId: number, 
    updateData: { 
      status?: PlayStatus; 
      positionSec?: number; 
      serverTimeRef?: Date;
    }
  ) {
    const playbackState = await this.playbackRepo.findOne({
      where: { room: { id: roomId } },
    });
    
    if (!playbackState) {
      throw new NotFoundException('Playback state not found');
    }
    
    if (updateData.status !== undefined) {
      playbackState.status = updateData.status;
    }
    
    if (updateData.positionSec !== undefined) {
      playbackState.positionSec = updateData.positionSec;
    }
    
    if (updateData.serverTimeRef !== undefined) {
      playbackState.serverTimeRef = updateData.serverTimeRef;
    }
    
    const saved = await this.playbackRepo.save(playbackState);
    this.logger.log(`Playback state mis à jour pour room ${roomId}:`, {
      status: saved.status,
      position: saved.positionSec,
    });
    
    return saved;
  }

  // MÉTHODE POUR RÉCUPÉRER UNE ROOM PAR ID (pour WebSocket)
  async getRoomById(roomId: number) {
    const room = await this.roomsRepo.findOne({
      where: { id: roomId },
      relations: ['users'],
    });
    
    if (!room) {
      throw new NotFoundException('Room not found');
    }
    
    return room;
  }

  // MÉTHODE POUR METTRE À JOUR L'ACTIVITÉ DE LA ROOM
  async updateRoomActivity(roomId: number) {
    await this.roomsRepo.update(roomId, {
      lastActivityAt: new Date(),
    });
  }

  async removeUserFromRoom(memberId: number, codeRoom: string) {
    this.logger.log(`Suppression du membre ${memberId} de la salle ${codeRoom}`);
    
    const room = await this.roomsRepo.findOne({
      where: { code: codeRoom },
      relations: ['users'],
    });

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    const user = room.users.find((m) => m.id === memberId);

    if (!user) {
      throw new NotFoundException('Member not found in this room');
    }

    // Supprimer physiquement l'utilisateur de la base de données
    await this.usersRepo.remove(user);
    
    // Vérifier s'il reste des membres
    const remainingCount = await this.usersRepo.count({
      where: { room: { id: room.id } }
    });

    if (remainingCount === 0) {
      this.logger.log(`Suppression de la salle ${codeRoom} (plus de membres)`);
      await this.roomsRepo.remove(room);
      return {
        roomDeleted: true,
        roomId: room.id,
        removedMemberId: user.id,
        removedMemberName: user.name,
      };
    }

    room.lastActivityAt = new Date();
    await this.roomsRepo.save(room);

    return {
      roomDeleted: false,
      roomId: room.id,
      removedMemberId: user.id,
      removedMemberName: user.name,
    };
  }
  
}
