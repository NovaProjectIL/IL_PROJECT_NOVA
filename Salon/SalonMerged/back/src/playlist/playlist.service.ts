import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Room } from '../entities/room.entity';
import { User } from '../entities/user.entity';
import { Playlist } from '../entities/playlist.entity';
import { PlaylistEntry } from '../entities/playlist-entry.entity';
import { PlaybackState, PlayStatus, PlaybackSourceType } from '../entities/playback-state.entity';
import { YouTubeVideo } from '../entities/youtube-video.entity';

@Injectable()
export class PlaylistService {
  constructor(
    @InjectRepository(Room)
    private readonly roomsRepo: Repository<Room>,

    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,

    @InjectRepository(Playlist)
    private readonly playlistsRepo: Repository<Playlist>,

    @InjectRepository(PlaybackState)
    private readonly playbackRepo: Repository<PlaybackState>,

    @InjectRepository(PlaylistEntry)
    private readonly playlistEntryRepo: Repository<PlaylistEntry>,

    @InjectRepository(YouTubeVideo)
    private readonly youTubeVideoRepo: Repository<YouTubeVideo>,
  ) {}

  /**
   * Récupère ou crée un état de lecture pour une salle
   * @param room La salle
   * @returns L'état de lecture existant ou nouvellement créé
   */
  private async getOrCreatePlaybackState(room: Room): Promise<PlaybackState> {
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

  /**
   * Met à jour l'état de lecture à partir de la playlist
   * @param room La salle
   * @param playlist La playlist
   * @param force Forcer la mise à jour même si une vidéo directe est en cours
   * @returns L'état de lecture mis à jour
   */
  async setPlaybackFromPlaylist(
    room: Room,
    playlist: Playlist,
    force = false,
  ): Promise<PlaybackState> {
    const playback = await this.getOrCreatePlaybackState(room);

    // Si une vidéo directe est en cours et qu'on ne force pas, on ne change pas
    if (!force && playback.sourceType === PlaybackSourceType.DIRECT) {
      return playback;
    }

    const entries = (playlist.entries ?? []).sort((a, b) => a.position - b.position);

    // Si l'index est invalide ou la playlist vide, on met en pause
    if (playlist.currentIndex < 0 || playlist.currentIndex >= entries.length) {
      playback.status = PlayStatus.PAUSED;
      playback.video = null;
      playback.sourceType = null;
      playback.positionSec = 0;
      playback.serverTimeRef = null;
      return this.playbackRepo.save(playback);
    }

    // Récupère l'entrée courante
    const currentEntry = entries[playlist.currentIndex];

    // Met à jour l'état de lecture
    playback.status = PlayStatus.PLAYING;
    playback.video = currentEntry.video;
    playback.sourceType = PlaybackSourceType.PLAYLIST;
    playback.positionSec = 0;
    playback.serverTimeRef = new Date();

    return this.playbackRepo.save(playback);
  }

  /**
   * Récupère la playlist d'une salle
   * @param codeRoom Code de la salle
   * @returns La salle, la playlist et ses entrées triées
   */
  async getPlaylist(codeRoom: string) {
    const room = await this.roomsRepo.findOne({ 
      where: { code: codeRoom },
      relations: [
        'playlist',
        'playlist.entries',
        'playlist.entries.video',
        'playlist.entries.addedBy',
      ],
    });

    if (!room) {
      throw new NotFoundException('Salle non trouvée');
    }

    let playlist = room.playlist;

    // Crée une playlist si elle n'existe pas
    if (!playlist) {
      playlist = this.playlistsRepo.create({
        room,
        currentIndex: -1,
      });
      playlist = await this.playlistsRepo.save(playlist);
    }

    const entries = playlist.entries ? [...playlist.entries] : [];
    entries.sort((a, b) => a.position - b.position);

    return {
      room,
      playlist,
      entries,
    };
  }

  /**
   * Ajoute une vidéo à la playlist
   */
  async addPlaylist(
    codeRoom: string,
    memberId: number,
    youtubeId: string,
    youtubeVTitle: string,
    youtubeVChannel: string,
    youtubeVDurationSec: number,
    youtubeVThumbnailUrl: string,
  ) {
    const room = await this.roomsRepo.findOne({ 
      where: { code: codeRoom },
      relations: [
        'playlist',
        'playlist.entries',
        'users',
        'playlist.entries.video',
        'playlist.entries.addedBy'
      ],
    });

    if (!room) {
      throw new NotFoundException('Salle non trouvée');
    }

    const member = room.users.find((m) => m.id === memberId);
    if (!member) {
      throw new NotFoundException('Membre non trouvé dans cette salle');
    }

    let playlist = room.playlist;
    if (!playlist) {
      playlist = this.playlistsRepo.create({
        room,
        currentIndex: -1,
      });
      playlist = await this.playlistsRepo.save(playlist);
    }

    // Calcule la prochaine position
    const existingEntries = playlist.entries ?? [];
    const currentPositions = existingEntries.length > 0 ? existingEntries.map((e) => e.position) : [];
    const nextPosition = currentPositions.length > 0 ? Math.max(...currentPositions) + 1 : 0;

    // Cherche ou crée la vidéo YouTube
    let video = await this.youTubeVideoRepo.findOne({
      where: { youtubeId },
    });

    if (!video) {
      video = this.youTubeVideoRepo.create({
        youtubeId,
        title: youtubeVTitle,
        channelTitle: youtubeVChannel,
        durationSec: youtubeVDurationSec,
        thumbnailUrl: youtubeVThumbnailUrl,
      });
      video = await this.youTubeVideoRepo.save(video);
    }

    // Crée l'entrée de playlist
    const playlistEntry = this.playlistEntryRepo.create({
      playlist,
      video,
      addedBy: member,
      position: nextPosition,
    });

    await this.playlistEntryRepo.save(playlistEntry);

    // Récupère toutes les entrées triées
    const entries = await this.playlistEntryRepo.find({
      where: { playlist: { id: playlist.id } },
      relations: ['video', 'addedBy'],
      order: { position: 'ASC' },
    });

    // Si c'est la première vidéo, la met en cours
    if (playlist.currentIndex === -1 && entries.length > 0) {
      await this.playlistsRepo.update(playlist.id, { currentIndex: 0 });
      playlist.currentIndex = 0;
    }

    // Met à jour l'état de lecture
    await this.setPlaybackFromPlaylist(room, playlist, false);

    return {
      room,
      playlist,
      entries,
    };
  }

  /**
   * Supprime une vidéo de la playlist
   */
  async deletePlaylist(
    codeRoom: string,
    memberId: number,
    entryId: number,
  ) {
    const room = await this.roomsRepo.findOne({
      where: { code: codeRoom },
      relations: ['playlist', 'playlist.entries', 'users'],
    });

    if (!room) throw new NotFoundException('Salle non trouvée');
    const member = room.users.find((m) => m.id === memberId);
    if (!member) throw new NotFoundException('Membre non trouvé dans cette salle');

    const playlist = room.playlist;
    if (!playlist) throw new NotFoundException('Playlist non trouvée pour cette salle');

    const oldEntries = playlist.entries ?? [];
    const entry = oldEntries.find((e) => e.id === entryId);
    if (!entry) throw new NotFoundException('Entrée non trouvée dans cette playlist');

    const deletedPos = entry.position;
    let currentIndex = playlist.currentIndex;

    // Supprime l'entrée
    await this.playlistEntryRepo.remove(entry);

    // Récupère les entrées restantes
    let entries = await this.playlistEntryRepo.find({
      where: { playlist: { id: playlist.id } },
      relations: ['video', 'addedBy'],
      order: { position: 'ASC' },
    });

    // Si plus d'entrées, réinitialise l'index
    if (entries.length === 0) {
      currentIndex = -1;
      await this.playlistsRepo.update(playlist.id, { currentIndex });
      playlist.currentIndex = currentIndex;
      throw new ConflictException('Playlist vide : plus de vidéos à jouer');
    }

    // Réindexe les positions
    for (let i = 0; i < entries.length; i++) {
      if (entries[i].position !== i) {
        entries[i].position = i;
        await this.playlistEntryRepo.save(entries[i]);
      }
    }

    // Ajuste l'index courant si nécessaire
    if (currentIndex !== -1) {
      if (deletedPos < currentIndex) {
        currentIndex--;
      } else if (deletedPos === currentIndex) {
        const lastIndex = entries.length - 1;
        if (currentIndex > lastIndex) currentIndex = lastIndex;
      }
    }

    // Met à jour l'index dans la playlist
    if (currentIndex !== playlist.currentIndex) {
      await this.playlistsRepo.update(playlist.id, { currentIndex });
      playlist.currentIndex = currentIndex;
    }

    return {
      room,
      playlist,
      entries,
    };
  }

  /**
   * Change l'index courant de la playlist
   */
  async changeCurrentIndex(
    codeRoom: string,
    memberId: number,
    newIndex: number,
  ) {
    const room = await this.roomsRepo.findOne({
      where: { code: codeRoom },
      relations: [
        'playlist', 
        'playlist.entries', 
        'users', 
        'playlist.entries.video', 
        'playlist.entries.addedBy',
      ],
    });

    if (!room) throw new NotFoundException('Salle non trouvée');
    const member = room.users.find((m) => m.id === memberId);
    if (!member) throw new NotFoundException('Membre non trouvé dans cette salle');

    const playlist = room.playlist;
    if (!playlist) throw new NotFoundException('Playlist non trouvée pour cette salle');

    const entries = (playlist.entries ?? []).sort((a, b) => a.position - b.position);
    if (entries.length === 0) throw new NotFoundException('Aucune entrée dans la playlist');
    if (newIndex < 0 || newIndex >= entries.length) throw new NotFoundException('Index invalide');

    // Met à jour seulement si l'index a changé
    if (newIndex !== playlist.currentIndex) {
      await this.playlistsRepo.update(playlist.id, { currentIndex: newIndex });
      playlist.currentIndex = newIndex;
    }

    // Met à jour l'état de lecture
    await this.setPlaybackFromPlaylist(room, playlist, true);

    return { room, playlist, entries };
  }

  /**
   * Déplace une entrée dans la playlist
   */
  async reorderEntry(
    codeRoom: string,
    memberId: number,
    entryId: number,
    oldPosition: number,
    newPosition: number,
  ) {
    const room = await this.roomsRepo.findOne({
      where: { code: codeRoom },
      relations: [
        'playlist',
        'playlist.entries',
        'playlist.entries.video',
        'playlist.entries.addedBy',
        'users',
      ],
    });

    if (!room) throw new NotFoundException('Salle non trouvée');
    const member = room.users.find((m) => m.id === memberId);
    if (!member) throw new NotFoundException('Membre non trouvé dans cette salle');

    const playlist = room.playlist;
    if (!playlist) throw new NotFoundException('Playlist non trouvée pour cette salle');

    let entries = (playlist.entries ?? []).sort((a, b) => a.position - b.position);
    if (entries.length === 0) throw new NotFoundException('Aucune entrée dans la playlist');

    const entryIndex = entries.findIndex((e) => e.id === entryId);
    if (entryIndex === -1) throw new NotFoundException('Entrée non trouvée dans cette playlist');

    const entry = entries[entryIndex];
    if (entry.position !== oldPosition) {
      throw new ConflictException('L\'ancienne position ne correspond pas à la position actuelle de l\'entrée');
    }

    // Limite la nouvelle position
    const maxIndex = entries.length - 1;
    let targetIndex = newPosition;
    if (targetIndex < 0) targetIndex = 0;
    if (targetIndex > maxIndex) targetIndex = maxIndex;

    // Garde en mémoire la vidéo en cours
    const currentIndexBefore = playlist.currentIndex;
    const currentEntryId = currentIndexBefore >= 0 && currentIndexBefore < entries.length
      ? entries[currentIndexBefore].id
      : null;

    // Réorganise les entrées
    entries.splice(entryIndex, 1);
    entries.splice(targetIndex, 0, entry);

    // Réindexe toutes les positions
    for (let i = 0; i < entries.length; i++) {
      if (entries[i].position !== i) {
        entries[i].position = i;
        await this.playlistEntryRepo.save(entries[i]);
      }
    }

    // Met à jour l'index courant pour garder la même vidéo
    let newCurrentIndex = -1;
    if (currentEntryId !== null) {
      const idx = entries.findIndex((e) => e.id === currentEntryId);
      if (idx !== -1) {
        newCurrentIndex = idx;
      }
    }

    if (newCurrentIndex !== playlist.currentIndex) {
      playlist.currentIndex = newCurrentIndex;
      await this.playlistsRepo.save(playlist);
    }

    // Met à jour l'état de lecture
    await this.setPlaybackFromPlaylist(room, playlist, false);

    return {
      room,
      playlist,
      entries,
    };
  }

  /**
   * Passe à la vidéo suivante dans la playlist
   * @param codeRoom Code de la salle
   * @returns La salle, la playlist et les entrées
   */
  async goToNextEntry(codeRoom: string) {
    const room = await this.roomsRepo.findOne({
      where: { code: codeRoom },
      relations: [
        'playlist',
        'playlist.entries',
        'playlist.entries.video',
        'playlist.entries.addedBy',
      ],
    });

    if (!room) throw new NotFoundException('Salle non trouvée');
    
    const playlist = room.playlist;
    if (!playlist) throw new NotFoundException('Playlist non trouvée pour cette salle');

    // ✅ CORRECTION: Trier les entrées AVANT de vérifier
    const entries = (playlist.entries ?? []).sort((a, b) => a.position - b.position);
    if (entries.length === 0) throw new NotFoundException('Aucune entrée dans la playlist');

    console.log('📊 goToNext - État:', {
      currentIndex: playlist.currentIndex,
      totalEntries: entries.length,
      canGoNext: playlist.currentIndex < entries.length - 1
    });

    // Vérifie si déjà à la dernière vidéo
    if (playlist.currentIndex >= entries.length - 1) {
      throw new ConflictException('Déjà à la dernière vidéo');
    }

    const newIndex = playlist.currentIndex + 1;
    await this.playlistsRepo.update(playlist.id, { currentIndex: newIndex });
    playlist.currentIndex = newIndex;

    console.log('✅ goToNext - Nouvel index:', newIndex);

    // Met à jour l'état de lecture avec les entrées triées
    playlist.entries = entries; // Important: assigner les entrées triées
    await this.setPlaybackFromPlaylist(room, playlist, true);

    return { room, playlist, entries };
  }

  /**
   * Revient à la vidéo précédente dans la playlist
   * @param codeRoom Code de la salle
   * @returns La salle, la playlist et les entrées
   */
  async goToPreviousEntry(codeRoom: string) {
    const room = await this.roomsRepo.findOne({
      where: { code: codeRoom },
      relations: [
        'playlist',
        'playlist.entries',
        'playlist.entries.video',
        'playlist.entries.addedBy',
      ],
    });

    if (!room) throw new NotFoundException('Salle non trouvée');
    
    const playlist = room.playlist;
    if (!playlist) throw new NotFoundException('Playlist non trouvée pour cette salle');

    // ✅ CORRECTION: Trier les entrées AVANT de vérifier
    const entries = (playlist.entries ?? []).sort((a, b) => a.position - b.position);
    if (entries.length === 0) throw new NotFoundException('Aucune entrée dans la playlist');

    console.log('📊 goToPrevious - État:', {
      currentIndex: playlist.currentIndex,
      totalEntries: entries.length,
      canGoPrevious: playlist.currentIndex > 0
    });

    if (playlist.currentIndex === -1) throw new ConflictException('Aucune vidéo en cours');
    if (playlist.currentIndex === 0) throw new ConflictException('Déjà à la première vidéo');

    const newIndex = playlist.currentIndex - 1;
    await this.playlistsRepo.update(playlist.id, { currentIndex: newIndex });
    playlist.currentIndex = newIndex;

    console.log('✅ goToPrevious - Nouvel index:', newIndex);

    // Met à jour l'état de lecture avec les entrées triées
    playlist.entries = entries; // Important: assigner les entrées triées
    await this.setPlaybackFromPlaylist(room, playlist, true);

    return { room, playlist, entries };
  }
}