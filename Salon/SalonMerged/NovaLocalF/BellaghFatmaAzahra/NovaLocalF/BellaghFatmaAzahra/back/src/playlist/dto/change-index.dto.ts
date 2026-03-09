import { IsInt, IsString, Length, Matches } from 'class-validator';

export class ChangeIndexDto {
  @IsString()
  @Length(6, 6)
  @Matches(/^[A-Za-z0-9]{6}$/)
  codeRoom: string;

  @IsInt()
  memberId: number;

  @IsInt()
  newIndex: number;
}