import { IsNotEmpty, IsString, IsNumber, Min } from 'class-validator';

export class PlaybackSeekDto {
  @IsString()
  @IsNotEmpty()
  codeRoom: string;

  @IsNumber()
  @Min(0)
  positionSec: number;    // new target time
}