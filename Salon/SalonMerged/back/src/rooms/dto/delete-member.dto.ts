import { IsInt, IsString, Length, Matches } from 'class-validator';

export class DeleteMemberDto {
  @IsInt()
  memberId: number;

  @IsString()
  @Length(6, 6)
  @Matches(/^[A-Z0-9]{6}$/)
  codeRoom: string;
}