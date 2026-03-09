import { IsString, IsNotEmpty, IsNumber, IsOptional, Min } from 'class-validator';

/**
 * La base de tous les messages : il faut au moins le code du salon.
 */
export class BaseRoomDto {
  @IsString()
  @IsNotEmpty({ message: 'Le code du salon est obligatoire.' })
  codeRoom: string;
}

/**
 * Pour les actions Play et Pause.
 */
export class PlaybackControlDto extends BaseRoomDto {
  @IsOptional()
  @IsNumber({}, { message: 'La seconde doit être un nombre.' })
  @Min(0, { message: 'On ne peut pas aller avant le début de la vidéo.' })
  positionSec?: number;
}

/**
 * Pour les sauts dans le temps (Seek).
 */
export class SeekDto extends BaseRoomDto {
  @IsNumber()
  @Min(0)
  positionSec: number;
}

/**
 * Pour rejoindre un salon.
 */
export class JoinRoomDto extends BaseRoomDto {
  @IsNumber()
  memberId: number;
}
