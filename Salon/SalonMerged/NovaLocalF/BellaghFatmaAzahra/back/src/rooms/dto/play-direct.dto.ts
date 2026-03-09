import { IsInt, IsNotEmpty, IsPositive, IsString, IsUrl } from 'class-validator';

export class PlayDirectDto {
  @IsString()
  @IsNotEmpty()
  codeRoom: string;

  @IsInt()
  @IsPositive()
  memberId: number;

  @IsString()
  @IsNotEmpty()
  youtubeId: string;

  @IsString()
  @IsNotEmpty()
  youtubeVTitle: string;

  @IsString()
  @IsNotEmpty()
  youtubeVChannel: string;

  @IsInt()
  @IsPositive()
  youtubeVDurationSec: number;

  @IsString()
  @IsNotEmpty()
  @IsUrl()
  youtubeVThumbnailUrl: string;
}