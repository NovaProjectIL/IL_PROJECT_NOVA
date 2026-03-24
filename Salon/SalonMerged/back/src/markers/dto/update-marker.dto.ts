// dto/update-marker.dto.ts
import { IsString, IsEnum, IsOptional, MaxLength, IsNumber, Min } from 'class-validator';
import { MarkerCategory } from '../../entities/marker.entity';

export class UpdateMarkerDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  timeSec?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  label?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsEnum(MarkerCategory)
  category?: MarkerCategory;

  @IsNumber()
  memberId: number;
  
  
  @IsNumber()
  version: number;
}
