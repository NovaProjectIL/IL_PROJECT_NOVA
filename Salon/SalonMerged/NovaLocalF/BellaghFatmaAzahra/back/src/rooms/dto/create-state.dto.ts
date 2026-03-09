import { IsString, Length, Matches } from 'class-validator';

export class CreateStateDto {
  @IsString()
  @Length(6, 6)
  @Matches(/^[A-Z0-9]{6}$/)
  codeRoom: string;
}