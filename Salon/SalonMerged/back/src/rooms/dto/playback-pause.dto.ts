import { IsNotEmpty, IsOptional, IsString, IsNumber, Min } from 'class-validator';

export class PlaybackPauseDto {
  @IsString()
  @IsNotEmpty()
  codeRoom: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  positionSec?: number;   // where the video was paused
}