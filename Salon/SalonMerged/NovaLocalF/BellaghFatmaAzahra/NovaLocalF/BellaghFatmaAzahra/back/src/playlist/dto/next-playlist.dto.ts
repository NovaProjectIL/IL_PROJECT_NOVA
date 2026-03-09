import { IsString, Length, Matches, IsNumber } from 'class-validator';

export class NextPlaylistDto {
  @IsString()
  @Length(6, 6)
  @Matches(/^[A-Za-z0-9]{6}$/)
  codeRoom: string;
}