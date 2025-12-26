import { IsNotEmpty, IsOptional, IsString, IsNumber, Min } from 'class-validator';

export class PlaybackPlayDto {
  @IsString()
  @IsNotEmpty()
  codeRoom: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  positionSec?: number;   // current player time sent by frontend
}