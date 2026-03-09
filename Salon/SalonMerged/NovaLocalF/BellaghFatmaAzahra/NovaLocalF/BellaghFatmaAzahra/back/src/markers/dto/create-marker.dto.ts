// dto/create-marker.dto.ts
import { IsNumber, IsString, IsEnum, IsOptional, MaxLength, Min } from 'class-validator';
import { MarkerCategory } from '../../entities/marker.entity';

export class CreateMarkerDto {
  @IsNumber()
  @Min(0)
  timeSec: number;           // Position dans la vidéo

  @IsString()
  @MaxLength(100)
  label: string;             // Titre du marqueur

  @IsOptional()
  @IsString()
  content?: string;          // Description optionnelle

  @IsOptional()
  @IsEnum(MarkerCategory)
  category?: MarkerCategory; // Défaut géré par l'entité

  @IsString()
  videoId: string;           // youtubeId de la vidéo

  @IsNumber()
  createdById: number;       // id de l'utilisateur
}