import { IsString, IsNotEmpty, IsNumber, IsOptional, Min } from 'class-validator';

export class BaseRoomDto {
  @IsString()
  @IsNotEmpty()
  codeRoom: string;
}

export class PlaybackControlDto extends BaseRoomDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  positionSec?: number;
}

export class SeekDto extends BaseRoomDto {
  @IsNumber()
  @Min(0)
  positionSec: number;
}

export class JoinRoomDto extends BaseRoomDto {
  @IsNumber()
  memberId: number;
}
