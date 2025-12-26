import { IsString, Length, Matches, IsNumber } from 'class-validator';

export class DeletePlaylistDto {
  @IsString()
  @Length(6, 6)
  @Matches(/^[A-Za-z0-9]{6}$/)
  codeRoom: string;

  @IsNumber()
  memberId: number;

  @IsNumber()
  entryId: number;
}