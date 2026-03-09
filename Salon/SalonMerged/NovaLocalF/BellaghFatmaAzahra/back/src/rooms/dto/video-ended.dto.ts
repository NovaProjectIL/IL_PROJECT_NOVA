import { IsNotEmpty, IsString } from 'class-validator';

export class VideoEndedDto {
  @IsString()
  @IsNotEmpty()
  codeRoom: string;
}