import { IsString, Length, Matches } from 'class-validator';

export class GetPlaylistDto {
  @IsString()
  @Length(6, 6)
  @Matches(/^[A-Za-z0-9]{6}$/)
  codeRoom: string;
}