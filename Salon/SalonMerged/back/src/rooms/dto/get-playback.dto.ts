import { IsNotEmpty, IsString } from 'class-validator';

export class GetPlaybackDto {
  @IsString()
  @IsNotEmpty()
  codeRoom: string;
}