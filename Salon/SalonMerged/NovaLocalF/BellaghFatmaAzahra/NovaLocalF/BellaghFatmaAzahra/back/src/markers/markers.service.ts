// markers.service.ts
import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, OptimisticLockVersionMismatchError } from 'typeorm';
import { Marker } from '../entities/marker.entity';
import { CreateMarkerDto } from './dto/create-marker.dto';
import { UpdateMarkerDto } from './dto/update-marker.dto';

@Injectable()
export class MarkersService {
  constructor(
    @InjectRepository(Marker)
    private markersRepository: Repository<Marker>,
  ) {}

  // Récupérer tous les marqueurs d'une room
  async findByRoom(roomId: number): Promise<Marker[]> {
    return this.markersRepository.find({
      where: { room: { id: roomId } },
      relations: ['createdBy', 'video'],
      order: { timeSec: 'ASC' },
    });
  }

  // Créer un marqueur
  async create(roomId: number, dto: CreateMarkerDto): Promise<Marker> {
    const marker = this.markersRepository.create({
      timeSec: dto.timeSec,
      label: dto.label,
      content: dto.content ?? null,
      category: dto.category,
      room: { id: roomId },
      createdBy: { id: dto.createdById },
      video: { youtubeId: dto.videoId },
    });

    return this.markersRepository.save(marker);
  }

  // Modifier un marqueur (avec gestion des conflits)
 async update(markerId: number, dto: UpdateMarkerDto): Promise<Marker> {
  const marker = await this.markersRepository.findOne({
    where: { id: markerId },
  });

  if (!marker) throw new NotFoundException(`Marqueur ${markerId} introuvable`);

  
  if (marker.version !== dto.version) {
    throw new ConflictException(
      'Ce marqueur a été modifié par un autre utilisateur. Rechargez et réessayez.'
    );
  }

  if (dto.timeSec !== undefined) marker.timeSec = dto.timeSec;
  if (dto.label !== undefined) marker.label = dto.label;
  if (dto.content !== undefined) marker.content = dto.content;
  if (dto.category !== undefined) marker.category = dto.category;

  return await this.markersRepository.save(marker);
}

  // Supprimer un marqueur
  async remove(markerId: number): Promise<void> {
    const result = await this.markersRepository.delete(markerId);
    if (result.affected === 0) {
      throw new NotFoundException(`Marqueur ${markerId} introuvable`);
    }
  }
}