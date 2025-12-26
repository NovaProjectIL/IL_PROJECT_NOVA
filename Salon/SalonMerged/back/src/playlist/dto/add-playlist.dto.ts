import { IsString, Length, Matches, IsNumber } from 'class-validator';

export class AddPlaylistDto {
  @IsString()
  @Length(6, 6)
  @Matches(/^[A-Za-z0-9]{6}$/)
  codeRoom: string;

  @IsNumber()
  memberId: number;

  @IsString()
  youtubeId: string;

  @IsString()
  youtubeVTitle: string;

  @IsString()
  youtubeVChannel: string;

  @IsNumber()
  youtubeVDurationSec: number;

  @IsString()
  youtubeVThumbnailUrl: string;
}